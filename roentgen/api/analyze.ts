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
    // Call Anthropic with internal retry: the model occasionally returns a
    // tool_use missing required fields (flakes on structured output), or the
    // API itself hiccups with a 5xx. We retry silently up to twice — the user
    // already paid the one credit, retries are on the house.
    const schema =
      Array.isArray(forward.tools) && forward.tools[0] && typeof forward.tools[0] === 'object'
        ? ((forward.tools[0] as { input_schema?: unknown }).input_schema as Record<string, unknown> | undefined)
        : undefined
    let attempt = 0
    let upstream: Response | null = null
    let responseText = ''
    let lastValidationMiss: string[] = []
    const MAX_ATTEMPTS = 3
    while (attempt < MAX_ATTEMPTS) {
      attempt++
      upstream = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(forward),
      })
      responseText = await upstream.text()
      if (!upstream.ok) {
        // 5xx → transient, try again. 4xx → model/schema issue, don't waste retries.
        if (upstream.status >= 500 && attempt < MAX_ATTEMPTS) continue
        break
      }
      // 200-class: validate tool_use if a schema was provided.
      if (!schema) break
      const missing = validateToolUse(responseText, schema)
      if (missing.length === 0) break
      lastValidationMiss = missing
      if (process.env.ROENTGEN_DEBUG) {
        console.warn(`[analyze] retry ${attempt}/${MAX_ATTEMPTS} — missing:`, missing.join(', '))
      }
    }
    // Only refund if the final response failed upstream. A valid 200 with some
    // missing fields still uses the credit — we return partial data, client
    // surfaces it, user got a best-effort result.
    const ok = !!upstream && upstream.ok
    if (!ok && !paywallDisabled && userId) {
      try { await refundCredit(userId, note + '_refund') } catch { /* swallow */ }
    }
    // Debug header surfaces retry state to the client without changing the body.
    if (lastValidationMiss.length > 0) {
      res.setHeader('x-roentgen-validation-miss', lastValidationMiss.slice(0, 5).join(','))
    }
    res.status(upstream?.status ?? 502).setHeader('content-type', 'application/json').send(responseText)
  } catch (e) {
    if (!paywallDisabled && userId) {
      try { await refundCredit(userId, note + '_refund') } catch { /* swallow */ }
    }
    const msg = e instanceof Error ? e.message : 'upstream_unreachable'
    sendJsonError(res, 502, 'upstream_unreachable', msg)
  }
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
