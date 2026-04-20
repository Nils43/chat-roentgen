import { analyzer } from './analyzer'
import { pseudonymizeMessages, restoreNamesDeep } from './pseudonymize'
import type { PrepareResult } from './profile'
import {
  TIMELINE_SYSTEM_PROMPT,
  TIMELINE_TOOL_SCHEMA,
  buildTimelineUserMessage,
} from './prompts'
import type { TimelinePayload, TimelineResult } from './types'
import type { ParsedChat } from '../parser/types'

const MODEL = 'claude-sonnet-4-6'

export interface RunTimelineOptions {
  chat: ParsedChat
  prepared: PrepareResult
  signal?: AbortSignal
}

export async function runTimeline({
  chat,
  prepared,
  signal,
}: RunTimelineOptions): Promise<TimelineResult> {
  const { sample, pseudonymMap } = prepared
  const pseudoMessages = pseudonymizeMessages(sample.messages, pseudonymMap)
  const pseudoParticipants = chat.participants.map((p) => pseudonymMap.forward[p] ?? p)

  const firstTs = chat.messages[0].ts
  const lastTs = chat.messages[chat.messages.length - 1].ts

  const userMessage = buildTimelineUserMessage(pseudoParticipants, pseudoMessages, firstTs, lastTs)

  const response = await analyzer.analyze(
    {
      model: MODEL,
      max_tokens: 4096,
      system: TIMELINE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      tools: [
        {
          name: TIMELINE_TOOL_SCHEMA.name,
          description: TIMELINE_TOOL_SCHEMA.description,
          input_schema: TIMELINE_TOOL_SCHEMA.input_schema as Record<string, unknown>,
        },
      ],
      tool_choice: { type: 'tool', name: TIMELINE_TOOL_SCHEMA.name },
    },
    signal,
  )

  const toolUse = response.content.find((b) => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Keine strukturierte Timeline erhalten.')
  }

  const raw = toolUse.input as TimelinePayload
  const restored = restoreNamesDeep(raw, pseudonymMap)

  return {
    payload: restored,
    raw: JSON.stringify(raw),
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model: response.model,
  }
}
