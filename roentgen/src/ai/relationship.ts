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

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
const MODEL =
  (import.meta.env.VITE_ROENTGEN_MODEL as string | undefined) ?? DEFAULT_MODEL

// Required top-level keys on a complete relationship payload. If any are
// missing after a call we retry once before surfacing the truncation UI.
const REQUIRED_KEYS = [
  'kopplung',
  'machtstruktur',
  'bindungsdyade',
  'bids',
  'repair',
  'konflikt_signatur',
  'mentalisierung',
  'meta_kommunikation',
  'berne',
  'unausgesprochene_regeln',
  'kern_insight',
  'safety_flag',
] as const

function isComplete(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  const obj = payload as Record<string, unknown>
  for (const k of REQUIRED_KEYS) {
    if (obj[k] == null) return false
  }
  const m = obj.mentalisierung as { pro_person?: unknown } | undefined
  if (!m || !Array.isArray(m.pro_person)) return false
  const bids = obj.bids as { pro_person?: unknown } | undefined
  if (!bids || !Array.isArray(bids.pro_person)) return false
  const kk = obj.konflikt_signatur as { four_horsemen_pro_person?: unknown } | undefined
  if (!kk || !Array.isArray(kk.four_horsemen_pro_person)) return false
  return true
}

export interface RunRelationshipOptions {
  chat: ParsedChat
  prepared: PrepareResult
  signal?: AbortSignal
  onStart?: () => void
  // Unlock token from a completed Stripe checkout. Required in 'api' mode.
  unlockToken?: string
}

// Single API call that analyzes the relationship dynamic (not the individuals).
// Uses the evidence packet built from HardFacts + curated moments.
export async function runRelationshipAnalysis({
  chat,
  prepared,
  signal,
  onStart,
  unlockToken,
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

  // One automatic retry if the first pass returns a truncated/incomplete
  // payload. Empirically the second try rarely also truncates — it's cheaper
  // than asking the user to click retry and matches their expectation that
  // "a paid analysis either works or we eat the cost".
  let response = await analyzer.analyze(request, signal, unlockToken)
  let toolUse = response.content.find((b) => b.type === 'tool_use')
  let raw: RelationshipPayload | null =
    toolUse && toolUse.type === 'tool_use' ? (toolUse.input as RelationshipPayload) : null

  if (!raw || !isComplete(raw)) {
    if (import.meta.env.DEV) {
      console.warn('[relationship] first pass incomplete, retrying once')
    }
    response = await analyzer.analyze(request, signal, unlockToken)
    toolUse = response.content.find((b) => b.type === 'tool_use')
    raw = toolUse && toolUse.type === 'tool_use' ? (toolUse.input as RelationshipPayload) : raw
  }

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
