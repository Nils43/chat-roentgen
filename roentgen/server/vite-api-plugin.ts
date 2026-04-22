import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Mounts the Vercel `api/*.ts` functions into the Vite dev server so the whole
// payment + analyze flow works with plain `npm run dev`. The same files are
// what Vercel runs in production — this plugin is only a thin adapter.

type Handler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>

interface AdaptOptions {
  parseBody: boolean
  extraQuery?: Record<string, string>
}

async function adapt(
  req: IncomingMessage,
  res: ServerResponse,
  opts: AdaptOptions,
): Promise<{ vReq: VercelRequest; vRes: VercelResponse }> {
  // --- Request sugar: populate .query and (optionally) .body ---
  const url = new URL(req.url ?? '', 'http://localhost')
  const query: Record<string, string | string[]> = {}
  for (const [k, v] of url.searchParams.entries()) query[k] = v
  if (opts.extraQuery) Object.assign(query, opts.extraQuery)

  let body: unknown = undefined
  if (opts.parseBody && req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    const raw = Buffer.concat(chunks).toString('utf-8')
    const ct = String(req.headers['content-type'] ?? '')
    if (ct.includes('application/json') && raw) {
      try {
        body = JSON.parse(raw)
      } catch {
        body = raw
      }
    } else {
      body = raw
    }
  }

  const vReq = req as unknown as VercelRequest & { query: Record<string, string | string[]>; body: unknown }
  vReq.query = query
  vReq.body = body

  // --- Response sugar: add .status() and .json() the Vercel helpers expect ---
  const vRes = res as unknown as VercelResponse
  ;(vRes as unknown as { status: (c: number) => VercelResponse }).status = (code: number) => {
    res.statusCode = code
    return vRes
  }
  ;(vRes as unknown as { json: (o: unknown) => VercelResponse }).json = (obj: unknown) => {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(obj))
    return vRes
  }
  ;(vRes as unknown as { send: (d: unknown) => VercelResponse }).send = (d: unknown) => {
    if (typeof d === 'string' || Buffer.isBuffer(d)) res.end(d)
    else res.end(JSON.stringify(d))
    return vRes
  }

  return { vReq, vRes }
}

function wrap(handler: Handler, opts: AdaptOptions) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const { vReq, vRes } = await adapt(req, res, opts)
      await handler(vReq, vRes)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      if (process.env.ROENTGEN_DEBUG) console.error('[api-dev]', msg, err)
      if (!res.headersSent) {
        res.statusCode = 500
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: 'internal', message: msg }))
      }
    }
  }
}

export function apiPlugin(): Plugin {
  return {
    name: 'roentgen-api-dev',
    async configureServer(server) {
      // Dynamic imports so we don't slow down Vite boot if api/ changes.
      const [{ default: analyze }, { default: checkout }, { default: webhook }, { default: ping }] =
        await Promise.all([
          import('../api/analyze'),
          import('../api/checkout'),
          import('../api/stripe-webhook'),
          import('../api/ping'),
        ])

      const analyzeHandler = wrap(analyze as Handler, { parseBody: true })
      const checkoutHandler = wrap(checkout as Handler, { parseBody: true })
      // Webhook reads the raw body stream itself — do NOT parse it here or the
      // signature check will fail.
      const webhookHandler = wrap(webhook as Handler, { parseBody: false })
      const pingHandler = wrap(ping as Handler, { parseBody: false })

      // Helper: 405 with a proper JSON body instead of falling through to
      // Vite's default handler, which would otherwise serve the transpiled
      // source of the api module when someone GETs a POST-only endpoint.
      const methodGuard = (
        expected: 'POST' | 'GET',
        body: (req: import('http').IncomingMessage, res: import('http').ServerResponse) => void,
      ) => (req: import('http').IncomingMessage, res: import('http').ServerResponse) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }
        if (req.method !== expected) {
          res.statusCode = 405
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'method_not_allowed' }))
          return
        }
        body(req, res)
      }

      server.middlewares.use('/api/analyze', methodGuard('POST', (req, res) => void analyzeHandler(req, res)))
      server.middlewares.use('/api/checkout', methodGuard('POST', (req, res) => void checkoutHandler(req, res)))
      server.middlewares.use('/api/stripe-webhook', methodGuard('POST', (req, res) => void webhookHandler(req, res)))
      server.middlewares.use('/api/ping', methodGuard('GET', (req, res) => void pingHandler(req, res)))
    },
  }
}
