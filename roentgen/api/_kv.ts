// Shape of an unlock record persisted in Vercel KV (production) or an
// in-memory Map (local dev without KV configured).
//   paid   — set to true by the Stripe webhook after a successful session
//   used   — flipped to true once the token can no longer run any analysis
//   spent  — for bundle unlocks: which of the two halves have already run
//   at     — ISO timestamp of the original paid event (for audit)
//   module — what the user paid for
export type UnlockModule = 'profiles' | 'relationship' | 'bundle'

export interface UnlockRecord {
  paid: boolean
  used: boolean
  module: UnlockModule
  at: string
  spent?: Array<'profiles' | 'relationship'>
}

const KEY_PREFIX = 'unlock:'

export function unlockKey(token: string): string {
  return `${KEY_PREFIX}${token}`
}

// Dual-mode storage: if Vercel KV env vars are present, use KV. Otherwise fall
// back to an in-process Map so local dev works without signing up for KV. The
// fallback resets on restart — that's fine for Stripe test-mode tinkering.
const memStore = new Map<string, UnlockRecord>()

function hasKv(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

export async function getUnlock(token: string): Promise<UnlockRecord | null> {
  if (hasKv()) {
    const { kv } = await import('@vercel/kv')
    return (await kv.get<UnlockRecord>(unlockKey(token))) ?? null
  }
  return memStore.get(unlockKey(token)) ?? null
}

export async function setUnlock(token: string, rec: UnlockRecord): Promise<void> {
  if (hasKv()) {
    const { kv } = await import('@vercel/kv')
    // 90 day TTL — bundle can unlock two analyses, we don't want zombie tokens forever.
    await kv.set(unlockKey(token), rec, { ex: 60 * 60 * 24 * 90 })
    return
  }
  memStore.set(unlockKey(token), rec)
}
