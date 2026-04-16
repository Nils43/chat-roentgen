import type { ParsedChat } from '../parser/types'
import { analyzer } from './analyzer'
import { sampleForAI, type SampleResult } from './sampling'
import { buildPseudonymMap, pseudonymizeMessages, restoreNamesDeep, type PseudonymMap } from './pseudonymize'
import { PROFILE_SYSTEM_PROMPT, PROFILE_TOOL_SCHEMA, buildProfileUserMessage } from './prompts'
import type { PersonProfile, ProfileResult } from './types'

const MODEL = 'claude-sonnet-4-6'

export const analyzerKind = analyzer.kind

export interface PrepareResult {
  sample: SampleResult
  pseudonymMap: PseudonymMap
  messagesSent: number
  approxTokensPerCall: number
  totalCalls: number
  analyzerKind: 'api' | 'fixture'
}

// Prepares the AI batch without sending anything. Used for the consent screen:
// shows exactly how many messages / tokens / calls are going out.
export function prepareAnalysis(chat: ParsedChat): PrepareResult {
  const sample = sampleForAI(chat)
  const pseudonymMap = buildPseudonymMap(chat.participants)
  return {
    sample,
    pseudonymMap,
    messagesSent: sample.messages.length,
    approxTokensPerCall: sample.approxTokens,
    totalCalls: chat.participants.length,
    analyzerKind: analyzer.kind,
  }
}

export interface RunProfilesOptions {
  chat: ParsedChat
  prepared: PrepareResult
  onProgress?: (done: number, total: number, currentPerson: string | null) => void
  signal?: AbortSignal
}

// Run one profile analysis per participant, in parallel. Returns real-name results.
export async function runProfileAnalyses({
  chat,
  prepared,
  onProgress,
  signal,
}: RunProfilesOptions): Promise<ProfileResult[]> {
  const { sample, pseudonymMap } = prepared
  const pseudoMessages = pseudonymizeMessages(sample.messages, pseudonymMap)

  const total = chat.participants.length
  let done = 0
  onProgress?.(0, total, chat.participants[0] ?? null)

  const tasks = chat.participants.map(async (realName) => {
    const pseudoName = pseudonymMap.forward[realName]
    const userMessage = buildProfileUserMessage(pseudoName, pseudoMessages)

    const response = await analyzer.analyze(
      {
        model: MODEL,
        max_tokens: 4096,
        system: PROFILE_SYSTEM_PROMPT,
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
      throw new Error(`Kein strukturiertes Profil für ${realName} erhalten.`)
    }

    const profileRaw = toolUse.input as PersonProfile
    // Restore real names in any textual field
    const profile = restoreNamesDeep(profileRaw, pseudonymMap)
    // Ensure the displayed name is the real one
    profile.person = realName

    done++
    onProgress?.(done, total, chat.participants[done] ?? null)

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
