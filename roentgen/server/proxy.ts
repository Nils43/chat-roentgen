// Zone-2 API-Proxy. Runs as a Vite dev plugin in development and can be
// redeployed unchanged as a Cloudflare Worker / Vercel Function later.
//
// Contract (POST /api/analyze):
//   req.body  = { model, max_tokens, system, messages, tools, tool_choice }
//   response  = raw Anthropic API response (JSON)
//
// Guarantees:
//   - The API key is read from process.env.ANTHROPIC_API_KEY, never sent to the client.
//   - Request bodies are held in memory for the duration of the fetch only.
//   - Nothing is written to disk. We never console.log the request body.
//   - A generic error surface — we don't leak Anthropic's error details verbatim.

import type { IncomingMessage, ServerResponse } from 'node:http'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

export async function handleAnalyze(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'method_not_allowed' }))
    return
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: 'missing_api_key', message: 'Set ANTHROPIC_API_KEY in .env' }))
    return
  }

  // Read body (streaming — no disk buffer)
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  const bodyRaw = Buffer.concat(chunks).toString('utf-8')

  // Bounded size — hard reject anything oversized before forwarding
  if (bodyRaw.length > 500_000) {
    res.statusCode = 413
    res.end(JSON.stringify({ error: 'payload_too_large' }))
    return
  }

  let body: unknown
  try {
    body = JSON.parse(bodyRaw)
  } catch {
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'invalid_json' }))
    return
  }

  // Narrow body to an allow-list of fields. We do NOT forward arbitrary keys.
  const b = body as Record<string, unknown>
  const forward = {
    model: typeof b.model === 'string' ? b.model : 'claude-sonnet-4-6',
    max_tokens: typeof b.max_tokens === 'number' ? b.max_tokens : 2048,
    system: typeof b.system === 'string' ? b.system : undefined,
    messages: Array.isArray(b.messages) ? b.messages : [],
    tools: Array.isArray(b.tools) ? b.tools : undefined,
    tool_choice: typeof b.tool_choice === 'object' ? b.tool_choice : undefined,
  }

  try {
    const upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(forward),
    })

    const text = await upstream.text()
    res.statusCode = upstream.status
    res.setHeader('content-type', 'application/json')
    res.end(text)
  } catch (err) {
    // Intentionally vague — don't leak infrastructure details to the client.
    res.statusCode = 502
    res.end(JSON.stringify({ error: 'upstream_unreachable' }))
    if (process.env.ROENTGEN_DEBUG) {
      // Only surface errors when explicitly debugging, never in default dev.
      console.error('[proxy]', (err as Error).message)
    }
  }
}
