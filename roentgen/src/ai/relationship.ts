import type { ParsedChat } from '../parser/types'
import { analyzer } from './analyzer'
import type { PrepareResult } from './profile'
import { pseudonymizeMessages, restoreNamesDeep } from './pseudonymize'
import {
  RELATIONSHIP_SYSTEM_PROMPT,
  RELATIONSHIP_TOOL_SCHEMA,
  buildRelationshipUserMessage,
} from './prompts'
import type { RelationshipPayload, RelationshipResult } from './types'

const MODEL = 'claude-sonnet-4-6'

export interface RunRelationshipOptions {
  chat: ParsedChat
  prepared: PrepareResult
  signal?: AbortSignal
  onStart?: () => void
}

// Single API call that analyzes the relationship dynamic (not the individuals).
// Uses the same sample + pseudonym map that the profiles run built.
export async function runRelationshipAnalysis({
  chat,
  prepared,
  signal,
  onStart,
}: RunRelationshipOptions): Promise<RelationshipResult> {
  const { sample, pseudonymMap } = prepared
  const pseudoMessages = pseudonymizeMessages(sample.messages, pseudonymMap)
  const pseudoParticipants = chat.participants.map((p) => pseudonymMap.forward[p])

  onStart?.()

  const userMessage = buildRelationshipUserMessage(pseudoParticipants, pseudoMessages)

  const response = await analyzer.analyze(
    {
      model: MODEL,
      max_tokens: 8192,
      system: RELATIONSHIP_SYSTEM_PROMPT,
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
