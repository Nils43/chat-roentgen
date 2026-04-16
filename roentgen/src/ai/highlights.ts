import { analyzer } from './analyzer'
import { pseudonymizeMessages, restoreNamesDeep } from './pseudonymize'
import type { PrepareResult } from './profile'
import {
  HIGHLIGHTS_SYSTEM_PROMPT,
  HIGHLIGHTS_TOOL_SCHEMA,
  buildHighlightsUserMessage,
} from './prompts'
import type { HighlightsPayload, HighlightsResult } from './types'
import type { ParsedChat } from '../parser/types'

const MODEL = 'claude-opus-4-6'

export interface RunHighlightsOptions {
  chat: ParsedChat
  prepared: PrepareResult
  signal?: AbortSignal
}

export async function runHighlights({
  chat,
  prepared,
  signal,
}: RunHighlightsOptions): Promise<HighlightsResult> {
  const { sample, pseudonymMap } = prepared
  const pseudoMessages = pseudonymizeMessages(sample.messages, pseudonymMap)
  const pseudoParticipants = chat.participants.map((p) => pseudonymMap.forward[p] ?? p)

  const userMessage = buildHighlightsUserMessage(pseudoParticipants, pseudoMessages)

  const response = await analyzer.analyze(
    {
      model: MODEL,
      max_tokens: 4096,
      system: HIGHLIGHTS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      tools: [
        {
          name: HIGHLIGHTS_TOOL_SCHEMA.name,
          description: HIGHLIGHTS_TOOL_SCHEMA.description,
          input_schema: HIGHLIGHTS_TOOL_SCHEMA.input_schema as Record<string, unknown>,
        },
      ],
      tool_choice: { type: 'tool', name: HIGHLIGHTS_TOOL_SCHEMA.name },
    },
    signal,
  )

  const toolUse = response.content.find((b) => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Keine strukturierten Highlights erhalten.')
  }

  const raw = toolUse.input as HighlightsPayload
  const restored = restoreNamesDeep(raw, pseudonymMap)

  // Re-anchor author to real name based on the index (index is the source of truth).
  const safePayload: HighlightsPayload = {
    highlights: restored.highlights
      .map((h) => {
        const msg = sample.messages[h.index]
        return msg ? { ...h, author: msg.author } : h
      })
      .sort((a, b) => b.score - a.score),
    meta: restored.meta,
  }

  return {
    payload: safePayload,
    raw: JSON.stringify(raw),
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model: response.model,
  }
}
