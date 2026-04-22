import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabase } from './supabase'

// React hook exposing the current Supabase auth session. Re-renders on sign-in,
// sign-out, and token refresh via Supabase's `onAuthStateChange` subscription.
//
// `null` = signed out, `undefined` = still loading (first render before the
// client has had a chance to hydrate from storage).

export function useSession(): { session: Session | null | undefined; loading: boolean } {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    const sb = getSupabase()
    let mounted = true

    // Initial read from storage (synchronous-ish — returns quickly).
    sb.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session ?? null)
    })

    const { data } = sb.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession ?? null)
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  return { session, loading: session === undefined }
}

// Imperative helpers. Used from buttons, not from render.

export async function sendSmsOtp(phone: string): Promise<void> {
  const sb = getSupabase()
  // Supabase signInWithOtp sends an SMS via the configured provider (Twilio).
  // If the phone has never signed in before, a new auth.users row is created.
  const { error } = await sb.auth.signInWithOtp({
    phone,
    options: { channel: 'sms' },
  })
  if (error) throw new Error(error.message)
}

export async function verifySmsOtp(phone: string, token: string): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb.auth.verifyOtp({ phone, token, type: 'sms' })
  if (error) throw new Error(error.message)
}

export async function signOut(): Promise<void> {
  const sb = getSupabase()
  await sb.auth.signOut()
}

// Normalize phone input to E.164 ("+49…"). Accepts common German patterns so
// users can type the way they're used to ("0170 1234567" / "+49 170 1234567").
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.replace(/\s+/g, '').replace(/[-()]/g, '')
  if (!trimmed) return null
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed
  // "0170…" → "+49170…"
  if (/^0\d{6,14}$/.test(trimmed)) return '+49' + trimmed.slice(1)
  return null
}
