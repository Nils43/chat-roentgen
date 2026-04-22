import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Server-only Supabase client. Uses the service_role key so it can bypass
// Row-Level-Security when the webhook needs to write transactions on behalf
// of a user it hasn't authenticated. Keep this file on the server.

const URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

let cached: SupabaseClient | null = null

export function adminClient(): SupabaseClient {
  if (cached) return cached
  if (!URL || !SERVICE) {
    throw new Error(
      'Supabase admin env missing. Need VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.',
    )
  }
  cached = createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}

// Resolve the signed-in user from an `Authorization: Bearer <access_token>`
// header by asking Supabase to validate the JWT. Returns the auth user id or
// null if the token is missing/invalid.
export async function userFromAuthHeader(
  authHeader: string | string[] | undefined,
): Promise<string | null> {
  const value = Array.isArray(authHeader) ? authHeader[0] : authHeader
  if (!value || !value.startsWith('Bearer ')) return null
  const token = value.slice('Bearer '.length).trim()
  if (!token) return null
  const sb = adminClient()
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}
