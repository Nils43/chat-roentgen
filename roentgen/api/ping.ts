import type { VercelRequest, VercelResponse } from '@vercel/node'

// Diagnostic endpoint. Zero imports beyond @vercel/node types. If this
// responds with 200 JSON, the Vercel Functions layer is alive; any further
// crash must be inside analyze.ts or its imports. Also echoes which env vars
// the server has set — keys only, never values, so leak-safe.
export default function handler(_req: VercelRequest, res: VercelResponse): void {
  const envKeys = Object.keys(process.env)
    .filter((k) =>
      k.startsWith('VITE_') ||
      k.startsWith('SUPABASE_') ||
      k.startsWith('STRIPE_') ||
      k === 'ANTHROPIC_API_KEY' ||
      k === 'PAYWALL_DISABLED',
    )
    .sort()
  res.status(200).setHeader('content-type', 'application/json').send(
    JSON.stringify({ ok: true, envKeys, time: new Date().toISOString() }),
  )
}
