import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { userFromAuthHeader } from './_supabase.js'

// Create a Stripe Checkout session for a credit pack. The browser has already
// signed the user in via Supabase phone auth and sends the access token in the
// Authorization header — we use that to stamp the resulting session with the
// user's auth.users.id so the webhook knows who to credit.

type PackId = 'pack_1' | 'pack_3' | 'pack_10'

const PACK_PRICE: Record<PackId, string | undefined> = {
  pack_1: process.env.STRIPE_PRICE_PACK_1,
  pack_3: process.env.STRIPE_PRICE_PACK_3,
  pack_10: process.env.STRIPE_PRICE_PACK_10,
}

const PACK_TOKENS: Record<PackId, number> = {
  pack_1: 1,
  pack_3: 3,
  pack_10: 10,
}

function isPackId(v: unknown): v is PackId {
  return v === 'pack_1' || v === 'pack_3' || v === 'pack_10'
}

interface Body {
  packId?: unknown
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    res.status(500).json({ error: 'missing_stripe_key' })
    return
  }

  const userId = await userFromAuthHeader(req.headers.authorization)
  if (!userId) {
    res.status(401).json({ error: 'not_signed_in' })
    return
  }

  let body: Body
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  } catch {
    res.status(400).json({ error: 'invalid_json' })
    return
  }

  const pack = body.packId
  if (!isPackId(pack)) {
    res.status(400).json({ error: 'invalid_pack' })
    return
  }

  const priceId = PACK_PRICE[pack]
  if (!priceId) {
    res.status(500).json({ error: 'missing_price_id', pack })
    return
  }

  const stripe = new Stripe(secret)
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ui_mode: 'embedded_page',
      redirect_on_completion: 'never',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      metadata: {
        accountId: userId,
        packId: pack,
        tokens: String(PACK_TOKENS[pack]),
      },
      automatic_tax: { enabled: false },
    })
    if (!session.client_secret) {
      res.status(500).json({ error: 'no_client_secret' })
      return
    }
    res.status(200).json({ clientSecret: session.client_secret })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'stripe_error'
    res.status(500).json({ error: 'stripe_error', message: msg })
  }
}
