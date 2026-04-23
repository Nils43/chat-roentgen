import type { ParsedChat } from '../parser/types'
import { analyzeHardFacts } from '../analysis/hardFacts'
import { analyzer } from './analyzer'
import type { PrepareResult } from './profile'
import { buildEvidence } from './evidence'
import { pseudonymizeDeep, restoreNamesDeep } from './pseudonymize'
import {
  RELATIONSHIP_TOOL_SCHEMA,
  buildRelationshipUserMessage,
  selectRelationshipPrompt,
} from './prompts'
import { i18n } from '../i18n'
import type { RelationshipPayload, RelationshipResult } from './types'

// Sonnet for relationship — the schema has 13 top-level blocks with dense
// nested required fields, and Haiku was flaking ~30% of the time even with
// retries. One Sonnet call is both cheaper AND more reliable than three
// Haiku calls in practice. Override with VITE_ROENTGEN_RELATIONSHIP_MODEL.
const DEFAULT_MODEL = 'claude-sonnet-4-6'
const MODEL =
  (import.meta.env.VITE_ROENTGEN_RELATIONSHIP_MODEL as string | undefined) ??
  (import.meta.env.VITE_ROENTGEN_MODEL as string | undefined) ??
  DEFAULT_MODEL

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

  const locale = i18n.get()
  const userMessage = buildRelationshipUserMessage(pseudoParticipants, pseudoEvidence, locale)
  const systemPrompt = selectRelationshipPrompt(locale)

  if (import.meta.env.DEV) {
    console.log('[relationship] evidence bytes:', JSON.stringify(pseudoEvidence).length, 'notable moments:', pseudoEvidence.notableMoments.length)
  }

  const request = {
    model: MODEL,
    // Schema has ~12 top-level blocks; max_tokens caps the output window.
    // 16k is well within Haiku 4.5's budget and only actual output is billed.
    max_tokens: 16384,
    system: [
      {
        type: 'text' as const,
        text: systemPrompt,
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    messages: [{ role: 'user' as const, content: userMessage }],
    tools: [
      {
        name: RELATIONSHIP_TOOL_SCHEMA.name,
        description: RELATIONSHIP_TOOL_SCHEMA.description,
        input_schema: RELATIONSHIP_TOOL_SCHEMA.input_schema as Record<string, unknown>,
      },
    ],
    tool_choice: { type: 'tool' as const, name: RELATIONSHIP_TOOL_SCHEMA.name },
  }

  // No client-side retry here — every call to analyzer.analyze hits the
  // server proxy which spends a credit. The server already retries up to 3
  // times on validation failure (with an incremental hint to the model) and
  // refunds the credit if all attempts end incomplete. So one call here =
  // one credit spent OR refunded, never two.
  const response = await analyzer.analyze(request, signal)
  const toolUse = response.content.find((b) => b.type === 'tool_use')
  const raw: RelationshipPayload | null =
    toolUse && toolUse.type === 'tool_use' ? (toolUse.input as RelationshipPayload) : null

  if (!raw) {
    throw new Error('No structured relationship analysis returned.')
  }

  const payload = restoreNamesDeep(raw, pseudonymMap)

  return {
    payload,
    raw: JSON.stringify(raw),
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model: response.model,
  }
}
