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
// credits stay). Signed-out / already-permanent users get plain OAuth.
export async function signInWithGoogle(): Promise<void> {
  const sb = getSupabase()
  const { data: { session } } = await sb.auth.getSession()
  const redirectTo = window.location.origin

  if (session?.user?.is_anonymous) {
    const { error } = await sb.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo },
    })
    if (!error) return
    // linkIdentity failed (most likely: that Google account is already
    // linked elsewhere). Fall through to plain OAuth — credits bought on
    // this anon session will orphan, but the user can at least proceed.
    console.warn('[auth] linkIdentity failed, falling back to OAuth:', error.message)
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
