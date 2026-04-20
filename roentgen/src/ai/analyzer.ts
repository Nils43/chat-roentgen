import type { ApiRequest, ApiResponse } from './types'
import { analyze as callApi } from './client'

// Pluggable LLM backend. Swap via VITE_ROENTGEN_ANALYZER:
//   'api'      → live Anthropic API through the /api/analyze proxy
//   'fixture'  → serves pre-written JSON from /fixtures (no key needed)
// Default is 'fixture' so the app is fully navigable without a key.

export interface Analyzer {
  kind: 'api' | 'fixture'
  analyze(req: ApiRequest, signal?: AbortSignal): Promise<ApiResponse>
}

export class ApiAnalyzer implements Analyzer {
  kind = 'api' as const
  async analyze(req: ApiRequest, signal?: AbortSignal): Promise<ApiResponse> {
    return callApi(req, signal)
  }
}

// Fixture mode: we dispatch by the requested tool name.
//   submit_profile      → /fixtures/profile-<pseudo>.json
//   submit_relationship → /fixtures/relationship.json
// Simulates a realistic API latency so the loading animation still feels right.
export class FixtureAnalyzer implements Analyzer {
  kind = 'fixture' as const

  async analyze(req: ApiRequest, signal?: AbortSignal): Promise<ApiResponse> {
    const toolName = req.tools?.[0]?.name ?? 'submit_profile'

    const { url, slug, outputTokens } =
      toolName === 'submit_relationship'
        ? { url: '/fixtures/relationship.json', slug: 'relationship', outputTokens: 1400 }
        : (() => {
            const target = extractTargetPerson(req)
            const s = target.replace(/\s+/g, '-').toLowerCase()
            return { url: `/fixtures/profile-${s}.json`, slug: s, outputTokens: 800 }
          })()

    // Simulate API latency — 1.6s–3.2s random
    const delay = 1600 + Math.random() * 1600
    await wait(delay, signal)

    const res = await fetch(url, { signal })
    if (!res.ok) {
      throw new Error(`Fixture nicht gefunden: ${url}. Tool: ${toolName}.`)
    }
    const input = await res.json()

    return {
      id: `fixture_${slug}_${Date.now()}`,
      model: req.model + ' (fixture)',
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: `tool_${slug}`,
          name: toolName,
          input,
        },
      ],
      usage: {
        input_tokens: estimateTokens(req),
        output_tokens: outputTokens,
      },
    }
  }
}

function extractTargetPerson(req: ApiRequest): string {
  const lastUser = [...req.messages].reverse().find((m) => m.role === 'user')
  const text = typeof lastUser?.content === 'string' ? lastUser.content : ''
  // The prompt template writes: "**Analyse-Ziel:** Person X"
  const m = /Analyse-Ziel:\*{0,2}\s*([^\n]+)/.exec(text)
  if (m) return m[1].trim()
  throw new Error('Konnte Ziel-Pseudonym im Prompt nicht finden.')
}

function estimateTokens(req: ApiRequest): number {
  const total = (req.system ?? '').length + req.messages.reduce((s, m) => s + (typeof m.content === 'string' ? m.content.length : 0), 0)
  return Math.round(total * 0.28)
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('aborted', 'AbortError'))
    })
  })
}

// Singleton picked at module load. Env var wins; otherwise default to fixture.
const mode = (import.meta.env.VITE_ROENTGEN_ANALYZER ?? 'fixture') as 'api' | 'fixture'

export const analyzer: Analyzer = mode === 'api' ? new ApiAnalyzer() : new FixtureAnalyzer()
