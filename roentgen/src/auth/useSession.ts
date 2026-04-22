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

    sb.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session ?? null)
    })

    const { data } = sb.auth.onAuthStateChange((event, nextSession) => {
      if (mounted) setSession(nextSession ?? null)
      // The DB trigger on auth.users is unreliable across auth providers
      // (especially OAuth), so we force the account row ourselves every time
      // a session lands. Idempotent: `on conflict do nothing`.
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

// Kick off the Google OAuth redirect. The browser navigates to Google, the
// user authorizes, Supabase bounces back to the same origin with the session
// in the URL hash — picked up automatically by the SDK on the next load.
export async function signInWithGoogle(): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw new Error(error.message)
}

export async function signOut(): Promise<void> {
  const sb = getSupabase()
  await sb.auth.signOut()
}
