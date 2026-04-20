import { analyzer } from './analyzer'
import { pseudonymizeMessages, restoreNamesDeep } from './pseudonymize'
import type { PrepareResult } from './profile'
import {
  ENTWICKLUNG_SYSTEM_PROMPT,
  ENTWICKLUNG_TOOL_SCHEMA,
  buildEntwicklungUserMessage,
} from './prompts'
import type { EntwicklungPayload, EntwicklungResult } from './types'
import type { ParsedChat } from '../parser/types'
import type { SymmetryTrend } from '../analysis/symmetryTrend'

const MODEL = 'claude-sonnet-4-6'

export interface RunEntwicklungOptions {
  chat: ParsedChat
  prepared: PrepareResult
  symmetry: SymmetryTrend
  signal?: AbortSignal
}

export async function runEntwicklung({
  chat,
  prepared,
  symmetry,
  signal,
}: RunEntwicklungOptions): Promise<EntwicklungResult> {
  const { sample, pseudonymMap } = prepared
  const pseudoMessages = pseudonymizeMessages(sample.messages, pseudonymMap)
  const pseudoParticipants = chat.participants.map((p) => pseudonymMap.forward[p] ?? p)

  const firstTs = chat.messages[0].ts
  const lastTs = chat.messages[chat.messages.length - 1].ts

  const userMessage = buildEntwicklungUserMessage(
    pseudoParticipants,
    pseudoMessages,
    firstTs,
    lastTs,
    symmetry.promptNote,
  )

  const response = await analyzer.analyze(
    {
      model: MODEL,
      max_tokens: 6144,
      system: ENTWICKLUNG_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      tools: [
        {
          name: ENTWICKLUNG_TOOL_SCHEMA.name,
          description: ENTWICKLUNG_TOOL_SCHEMA.description,
          input_schema: ENTWICKLUNG_TOOL_SCHEMA.input_schema as Record<string, unknown>,
        },
      ],
      tool_choice: { type: 'tool', name: ENTWICKLUNG_TOOL_SCHEMA.name },
    },
    signal,
  )

  const toolUse = response.content.find((b) => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('No structured evolution data returned.')
  }

  const raw = toolUse.input as EntwicklungPayload
  const restored = restoreNamesDeep(raw, pseudonymMap)

  return {
    payload: restored,
    raw: JSON.stringify(raw),
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model: response.model,
  }
}
