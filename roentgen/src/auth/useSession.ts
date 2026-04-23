import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabase } from './supabase'

// Auth model: every visitor gets an **anonymous** Supabase session on first
// load so they can buy credits before "signing up". When they finally click
// "sign in with Google", we call linkIdentity on the anonymous user — the
// Supabase user id stays the same, so any credits already bought stick to
// the account. If linkIdentity fails (e.g. the Google account is already
// bound to another profile), we fall back to plain signInWithOAuth.

export function useSession(): { session: Session | null | undefined; loading: boolean } {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    const sb = getSupabase()
    let mounted = true

    sb.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      if (data.session) {
        setSession(data.session)
        return
      }
      // No session — sign in anonymously so the user can transact immediately.
      try {
        const { data: anonData, error } = await sb.auth.signInAnonymously()
        if (mounted) setSession(!error ? (anonData.session ?? null) : null)
      } catch {
        if (mounted) setSession(null)
      }
    })

    const { data } = sb.auth.onAuthStateChange((event, nextSession) => {
      if (mounted) setSession(nextSession ?? null)
      // Ensure the accounts row exists after every sign-in (anonymous or real).
      if (event === 'SIGNED_IN' && nextSession) {
        void sb.rpc('ensure_account')
      }
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  return { session, loading: session === undefined }
}

// "Sign in with Google" — anonymous users get linkIdentity (upgrade in place,
// credits stay attached to the same user id). Already-permanent users get
// plain OAuth. There is NO silent fallback from linkIdentity → OAuth: the
// fallback used to swap the session out to a fresh user, orphaning every
// credit the anonymous session had just bought. If linkIdentity errors we
// surface it and keep the anon session intact so the user's credits stay safe.
export async function signInWithGoogle(): Promise<void> {
  const sb = getSupabase()
  const { data: { session } } = await sb.auth.getSession()
  const redirectTo = window.location.origin

  if (session?.user?.is_anonymous) {
    const { error } = await sb.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) {
      throw new Error(
        `Couldn't link Google to this browser session: ${error.message}. Your credits are still here — try again, or contact support.`,
      )
    }
    return
  }

  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
  if (error) throw new Error(error.message)
}

export async function signOut(): Promise<void> {
  const sb = getSupabase()
  await sb.auth.signOut()
}
