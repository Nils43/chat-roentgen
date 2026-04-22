import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import type { UnlockModule } from './_kv'

// Creates a Stripe Checkout Session and returns the hosted URL.
//
// The browser generates an `unlockToken` (UUID) and includes it in the body —
// it ends up as `client_reference_id` + in session metadata. After the session
// completes, the Stripe webhook looks up the token and writes a paid record to
// KV. The client polls /api/unlock/:token after redirect and then unlocks the
// corresponding module locally.

const PRICE_ID: Record<UnlockModule, string | undefined> = {
  profiles: process.env.STRIPE_PRICE_PROFILES,
  relationship: process.env.STRIPE_PRICE_RELATIONSHIP,
  bundle: process.env.STRIPE_PRICE_BUNDLE,
}

interface Body {
  unlockToken?: unknown
  module?: unknown
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
  if (!secret) {
    res.status(500).json({ error: 'missing_stripe_key' })
    return
  }

  let body: Body
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  } catch {
    res.status(400).json({ error: 'invalid_json' })
    return
  }
  const token = typeof body.unlockToken === 'string' ? body.unlockToken : null
  const mod = isModule(body.module) ? body.module : null

  if (!token || token.length < 16) {
    res.status(400).json({ error: 'invalid_token' })
    return
  }
  if (!mod) {
    res.status(400).json({ error: 'invalid_module' })
    return
  }

  const priceId = PRICE_ID[mod]
  if (!priceId) {
    res.status(500).json({ error: 'missing_price_id', module: mod })
    return
  }

  const stripe = new Stripe(secret)

  try {
    // Embedded checkout: Stripe's form renders inside our modal instead of
    // redirecting. `redirect_on_completion: 'never'` pairs with an `onComplete`
    // callback in the client — no success_url hop.
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ui_mode: 'embedded_page',
      redirect_on_completion: 'never',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: token,
      metadata: { unlockToken: token, module: mod },
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
