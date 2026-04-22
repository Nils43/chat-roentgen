import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { adminClient } from './_supabase'

// Stripe webhook receiver. Two subtleties:
//   1. Signature verification requires the *raw* request bytes. Vercel parses
//      JSON by default, which would break the signature. `bodyParser: false`
//      disables that — we read the raw buffer ourselves.
//   2. Retries: webhooks fire again on non-2xx. The `grant_credits` RPC is
//      idempotent on `stripe_session_id`, so replays are safe.

export const config = { api: { bodyParser: false } }

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer))
  }
  return Buffer.concat(chunks)
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const secret = process.env.STRIPE_SECRET_KEY
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    res.status(500).json({ error: 'missing_stripe_config' })
    return
  }

  const stripe = new Stripe(secret)
  const raw = await readRawBody(req)

  let event: Stripe.Event
  if (whSecret) {
    const sig = req.headers['stripe-signature']
    if (!sig || typeof sig !== 'string') {
      res.status(400).json({ error: 'missing_signature' })
      return
    }
    try {
      event = stripe.webhooks.constructEvent(raw, sig, whSecret)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      res.status(400).json({ error: 'invalid_signature', message: msg })
      return
    }
  } else {
    // Dev path: no secret set. Never allowed in production.
    if (process.env.NODE_ENV === 'production') {
      res.status(500).json({ error: 'missing_webhook_secret_in_prod' })
      return
    }
    try {
      event = JSON.parse(raw.toString('utf-8')) as Stripe.Event
    } catch {
      res.status(400).json({ error: 'invalid_json' })
      return
    }
  }

  if (event.type !== 'checkout.session.completed') {
    res.status(200).json({ received: true, ignored: event.type })
    return
  }

  const session = event.data.object as Stripe.Checkout.Session
  if (
    typeof session !== 'object' ||
    session === null ||
    (session as { object?: string }).object !== 'checkout.session' ||
    session.payment_status !== 'paid'
  ) {
    res.status(400).json({ error: 'invalid_session' })
    return
  }

  const accountId = session.client_reference_id ?? (session.metadata?.accountId as string | undefined)
  const packId = session.metadata?.packId
  const tokens = Number(session.metadata?.tokens ?? 0)

  if (!accountId || !packId || !tokens || !Number.isFinite(tokens) || tokens <= 0) {
    res.status(400).json({ error: 'missing_metadata' })
    return
  }

  // Call the Postgres RPC — atomic, idempotent on session.id.
  const sb = adminClient()
  const { data, error } = await sb.rpc('grant_credits', {
    p_account: accountId,
    p_delta: tokens,
    p_session_id: session.id,
    p_note: packId,
  })
  if (error) {
    res.status(500).json({ error: 'grant_failed', message: error.message })
    return
  }

  res.status(200).json({ received: true, granted: data === true })
}
