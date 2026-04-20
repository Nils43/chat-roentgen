import type { ParsedChat } from '../parser/types'
import { analyzeHardFacts } from '../analysis/hardFacts'
import { analyzer } from './analyzer'
import { buildEvidence } from './evidence'
import {
  buildPseudonymMap,
  pseudonymizeDeep,
  restoreNamesDeep,
  type PseudonymMap,
} from './pseudonymize'
import { PROFILE_SYSTEM_PROMPT, PROFILE_TOOL_SCHEMA, buildProfileUserMessage } from './prompts'
import type { PersonProfile, ProfileResult } from './types'

// Model selection — ENV override wins, default Haiku 4.5 (cheapest + structured input
// compensates for model size). Set VITE_ROENTGEN_MODEL=claude-sonnet-4-6 to upgrade.
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
const MODEL =
  (import.meta.env.VITE_ROENTGEN_MODEL as string | undefined) ?? DEFAULT_MODEL

export const analyzerKind = analyzer.kind

export interface PrepareResult {
  pseudonymMap: PseudonymMap
  messagesSent: number
  approxTokensPerCall: number
  totalCalls: number
  analyzerKind: 'api' | 'fixture'
  // How many chat messages feed into the curated evidence sample
  notableCount: number
  // Total messages in the source chat (for "X of Y" framing in consent)
  totalAvailable: number
}

// Prepares the AI batch without sending anything. Used for the consent screen.
// With the evidence-first refactor, "messagesSent" reflects curated moments, not
// a raw sample. Token count is a rough projection for the biggest call.
export function prepareAnalysis(chat: ParsedChat): PrepareResult {
  const facts = analyzeHardFacts(chat)
  const pseudonymMap = buildPseudonymMap(chat.participants)
  // Best-case evidence for the "target is first participant" preview.
  const preview = buildEvidence(facts, chat, chat.participants[0] ?? null)
  const approxTokens = estimateTokens(preview)
  return {
    pseudonymMap,
    messagesSent: preview.notableMoments.length,
    approxTokensPerCall: approxTokens,
    totalCalls: 1, // personal profile is a single call per user
    analyzerKind: analyzer.kind,
    notableCount: preview.notableMoments.length,
    totalAvailable: chat.messages.length,
  }
}

export interface RunProfilesOptions {
  chat: ParsedChat
  prepared: PrepareResult
  onProgress?: (done: number, total: number, currentPerson: string | null) => void
  signal?: AbortSignal
  // If set, only profile these specific participants. Per product concept,
  // the app only profiles the *user themselves* — never the other person.
  targetPersons?: string[]
}

export async function runProfileAnalyses({
  chat,
  prepared,
  onProgress,
  signal,
  targetPersons,
}: RunProfilesOptions): Promise<ProfileResult[]> {
  const { pseudonymMap } = prepared
  const facts = analyzeHardFacts(chat)

  const targets =
    targetPersons && targetPersons.length > 0
      ? targetPersons.filter((p) => chat.participants.includes(p))
      : chat.participants

  const total = targets.length
  let done = 0
  onProgress?.(0, total, targets[0] ?? null)

  const tasks = targets.map(async (realName) => {
    const pseudoName = pseudonymMap.forward[realName]
    const evidence = buildEvidence(facts, chat, realName)
    const pseudoEvidence = pseudonymizeDeep(evidence, pseudonymMap)
    const userMessage = buildProfileUserMessage(pseudoName, pseudoEvidence)

    if (import.meta.env.DEV) {
      console.log('[profile] evidence bytes:', JSON.stringify(pseudoEvidence).length, 'notable moments:', pseudoEvidence.notableMoments.length)
    }

    const response = await analyzer.analyze(
      {
        model: MODEL,
        max_tokens: 3072,
        // System prompt as a cached block — 90% off on retries within 5 min.
        system: [
          {
            type: 'text',
            text: PROFILE_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userMessage }],
        tools: [
          {
            name: PROFILE_TOOL_SCHEMA.name,
            description: PROFILE_TOOL_SCHEMA.description,
            input_schema: PROFILE_TOOL_SCHEMA.input_schema as Record<string, unknown>,
          },
        ],
        tool_choice: { type: 'tool', name: PROFILE_TOOL_SCHEMA.name },
      },
      signal,
    )

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error(`No structured profile returned for ${realName}.`)
    }

    const profileRaw = toolUse.input as PersonProfile
    const profile = restoreNamesDeep(profileRaw, pseudonymMap)
    profile.person = realName

    done++
    onProgress?.(done, total, targets[done] ?? null)

    const result: ProfileResult = {
      profile,
      raw: JSON.stringify(profileRaw),
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: response.model,
    }
    return result
  })

  return Promise.all(tasks)
}

// Rough token estimate: ~4 chars per token for JSON payload.
function estimateTokens(value: unknown): number {
  const json = JSON.stringify(value)
  return Math.round(json.length / 4)
}
