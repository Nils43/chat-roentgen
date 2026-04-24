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

// Sonnet 4.6 for relationship. The schema has ~12 top-level blocks with deep
// nesting; Haiku 4.5 produced unreliable tool_use here — missing required
// fields often enough that users saw "—" filler in real sections, and retries
// ate the Vercel budget. Sonnet handles the nested schema first-shot the vast
// majority of the time, so a single ~8-15 s call beats 2-3 Haiku retries that
// still ship a half-empty payload. Cost: ~€0.10 per call vs €3 credit price.
// Override with VITE_ROENTGEN_RELATIONSHIP_MODEL to force a different model.
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
    // Budget-capped output window. Sonnet 4.6 output is $15/MTok; at
    // max_tokens=5500 the worst-case call stays around €0.08 even without
    // caching on the input side. The schema produces ~4000-5000 tokens of
    // populated output in practice; the remaining headroom absorbs model
    // variance. If the model hits the cap the server-side backfill fills
    // any missing required fields with schema defaults ("—", [], 0).
    max_tokens: 5500,
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
