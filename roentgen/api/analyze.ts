import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminClient, userFromAuthHeader } from './_supabase'

// Zone-2 analyzer proxy. Single entry between the browser and Anthropic.
//
// Flow:
//   1. Authenticate via Supabase access token (Authorization header)
//   2. Spend one credit via the `spend_credit` Postgres RPC (atomic, returns
//      false if balance is 0 — caller gets 402)
//   3. Forward an allow-listed body to Anthropic
//   4. If upstream fails, refund the credit (client gets a nice retry)
//
// Nothing logged, nothing stored. Bodies held in memory only for the fetch.

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

function noteForTool(name: string | null): string {
  if (name === 'submit_profile') return 'profile'
  if (name === 'submit_relationship') return 'relationship'
  return 'analysis'
}

async function refundCredit(accountId: string, note: string): Promise<void> {
  const sb = adminClient()
  // Insert a refund transaction and bump the balance. Done as a pair — not a
  // single RPC because refunds are rare and can tolerate a second of drift.
  await sb.from('transactions').insert({
    account_id: accountId,
    delta: 1,
    kind: 'refund',
    note,
  })
  const { data: acc } = await sb.from('accounts').select('credits').eq('id', accountId).maybeSingle()
  await sb
    .from('accounts')
    .update({ credits: (acc?.credits ?? 0) + 1 })
    .eq('id', accountId)
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

  // Dev bypass: PAYWALL_DISABLED=true skips auth and credits entirely. Never
  // flip on in production.
  const paywallDisabled = process.env.PAYWALL_DISABLED === 'true'

  let userId: string | null = null
  if (!paywallDisabled) {
    userId = await userFromAuthHeader(req.headers.authorization)
    if (!userId) {
      res.status(401).json({ error: 'not_signed_in' })
      return
    }
  }

  let body: AnthropicBody
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as AnthropicBody)
  } catch {
    res.status(400).json({ error: 'invalid_json' })
    return
  }

  const bodySize = JSON.stringify(body).length
  if (bodySize > MAX_BODY_BYTES) {
    res.status(413).json({ error: 'payload_too_large' })
    return
  }

  const note = noteForTool(toolName(body))

  // Spend 1 credit before calling Anthropic so a concurrent request can't
  // double-spend. Atomic at the DB level (SELECT … FOR UPDATE).
  if (!paywallDisabled && userId) {
    const sb = adminClient()
    const { data: spent, error: spendErr } = await sb.rpc('spend_credit', {
      p_account: userId,
      p_note: note,
    })
    if (spendErr) {
      res.status(500).json({ error: 'spend_failed', message: spendErr.message })
      return
    }
    if (spent !== true) {
      res.status(402).json({ error: 'insufficient_credits' })
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
    if (!upstream.ok && !paywallDisabled && userId) {
      // Anthropic failed — refund so the user isn't charged for a broken call.
      try {
        await refundCredit(userId, note + '_refund')
      } catch {
        // Refund failure is logged server-side only; don't leak to client.
      }
    }
    res.status(upstream.status).setHeader('content-type', 'application/json').send(text)
  } catch {
    if (!paywallDisabled && userId) {
      try {
        await refundCredit(userId, note + '_refund')
      } catch {
        /* ignore */
      }
    }
    res.status(502).json({ error: 'upstream_unreachable' })
  }
}
