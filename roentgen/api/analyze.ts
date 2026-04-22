import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUnlock, setUnlock, type UnlockRecord } from './_kv'

// Zone-2 analyzer proxy. Runs as a Vercel Function in production and is the
// single gate between the browser and Anthropic. Two responsibilities:
//
//   1. Hold the Anthropic API key server-side.
//   2. Enforce that the caller has a valid unlock receipt — a token written to
//      Vercel KV by the Stripe webhook after a successful checkout.
//
// Security posture: the request body is kept in memory for the duration of the
// fetch only, nothing is logged, and error detail from Anthropic is suppressed
// so infrastructure specifics don't leak to the browser.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MAX_BODY_BYTES = 500_000

interface AnthropicBody {
  model?: string
  max_tokens?: number
  system?: string | unknown[]
  messages?: unknown[]
  tools?: unknown[]
  tool_choice?: unknown
}

function toolName(body: AnthropicBody): string | null {
  const tools = body.tools
  if (!Array.isArray(tools) || tools.length === 0) return null
  const first = tools[0] as { name?: unknown }
  return typeof first.name === 'string' ? first.name : null
}

// Map a tool name back to the module it serves. Keeps the paywall and the
// analyzer in lockstep: a 'profiles' token can only run submit_profile,
// 'relationship' can only run submit_relationship. Bundle unlocks both.
function moduleForTool(name: string | null): 'profiles' | 'relationship' | null {
  if (name === 'submit_profile') return 'profiles'
  if (name === 'submit_relationship') return 'relationship'
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    res.status(500).json({ error: 'missing_api_key' })
    return
  }

  // Paywall bypass — dev/preview toggle. Set PAYWALL_DISABLED=true in .env to
  // run analyses without a paid token for product testing. Never flip this on
  // in production.
  const paywallDisabled = process.env.PAYWALL_DISABLED === 'true'

  const token = req.headers['x-unlock-token']
  const tokenStr = Array.isArray(token) ? token[0] : token
  if (!paywallDisabled) {
    if (!tokenStr || typeof tokenStr !== 'string' || tokenStr.length < 16) {
      res.status(402).json({ error: 'missing_unlock_token' })
      return
    }
  }

  const record = !paywallDisabled && tokenStr ? await getUnlock(tokenStr) : null
  if (!paywallDisabled) {
    if (!record || !record.paid) {
      res.status(402).json({ error: 'unpaid' })
      return
    }
    if (record.used) {
      res.status(402).json({ error: 'token_used' })
      return
    }
  }

  // Vercel parses JSON for us by default. Fall back to raw body if it arrives
  // as a string — belt-and-suspenders with a guard for malformed JSON.
  let body: AnthropicBody
  try {
    body =
      typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as AnthropicBody)
  } catch {
    res.status(400).json({ error: 'invalid_json' })
    return
  }

  const bodySize = JSON.stringify(body).length
  if (bodySize > MAX_BODY_BYTES) {
    res.status(413).json({ error: 'payload_too_large' })
    return
  }

  // Token ↔ tool check. A 'profiles' unlock cannot run the relationship tool.
  const requestedModule = moduleForTool(toolName(body))
  if (!requestedModule) {
    res.status(400).json({ error: 'unknown_tool' })
    return
  }
  if (!paywallDisabled && record) {
    const tokenAllows =
      record.module === 'bundle' || record.module === requestedModule
    if (!tokenAllows) {
      res.status(402).json({ error: 'wrong_module_for_token' })
      return
    }
    // Bundle: already spent this half?
    if (record.module === 'bundle' && record.spent?.includes(requestedModule)) {
      res.status(402).json({ error: 'module_already_used' })
      return
    }
  }

  // Narrow to the Anthropic allow-list — we never forward arbitrary keys.
  const systemField =
    typeof body.system === 'string' || Array.isArray(body.system) ? body.system : undefined
  const forward = {
    model: typeof body.model === 'string' ? body.model : 'claude-haiku-4-5-20251001',
    max_tokens: typeof body.max_tokens === 'number' ? body.max_tokens : 2048,
    system: systemField,
    messages: Array.isArray(body.messages) ? body.messages : [],
    tools: Array.isArray(body.tools) ? body.tools : undefined,
    tool_choice: typeof body.tool_choice === 'object' ? body.tool_choice : undefined,
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
    if (upstream.ok && !paywallDisabled && record && tokenStr) {
      // Burn the token only on success. If Anthropic failed the user can retry.
      const next: UnlockRecord =
        record.module === 'bundle'
          ? (() => {
              const spent = record.spent ?? []
              const nextSpent = spent.includes(requestedModule)
                ? spent
                : [...spent, requestedModule]
              const fullySpent =
                nextSpent.includes('profiles') && nextSpent.includes('relationship')
              return { ...record, spent: nextSpent, used: fullySpent }
            })()
          : { ...record, used: true }
      await setUnlock(tokenStr, next)
    }
    res.status(upstream.status).setHeader('content-type', 'application/json').send(text)
  } catch {
    res.status(502).json({ error: 'upstream_unreachable' })
  }
}
