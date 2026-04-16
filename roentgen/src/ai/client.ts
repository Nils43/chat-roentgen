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

export async function analyze(req: ApiRequest, signal?: AbortSignal): Promise<ApiResponse> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })

  const text = await res.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw new AnalyzeError('invalid_response', 'Proxy hat kein JSON zurückgegeben.', res.status)
  }

  if (!res.ok) {
    const errBody = body as { error?: string; message?: string }
    throw new AnalyzeError(
      errBody.error ?? 'upstream_error',
      errBody.message ?? `Request fehlgeschlagen (${res.status}).`,
      res.status,
    )
  }

  return body as ApiResponse
}
