import type { ParsedChat } from '../parser/types'
import { analyzeHardFacts } from '../analysis/hardFacts'
import { analyzer } from './analyzer'
import type { PrepareResult } from './profile'
import { buildEvidence } from './evidence'
import { pseudonymizeDeep, restoreNamesDeep } from './pseudonymize'
import {
  RELATIONSHIP_SYSTEM_PROMPT,
  RELATIONSHIP_TOOL_SCHEMA,
  buildRelationshipUserMessage,
} from './prompts'
import type { RelationshipPayload, RelationshipResult } from './types'

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
const MODEL =
  (import.meta.env.VITE_ROENTGEN_MODEL as string | undefined) ?? DEFAULT_MODEL

export interface RunRelationshipOptions {
  chat: ParsedChat
  prepared: PrepareResult
  signal?: AbortSignal
  onStart?: () => void
}

// Single API call that analyzes the relationship dynamic (not the individuals).
// Uses the evidence packet built from HardFacts + curated moments.
export async function runRelationshipAnalysis({
  chat,
  prepared,
  signal,
  onStart,
}: RunRelationshipOptions): Promise<RelationshipResult> {
  const { pseudonymMap } = prepared
  const facts = analyzeHardFacts(chat)
  const evidence = buildEvidence(facts, chat, null)
  const pseudoEvidence = pseudonymizeDeep(evidence, pseudonymMap)
  const pseudoParticipants = chat.participants.map((p) => pseudonymMap.forward[p])

  onStart?.()

  const userMessage = buildRelationshipUserMessage(pseudoParticipants, pseudoEvidence)

  if (import.meta.env.DEV) {
    console.log('[relationship] evidence bytes:', JSON.stringify(pseudoEvidence).length, 'notable moments:', pseudoEvidence.notableMoments.length)
  }

  const response = await analyzer.analyze(
    {
      model: MODEL,
      max_tokens: 8192,
      system: [
        {
          type: 'text',
          text: RELATIONSHIP_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
      tools: [
        {
          name: RELATIONSHIP_TOOL_SCHEMA.name,
          description: RELATIONSHIP_TOOL_SCHEMA.description,
          input_schema: RELATIONSHIP_TOOL_SCHEMA.input_schema as Record<string, unknown>,
        },
      ],
      tool_choice: { type: 'tool', name: RELATIONSHIP_TOOL_SCHEMA.name },
    },
    signal,
  )

  const toolUse = response.content.find((b) => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('No structured relationship analysis returned.')
  }

  const raw = toolUse.input as RelationshipPayload
  const payload = restoreNamesDeep(raw, pseudonymMap)

  return {
    payload,
    raw: JSON.stringify(raw),
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model: response.model,
  }
}
