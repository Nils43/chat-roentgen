import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminClient, userFromAuthHeader } from './_supabase.js'

// _supabase imports are static — Vercel's bundler only pulls in relative files
// that are statically imported; dynamic import() skips them and the function
// blows up at runtime with "Cannot find module". Module-load throws are still
// caught by the outer try/catch in the default export.

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

function sendJsonError(res: VercelResponse, status: number, error: string, message?: string): void {
  res.status(status).setHeader('content-type', 'application/json').send(
    JSON.stringify(message ? { error, message } : { error }),
  )
}

async function handlerInner(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') return sendJsonError(res, 405, 'method_not_allowed')

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return sendJsonError(res, 500, 'missing_env', 'ANTHROPIC_API_KEY not set on server')

  const paywallDisabled = process.env.PAYWALL_DISABLED === 'true'

  let userId: string | null = null
  if (!paywallDisabled) {
    // Config checks up front so the browser sees a specific cause instead of a
    // generic "function crashed" HTML page.
    if (!process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL) {
      return sendJsonError(res, 500, 'missing_env', 'SUPABASE_URL not set on server')
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return sendJsonError(res, 500, 'missing_env', 'SUPABASE_SERVICE_ROLE_KEY not set on server')
    }
    userId = await userFromAuthHeader(req.headers.authorization)
    if (!userId) return sendJsonError(res, 401, 'not_signed_in')
  }

  let body: AnthropicBody
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as AnthropicBody)
  } catch {
    return sendJsonError(res, 400, 'invalid_json')
  }

  const bodySize = JSON.stringify(body).length
  if (bodySize > MAX_BODY_BYTES) return sendJsonError(res, 413, 'payload_too_large')

  const note = noteForTool(toolName(body))

  if (!paywallDisabled && userId) {
    const sb = adminClient()
    const { data: spent, error: spendErr } = await sb.rpc('spend_credit', {
      p_account: userId,
      p_note: note,
    })
    if (spendErr) {
      return sendJsonError(res, 500, 'spend_failed', spendErr.message)
    }
    if (spent !== true) return sendJsonError(res, 402, 'insufficient_credits')
  }

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
    // Retry strategy — goal: credit is ONLY kept when the user walks away
    // with a fully-valid response. Anything short of that and we refund.
    //
    // Cost model: system prompt is cached (90% off on retries within 5min),
    // so retry #2 and #3 mostly pay for user-message input + output tokens.
    // Per retry we append a ~50-token hint telling the model which required
    // fields it omitted — massively boosts attempt-2 success without doubling
    // input cost. Worst case 3 Haiku 4.5 calls ≈ €0.05, vs €3 credit price.
    const schema =
      Array.isArray(forward.tools) && forward.tools[0] && typeof forward.tools[0] === 'object'
        ? ((forward.tools[0] as { input_schema?: unknown }).input_schema as Record<string, unknown> | undefined)
        : undefined
    const MAX_ATTEMPTS = 3
    let upstream: Response | null = null
    let bestText = ''
    let bestStatus = 0
    let bestMiss: string[] | null = null // null = never got a parseable 200
    let lastMiss: string[] = []

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const bodyForAttempt = attempt === 1 ? forward : buildRetryBody(forward, lastMiss)
      upstream = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(bodyForAttempt),
      })
      const text = await upstream.text()

      if (!upstream.ok) {
        // 5xx → transient, retry. 4xx → auth/schema/quota, retrying won't help.
        if (upstream.status >= 500 && attempt < MAX_ATTEMPTS) continue
        bestText = text
        bestStatus = upstream.status
        break
      }

      if (!schema) {
        // No schema means we can't validate — assume the 200 is good enough.
        bestText = text
        bestStatus = 200
        bestMiss = []
        break
      }

      const missing = validateToolUse(text, schema)
      // Track the attempt that came closest to valid, in case all attempts miss
      // something — we still have the least-broken payload to inspect server-side.
      if (bestMiss === null || missing.length < bestMiss.length) {
        bestText = text
        bestStatus = 200
        bestMiss = missing
      }
      lastMiss = missing
      if (missing.length === 0) break
      if (process.env.ROENTGEN_DEBUG) {
        console.warn(`[analyze] retry ${attempt}/${MAX_ATTEMPTS} — missing:`, missing.join(', '))
      }
    }

    // Success = upstream 2xx AND (no schema OR validation passed on some attempt).
    const success = bestStatus >= 200 && bestStatus < 300 && (bestMiss?.length ?? 0) === 0
    if (!success) {
      // Refund — user should never pay for an unusable result.
      if (!paywallDisabled && userId) {
        try { await refundCredit(userId, note + '_refund') } catch { /* swallow */ }
      }
      const code = bestStatus === 0 ? 'upstream_unreachable' : 'analysis_incomplete'
      const diagnostic =
        bestMiss && bestMiss.length > 0
          ? `Missing after ${MAX_ATTEMPTS} attempts: ${bestMiss.slice(0, 5).join(', ')}`
          : `Upstream returned ${bestStatus}`
      if (bestMiss && bestMiss.length > 0) {
        res.setHeader('x-roentgen-validation-miss', bestMiss.slice(0, 5).join(','))
      }
      return sendJsonError(res, bestStatus === 0 ? 502 : 502, code, diagnostic)
    }

    res.status(bestStatus).setHeader('content-type', 'application/json').send(bestText)
  } catch (e) {
    if (!paywallDisabled && userId) {
      try { await refundCredit(userId, note + '_refund') } catch { /* swallow */ }
    }
    const msg = e instanceof Error ? e.message : 'upstream_unreachable'
    sendJsonError(res, 502, 'upstream_unreachable', msg)
  }
}

// Append a brief retry hint to the last user message. Cheap (~50 tokens),
// lifts attempt-2 success rate significantly because the model now knows
// exactly which required fields it dropped.
function buildRetryBody(base: AnthropicBody & { messages?: unknown[] }, missing: string[]): typeof base {
  if (missing.length === 0) return base
  const messages = Array.isArray(base.messages) ? base.messages.slice() : []
  const lastIdx = messages.length - 1
  const last = messages[lastIdx] as { role?: string; content?: unknown } | undefined
  if (!last || last.role !== 'user') return base
  const hint = `\n\n[RETRY — previous tool_use omitted these required fields: ${missing.slice(0, 10).join(', ')}. Populate every required field this time, no placeholders, no skipping.]`
  if (typeof last.content === 'string') {
    messages[lastIdx] = { ...last, content: last.content + hint }
  } else if (Array.isArray(last.content)) {
    messages[lastIdx] = { ...last, content: [...last.content, { type: 'text', text: hint }] }
  } else {
    return base
  }
  return { ...base, messages }
}

// Walk Anthropic's response JSON, find the tool_use block, and validate its
// input against the JSON-schema we sent. Returns a list of missing-or-empty
// required paths (e.g. "bids.interpretation"). Empty = all good.
function validateToolUse(responseText: string, schema: Record<string, unknown>): string[] {
  type ToolUse = { type: 'tool_use'; input: unknown }
  type ContentBlock = { type: string } & Partial<ToolUse>
  let parsed: { content?: ContentBlock[] }
  try {
    parsed = JSON.parse(responseText) as { content?: ContentBlock[] }
  } catch {
    return ['root:unparsable']
  }
  const toolUse = parsed.content?.find((b) => b.type === 'tool_use')
  if (!toolUse || !toolUse.input) return ['root:no_tool_use']
  return validateAgainstSchema(toolUse.input, schema, '')
}

function validateAgainstSchema(value: unknown, schema: Record<string, unknown>, path: string): string[] {
  const out: string[] = []
  const type = schema.type as string | string[] | undefined
  const isObj = type === 'object' || (Array.isArray(type) && type.includes('object'))
  const isArr = type === 'array' || (Array.isArray(type) && type.includes('array'))
  if (isObj) {
    const obj = (value && typeof value === 'object' && !Array.isArray(value))
      ? (value as Record<string, unknown>)
      : null
    const required = Array.isArray(schema.required) ? (schema.required as string[]) : []
    const properties = (schema.properties as Record<string, Record<string, unknown>> | undefined) ?? {}
    for (const key of required) {
      const sub = path ? `${path}.${key}` : key
      const v = obj ? obj[key] : undefined
      if (v === undefined || v === null) {
        out.push(sub)
        continue
      }
      if (typeof v === 'string' && v.trim() === '') {
        out.push(sub)
        continue
      }
      const childSchema = properties[key]
      if (childSchema) out.push(...validateAgainstSchema(v, childSchema, sub))
    }
  } else if (isArr) {
    const minItems = typeof schema.minItems === 'number' ? schema.minItems : 0
    if (!Array.isArray(value)) {
      out.push(path + ':not_array')
    } else {
      if (value.length < minItems) out.push(path + ':too_few')
      const items = schema.items as Record<string, unknown> | undefined
      if (items) {
        value.forEach((item, i) => out.push(...validateAgainstSchema(item, items, `${path}[${i}]`)))
      }
    }
  }
  return out
}

// Outer wrapper: any uncaught throw (e.g. adminClient() with bad env, DNS,
// Supabase reject) is serialized as JSON instead of Vercel's HTML crash page.
// Without this the browser sees "Proxy did not return JSON" and has no clue.
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    await handlerInner(req, res)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!res.headersSent) sendJsonError(res, 500, 'server_exception', msg)
  }
}
