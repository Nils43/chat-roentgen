import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminClient, userFromAuthHeader } from './_supabase.js'

// Parallel-fan-out analyzer for the relationship tool. The main /api/analyze
// endpoint couldn't carry the full relationship schema inside Vercel's 60 s
// maxDuration — a single call needs ~4-5 k tokens of structured output and
// Haiku generates at ~90 tok/s, so we were sitting right at the edge and
// timed out often. This endpoint accepts N independent tool schemas, spends
// ONE credit, fires all Anthropic calls in parallel, and merges the tool_use
// inputs into a single payload. Each sub-call runs ~20-25 s, so parallel
// wall-clock stays around 25 s even for 3 chunks.

export const config = { maxDuration: 60 }

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MAX_BODY_BYTES = 500_000
// Per-chunk ceiling. Stays well inside the Vercel budget even if one chunk
// runs slow while the others finish fast.
const CHUNK_TIMEOUT_MS = 45_000

interface ChunkTool {
  name?: string
  description?: string
  input_schema?: Record<string, unknown>
}

interface Body {
  model?: string
  max_tokens?: number
  system?: string | unknown[]
  messages?: unknown[]
  chunks?: ChunkTool[]
}

function sendJsonError(res: VercelResponse, status: number, error: string, message?: string): void {
  res.status(status).setHeader('content-type', 'application/json').send(
    JSON.stringify(message ? { error, message } : { error }),
  )
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

// Result of a single sub-call. `input` is the tool_use argument object the
// model produced (may be empty / partial). `missing` lists required paths
// the sub-schema declared that the model omitted — the merge step fills
// those with defaults so the client never blows up on undefined.
interface ChunkResult {
  ok: boolean
  name: string
  keys: string[]
  input: Record<string, unknown>
  missing: string[]
  status: number
}

async function runChunk(
  key: string,
  chunk: ChunkTool,
  base: { model: string; max_tokens: number; system: Body['system']; messages: unknown[] },
  apiKey: string,
): Promise<ChunkResult> {
  const schema = (chunk.input_schema ?? {}) as Record<string, unknown>
  const requiredKeys = Array.isArray(schema.required) ? (schema.required as string[]) : []
  const request = {
    model: base.model,
    max_tokens: base.max_tokens,
    system: base.system,
    messages: base.messages,
    tools: [
      {
        name: chunk.name,
        description: chunk.description,
        input_schema: schema,
      },
    ],
    tool_choice: { type: 'tool', name: chunk.name },
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CHUNK_TIMEOUT_MS)
  let status = 0
  let input: Record<string, unknown> = {}
  try {
    const upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    })
    status = upstream.status
    const text = await upstream.text()
    if (upstream.ok) {
      try {
        const parsed = JSON.parse(text) as { content?: Array<{ type: string; input?: unknown }> }
        const toolUse = parsed.content?.find((b) => b.type === 'tool_use')
        if (toolUse?.input && typeof toolUse.input === 'object') {
          input = toolUse.input as Record<string, unknown>
        }
      } catch {
        // Leave input={} — merge step fills with defaults.
      }
    }
  } catch (err) {
    if (process.env.ROENTGEN_DEBUG) {
      const aborted = err instanceof Error && err.name === 'AbortError'
      console.warn(`[relationship] chunk ${key} ${aborted ? 'timed out' : 'failed'}`)
    }
  } finally {
    clearTimeout(timer)
  }
  // Validate and backfill against the sub-schema — each required field the
  // model dropped lands here, then gets a schema-default in the merged output.
  const missing = validateAgainstSchema(input, schema, '')
  const filled = applyDefaults(input, schema) as Record<string, unknown>
  return {
    ok: status >= 200 && status < 300 && Object.keys(input).length > 0,
    name: chunk.name ?? `chunk_${key}`,
    keys: requiredKeys,
    input: filled,
    missing,
    status,
  }
}

async function handlerInner(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') return sendJsonError(res, 405, 'method_not_allowed')

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return sendJsonError(res, 500, 'missing_env', 'ANTHROPIC_API_KEY not set on server')

  const paywallDisabled = process.env.PAYWALL_DISABLED === 'true'

  let userId: string | null = null
  if (!paywallDisabled) {
    if (!process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL) {
      return sendJsonError(res, 500, 'missing_env', 'SUPABASE_URL not set on server')
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return sendJsonError(res, 500, 'missing_env', 'SUPABASE_SERVICE_ROLE_KEY not set on server')
    }
    userId = await userFromAuthHeader(req.headers.authorization)
    if (!userId) return sendJsonError(res, 401, 'not_signed_in')
  }

  let body: Body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as Body)
  } catch {
    return sendJsonError(res, 400, 'invalid_json')
  }
  const bodySize = JSON.stringify(body).length
  if (bodySize > MAX_BODY_BYTES) return sendJsonError(res, 413, 'payload_too_large')

  const chunks = Array.isArray(body.chunks) ? body.chunks : []
  if (chunks.length === 0) return sendJsonError(res, 400, 'missing_chunks')

  const base = {
    model: typeof body.model === 'string' ? body.model : 'claude-haiku-4-5-20251001',
    max_tokens: typeof body.max_tokens === 'number' ? body.max_tokens : 2500,
    system: typeof body.system === 'string' || Array.isArray(body.system) ? body.system : undefined,
    messages: Array.isArray(body.messages) ? body.messages : [],
  }

  // Spend ONE credit regardless of how many chunks we're about to fire.
  if (!paywallDisabled && userId) {
    const sb = adminClient()
    const { data: spent, error: spendErr } = await sb.rpc('spend_credit', {
      p_account: userId,
      p_note: 'relationship',
    })
    if (spendErr) return sendJsonError(res, 500, 'spend_failed', spendErr.message)
    if (spent !== true) return sendJsonError(res, 402, 'insufficient_credits')
  }

  try {
    const results = await Promise.all(
      chunks.map((c, i) => runChunk(String.fromCharCode(97 + i), c, base, key)),
    )

    // If none of the chunks produced any tool_use at all, that's a total
    // failure — refund and bubble up.
    const anyOk = results.some((r) => r.ok)
    if (!anyOk) {
      if (!paywallDisabled && userId) {
        try { await refundCredit(userId, 'relationship_refund') } catch { /* swallow */ }
      }
      const anyStatus = results.find((r) => r.status > 0)?.status ?? 0
      const code = anyStatus === 0 ? 'upstream_unreachable' : 'analysis_incomplete'
      return sendJsonError(res, 502, code, `All ${results.length} chunks failed`)
    }

    // Merge chunk inputs into one object. Each chunk already had its own
    // backfill applied, so required fields exist (possibly as "—" defaults).
    const merged: Record<string, unknown> = {}
    let totalMissing = 0
    for (const r of results) {
      for (const k of r.keys) {
        if (k in r.input) merged[k] = r.input[k]
      }
      totalMissing += r.missing.length
    }

    // Shape the response like a real Anthropic messages reply so the client
    // can pluck the tool_use block with no special casing.
    const mergedResponse = {
      id: 'msg_merged',
      type: 'message',
      role: 'assistant',
      model: base.model,
      content: [
        {
          type: 'tool_use',
          id: 'toolu_merged',
          name: 'submit_relationship',
          input: merged,
        },
      ],
      stop_reason: 'tool_use',
      usage: {
        input_tokens: 0,
        output_tokens: 0,
      },
    }

    if (totalMissing > 0) {
      res.setHeader('x-roentgen-chunk-miss-count', String(totalMissing))
    }
    res
      .status(200)
      .setHeader('content-type', 'application/json')
      .send(JSON.stringify(mergedResponse))
  } catch (e) {
    if (!paywallDisabled && userId) {
      try { await refundCredit(userId, 'relationship_refund') } catch { /* swallow */ }
    }
    const msg = e instanceof Error ? e.message : 'upstream_unreachable'
    sendJsonError(res, 502, 'upstream_unreachable', msg)
  }
}

// --- Shared backfill / validation (mirrors api/analyze.ts). Kept local to
// avoid cross-file deps inside Vercel's function bundling.

function applyDefaults(value: unknown, schema: Record<string, unknown>): unknown {
  const type = schema.type as string | undefined
  if (type === 'object') {
    const obj = value && typeof value === 'object' && !Array.isArray(value)
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

function validateAgainstSchema(value: unknown, schema: Record<string, unknown>, path: string): string[] {
  const out: string[] = []
  const type = schema.type as string | string[] | undefined
  const isObj = type === 'object' || (Array.isArray(type) && type.includes('object'))
  const isArr = type === 'array' || (Array.isArray(type) && type.includes('array'))
  if (isObj) {
    const obj = value && typeof value === 'object' && !Array.isArray(value)
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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    await handlerInner(req, res)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!res.headersSent) sendJsonError(res, 500, 'server_exception', msg)
  }
}
