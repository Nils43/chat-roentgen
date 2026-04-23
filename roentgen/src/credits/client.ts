import { getSupabase } from '../auth/supabase'
import { i18n } from '../i18n'
import { friendlyError } from '../errors'
import type { Pack } from './packs'

// Ask the server to create a Stripe Checkout session for the chosen pack.
// The server receives the authenticated user via the Supabase access token
// in the Authorization header; it uses that identity to stamp the session
// metadata so the webhook credits the right account.
export async function startPackCheckout(pack: Pack): Promise<{ clientSecret: string }> {
  const sb = getSupabase()
  const { data } = await sb.auth.getSession()
  const access = data.session?.access_token
  const locale = i18n.get()
  if (!access) throw new Error(friendlyError('not_signed_in', locale))

  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${access}`,
    },
    body: JSON.stringify({ packId: pack.id }),
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
    throw new Error(friendlyError(body.error, locale, body.message))
  }
  return (await res.json()) as { clientSecret: string }
}
