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

// Give the function enough headroom for 1–3 Anthropic calls. Without this,
// Vercel's default (10–15 s) kills the process mid-analysis, after the credit
// was spent but before the refund path runs → user loses the credit.
export const config = { maxDuration: 60 }

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MAX_BODY_BYTES = 500_000
// Leave ~5 s headroom before maxDuration so the refund + response always ship.
const TOTAL_DEADLINE_MS = 55_000

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
    // Both tools run on Haiku now, which is cheap enough ($0.02-0.05/call)
    // that 3 attempts stay well under the €0.10 credit cost. The outer
    // deadline check below breaks the loop early if there's no time left,
    // so the retry count is a ceiling rather than a commitment.
    const MAX_ATTEMPTS = 3
    let upstream: Response | null = null
    let bestText = ''
    let bestStatus = 0
    let bestMiss: string[] | null = null // null = never got a parseable 200
    let lastMiss: string[] = []
    const startTime = Date.now()

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // Refund-safety: bail out if we're close to the Vercel deadline so the
      // refund path always has room to run. Better a "incomplete" response
      // with refund than a killed function with a stolen credit.
      const elapsed = Date.now() - startTime
      if (elapsed > TOTAL_DEADLINE_MS - 5_000) break

      const bodyForAttempt = attempt === 1 ? forward : buildRetryBody(forward, lastMiss)
      const controller = new AbortController()
      const remaining = TOTAL_DEADLINE_MS - elapsed
      // Each attempt gets a fair share of the remaining deadline. For a
      // single-attempt tool (e.g. submit_relationship on Sonnet) this is
      // almost the full 55 s, which covers Sonnet's 5k-token output runs.
      // For 3-attempt tools the first attempt gets ~18 s — enough for Haiku.
      const attemptsLeft = MAX_ATTEMPTS - attempt + 1
      const perAttemptBudget = Math.max(5_000, Math.floor((remaining - 2_000) / attemptsLeft))
      const timer = setTimeout(() => controller.abort(), perAttemptBudget)
      let text = ''
      try {
        upstream = await fetch(ANTHROPIC_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(bodyForAttempt),
          signal: controller.signal,
        })
        text = await upstream.text()
      } catch (err) {
        const aborted = err instanceof Error && err.name === 'AbortError'
        if (process.env.ROENTGEN_DEBUG) {
          console.warn(`[analyze] attempt ${attempt}/${MAX_ATTEMPTS} ${aborted ? 'timed out' : 'failed'}`)
        }
        // Try again if we have budget + attempts left; otherwise fall through
        // with upstream=null so the "no success" branch refunds.
        if (attempt < MAX_ATTEMPTS) continue
        upstream = null
        break
      } finally {
        clearTimeout(timer)
      }

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

    // Policy: the user must never see an error on the result page. After all
    // retries, if we have ANY parseable 200 response (even with some missing
    // fields), we backfill the schema defaults and ship it — a slightly bare
    // section is better than a "something went wrong". Refund only triggers
    // on total failure: non-2xx across all attempts, or 200 with no tool_use.
    const status2xx = bestStatus >= 200 && bestStatus < 300
    const hasAnyToolUse = status2xx && bestMiss !== null && !bestMiss.includes('root:no_tool_use')

    if (!status2xx || !hasAnyToolUse) {
      if (!paywallDisabled && userId) {
        try { await refundCredit(userId, note + '_refund') } catch { /* swallow */ }
      }
      const code = bestStatus === 0 ? 'upstream_unreachable' : 'analysis_incomplete'
      const diagnostic =
        bestStatus === 0
          ? 'Upstream unreachable'
          : `Upstream returned ${bestStatus} with no tool_use`
      return sendJsonError(res, 502, code, diagnostic)
    }

    // Fill defaults for any missing required fields so the client always sees
    // a structurally complete object. Surface the miss list via header so we
    // can watch for model patterns in logs without changing the body shape.
    if (bestMiss && bestMiss.length > 0 && schema) {
      res.setHeader('x-roentgen-validation-miss', bestMiss.slice(0, 5).join(','))
      bestText = backfillDefaults(bestText, schema)
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

// Rewrite the Anthropic response with a tool_use input where every missing
// required field has been filled from the schema defaults (empty string,
// 0, false, [], first enum value, recursively for nested objects). The
// client then sees a structurally complete payload even if the model
// skipped a sub-section — UI renders "—" / empty array etc instead of
// crashing on undefined. Non-tool_use blocks are passed through unchanged.
function backfillDefaults(responseText: string, schema: Record<string, unknown>): string {
  try {
    const parsed = JSON.parse(responseText) as { content?: Array<{ type: string; input?: unknown }> }
    const blocks = parsed.content ?? []
    for (const b of blocks) {
      if (b.type === 'tool_use' && b.input !== undefined) {
        b.input = applyDefaults(b.input, schema)
      }
    }
    return JSON.stringify(parsed)
  } catch {
    return responseText
  }
}

function applyDefaults(value: unknown, schema: Record<string, unknown>): unknown {
  const type = schema.type as string | undefined
  if (type === 'object') {
    const obj = (value && typeof value === 'object' && !Array.isArray(value))
      ? { ...(value as Record<string, unknown>) }
      : {}
    const required = Array.isArray(schema.required) ? (schema.required as string[]) : []
    const properties = (schema.properties as Record<string, Record<string, unknown>> | undefined) ?? {}
    for (const key of required) {
      const childSchema = properties[key]
      if (!childSchema) continue
      if (!(key in obj) || obj[key] == null) {
        obj[key] = defaultForSchema(childSchema)
      } else {
        obj[key] = applyDefaults(obj[key], childSchema)
      }
    }
    return obj
  }
  if (type === 'array') {
    const items = schema.items as Record<string, unknown> | undefined
    const arr = Array.isArray(value) ? value.slice() : []
    const minItems = typeof schema.minItems === 'number' ? schema.minItems : 0
    while (arr.length < minItems && items) arr.push(defaultForSchema(items))
    if (items) return arr.map((v) => applyDefaults(v, items))
    return arr
  }
  if (type === 'string' && (typeof value !== 'string' || value.trim() === '')) {
    return defaultForSchema(schema)
  }
  return value
}

function defaultForSchema(schema: Record<string, unknown>): unknown {
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0]
  const type = schema.type as string | string[] | undefined
  const t = Array.isArray(type) ? type[0] : type
  if (t === 'string') return '—'
  if (t === 'integer' || t === 'number') return 0
  if (t === 'boolean') return false
  if (t === 'array') return []
  if (t === 'object') {
    const out: Record<string, unknown> = {}
    const required = Array.isArray(schema.required) ? (schema.required as string[]) : []
    const properties = (schema.properties as Record<string, Record<string, unknown>> | undefined) ?? {}
    for (const key of required) {
      const childSchema = properties[key]
      if (childSchema) out[key] = defaultForSchema(childSchema)
    }
    return out
  }
  return null
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
