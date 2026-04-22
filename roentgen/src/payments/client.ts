// Client side of the unlock/paywall system. Wraps:
//   • local persistence of receipts (one per checkout) in localStorage
//   • /api/checkout redirect flow
//   • post-return polling of /api/unlock/:token
//   • lookup: "do I have a usable token for this module?"
//
// The source of truth for "paid" lives server-side in Vercel KV. The local
// receipt is a navigation cache — it lets us avoid round-trips and render the
// correct state on reload. `/api/analyze` always re-validates the token.

export type UnlockModule = 'profiles' | 'relationship' | 'bundle'
export type AnalysisModule = 'profiles' | 'relationship'

export interface Receipt {
  token: string
  module: UnlockModule
  paid: boolean
  createdAt: string
  /** For bundle: which halves have been spent on this device. Server enforces this too. */
  spent?: AnalysisModule[]
}

const STORAGE_KEY = 'roentgen.receipts.v1'

function readAll(): Receipt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Receipt[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(list: Receipt[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // Receipts are tiny — if localStorage is full, something else is wrong.
  }
}

export function generateToken(): string {
  // crypto.randomUUID exists on every browser where IndexedDB also works.
  return crypto.randomUUID().replace(/-/g, '')
}

export function saveReceipt(r: Receipt): void {
  const list = readAll()
  const next = [r, ...list.filter((x) => x.token !== r.token)].slice(0, 50)
  writeAll(next)
}

export function listReceipts(): Receipt[] {
  return readAll()
}

export function getReceipt(token: string): Receipt | null {
  return readAll().find((r) => r.token === token) ?? null
}

/**
 * A receipt is usable for an analysis module if:
 *   - it is paid
 *   - its `module` is that module OR it's a bundle with the half still unspent
 */
export function findUsableReceipt(analysis: AnalysisModule): Receipt | null {
  const all = readAll()
  for (const r of all) {
    if (!r.paid) continue
    if (r.module === analysis) return r
    if (r.module === 'bundle' && !(r.spent ?? []).includes(analysis)) return r
  }
  return null
}

export function markLocalSpent(token: string, analysis: AnalysisModule): void {
  const list = readAll()
  const idx = list.findIndex((r) => r.token === token)
  if (idx < 0) return
  const r = list[idx]
  if (r.module === 'bundle') {
    const spent = r.spent ?? []
    if (!spent.includes(analysis)) list[idx] = { ...r, spent: [...spent, analysis] }
  } else if (r.module === analysis) {
    list.splice(idx, 1) // consumed
  }
  writeAll(list)
}

// ─── Embedded Checkout ───────────────────────────────────────────────────────

export interface CheckoutOptions {
  module: UnlockModule
}

export interface CheckoutSession {
  clientSecret: string
  token: string
  module: UnlockModule
}

/**
 * Generates a token, saves a pending receipt, calls /api/checkout for a Stripe
 * embedded-checkout `client_secret`. Caller mounts Stripe's embedded form with
 * that secret and listens for its `onComplete`.
 */
export async function startCheckout({ module }: CheckoutOptions): Promise<CheckoutSession> {
  const token = generateToken()
  saveReceipt({
    token,
    module,
    paid: false,
    createdAt: new Date().toISOString(),
  })

  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ unlockToken: token, module }),
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
    throw new Error(body.message ?? body.error ?? `checkout failed (${res.status})`)
  }

  const { clientSecret } = (await res.json()) as { clientSecret: string }
  return { clientSecret, token, module }
}

// ─── Polling after Stripe return ─────────────────────────────────────────────

export interface PollOptions {
  timeoutMs?: number
  intervalMs?: number
  signal?: AbortSignal
}

/**
 * Polls /api/unlock/:token until the webhook has marked it paid, or timeout.
 * Resolves with the server's view of the receipt, or { paid: false } on timeout.
 */
export async function pollUnlock(
  token: string,
  { timeoutMs = 30_000, intervalMs = 1200, signal }: PollOptions = {},
): Promise<{ paid: boolean; module: UnlockModule | null; spent: AnalysisModule[] }> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (signal?.aborted) break
    try {
      const res = await fetch(`/api/unlock/${encodeURIComponent(token)}`, { signal })
      if (res.ok) {
        const body = (await res.json()) as {
          paid: boolean
          module: UnlockModule
          spent: AnalysisModule[]
        }
        if (body.paid) return body
      }
    } catch {
      // network blip — keep polling until timeout
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return { paid: false, module: null, spent: [] }
}
