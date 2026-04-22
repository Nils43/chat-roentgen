import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { getUnlock, setUnlock, type UnlockModule } from './_kv'

// Stripe webhook receiver. Two subtleties:
//
//   1. Signature verification requires the *raw* request bytes. Vercel parses
//      JSON by default, which would replace this with a reconstructed body and
//      break the signature. The `config.api.bodyParser = false` export below
//      disables that — we read the raw buffer ourselves.
//
//   2. Webhooks are retried on failure. The handler must be idempotent — we
//      check if the unlock record already exists and skip if so.

export const config = {
  api: {
    bodyParser: false,
  },
}

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer))
  }
  return Buffer.concat(chunks)
}

function isModule(v: unknown): v is UnlockModule {
  return v === 'profiles' || v === 'relationship' || v === 'bundle'
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
    // No webhook secret configured — dev-only path. Parse the body without
    // verifying signature. Never disable this in production.
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
    // Acknowledge other events so Stripe stops retrying, but no-op.
    res.status(200).json({ received: true, ignored: event.type })
    return
  }

  const session = event.data.object as Stripe.Checkout.Session
  // Runtime shape check — don't trust the TS cast. Stripe occasionally sends
  // `payment_status` variants; only `paid` counts. Refuse anything else so a
  // forged/mangled event can't mark a token unlocked.
  if (
    typeof session !== 'object' ||
    session === null ||
    (session as { object?: string }).object !== 'checkout.session' ||
    session.payment_status !== 'paid'
  ) {
    res.status(400).json({ error: 'invalid_session' })
    return
  }

  const token = session.client_reference_id ?? (session.metadata?.unlockToken as string | undefined)
  const rawModule = session.metadata?.module
  const mod = isModule(rawModule) ? rawModule : null

  // Match the token length our client generates (32 hex chars from
  // `crypto.randomUUID().replace(/-/g, '')`). Reject obviously wrong sizes.
  if (!token || typeof token !== 'string' || token.length < 16 || token.length > 128 || !mod) {
    res.status(400).json({ error: 'missing_metadata' })
    return
  }

  // Idempotency — a retry of an already-processed webhook must not reset `used`.
  const existing = await getUnlock(token)
  if (existing?.paid) {
    res.status(200).json({ received: true, duplicate: true })
    return
  }

  await setUnlock(token, {
    paid: true,
    used: false,
    module: mod,
    at: new Date().toISOString(),
  })

  res.status(200).json({ received: true })
}
