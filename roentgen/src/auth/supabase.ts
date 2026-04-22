import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'

// Lazy, singleton Supabase client. We only need one browser instance.
// The anon (publishable) key is PUBLIC by design — it's rate-limited and only
// grants access behind Row Level Security policies. Never commit the
// `service_role` / `sb_secret_...` key to the client bundle.

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let cached: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (cached) return cached
  if (!URL || !ANON_KEY) {
    throw new Error(
      'Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    )
  }
  cached = createClient(URL, ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Store session in localStorage, keyed so we don't collide with other
      // tea.* entries. Supabase's default is `sb-<project>-auth-token`.
      storageKey: 'tea.supabase.auth',
    },
  })
  return cached
}

export type { Session, SupabaseClient }
