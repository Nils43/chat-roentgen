import type { ParsedChat } from '../parser/types'
import { analyzeHardFacts } from '../analysis/hardFacts'
import { analyzer } from './analyzer'
import type { PrepareResult } from './profile'
import { buildEvidence } from './evidence'
import { pseudonymizeDeep, restoreNamesDeep } from './pseudonymize'
import {
  RELATIONSHIP_CHUNK_SCHEMAS,
  buildRelationshipUserMessage,
  selectRelationshipPrompt,
} from './prompts'
import { i18n } from '../i18n'
import type { RelationshipPayload, RelationshipResult } from './types'

// Haiku 4.5 for every chunk. The full relationship schema (~5 k tokens of
// output) doesn't fit into Vercel's 60 s maxDuration when generated in a
// single call, regardless of model — Sonnet runs at ~45 tok/s, Haiku at ~90.
// We fan the schema out into three sub-tools (see prompts.ts) and run them
// in parallel via /api/analyze-relationship. Each chunk emits ~1.5-2 k
// tokens, ~20 s wall-clock, so the whole thing lands around 25 s. Override
// with VITE_ROENTGEN_RELATIONSHIP_MODEL if you want to swap in a faster/
// more capable model — the split logic is model-agnostic.
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
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

// Relationship analysis — dyad-level, not individual. Runs as three parallel
// Anthropic calls behind a single credit spend (see api/analyze-relationship).
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

  // Per-chunk output budget. Each chunk covers 4-5 top-level schema blocks
  // and produces ~1500-2000 tokens; 2500 gives Haiku headroom without
  // wasting cap. Three chunks × ~25 s each, run in parallel server-side,
  // keeps the wall-clock well inside Vercel's 60 s maxDuration.
  const chunkedRequest = {
    model: MODEL,
    max_tokens: 2500,
    system: [
      {
        type: 'text' as const,
        text: systemPrompt,
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    messages: [{ role: 'user' as const, content: userMessage }],
    chunks: RELATIONSHIP_CHUNK_SCHEMAS.map((s) => ({
      name: s.name,
      description: s.description,
      input_schema: s.input_schema,
    })),
  }

  // One credit for the whole fan-out. /api/analyze-relationship spends once
  // up front, runs all chunks in parallel, and refunds if every chunk fails.
  const response = await analyzer.analyzeRelationshipChunked(chunkedRequest, signal)
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
