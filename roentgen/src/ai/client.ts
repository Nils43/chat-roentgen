import type { ApiRequest, ApiResponse } from './types'

// Thin client for the Zone-2 proxy. Browser hits /api/analyze.
// The proxy is responsible for holding the Anthropic key and forwarding.
// This module must not do any persistence or logging of request bodies.

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

export async function analyze(
  req: ApiRequest,
  signal?: AbortSignal,
  unlockToken?: string,
): Promise<ApiResponse> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (unlockToken) headers['x-unlock-token'] = unlockToken
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers,
    body: JSON.stringify(req),
    signal,
  })

  const text = await res.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw new AnalyzeError('invalid_response', 'Proxy did not return JSON.', res.status)
  }

  if (!res.ok) {
    const errBody = body as { error?: string; message?: string }
    throw new AnalyzeError(
      errBody.error ?? 'upstream_error',
      errBody.message ?? `Request failed (${res.status}).`,
      res.status,
    )
  }

  return body as ApiResponse
}
