import type { ApiRequest, ApiResponse } from './types'
import { getSupabase } from '../auth/supabase'
import { i18n } from '../i18n'
import { friendlyError } from '../errors'

// Thin client for the Zone-2 proxy. The browser hits /api/analyze and the
// proxy holds the Anthropic key, spends a credit from the signed-in user's
// balance, and forwards. We attach the Supabase access token so the server
// knows whose credit to spend.

export class AnalyzeError extends Error {
  code: string
  status?: number
  constructor(code: string, message: string, status?: number) {
    super(message)
    this.name = 'AnalyzeError'
    this.code = code
    this.status = status
  }
}

export async function analyze(req: ApiRequest, signal?: AbortSignal): Promise<ApiResponse> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }

  // Attach the current Supabase access token if signed in. The server rejects
  // with 401 if it's missing (except in PAYWALL_DISABLED dev mode).
  try {
    const { data } = await getSupabase().auth.getSession()
    if (data.session?.access_token) {
      headers.authorization = `Bearer ${data.session.access_token}`
    }
  } catch {
    // Supabase env may not be configured in some dev modes — let the server
    // decide whether that's acceptable.
  }

  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers,
    body: JSON.stringify(req),
    signal,
  })

  const text = await res.text()
  const locale = i18n.get()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw new AnalyzeError('invalid_response', friendlyError('invalid_response', locale), res.status)
  }

  if (!res.ok) {
    const errBody = body as { error?: string; message?: string }
    const code = errBody.error ?? 'upstream_error'
    throw new AnalyzeError(code, friendlyError(code, locale, errBody.message), res.status)
  }

  return body as ApiResponse
}
