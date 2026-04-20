import { useEffect, useSyncExternalStore } from 'react'

// Token-based payment model. Stored in localStorage so the no-account flow stays intact.
// The store is a tiny event-subscription singleton so the whole app can react to balance changes.

export type ModuleId = 'profiles' | 'relationship'

export interface ModuleMeta {
  id: ModuleId
  label: string
  cost: number
}

export const MODULE_COSTS: Record<ModuleId, ModuleMeta> = {
  profiles: { id: 'profiles', label: 'Personal analysis', cost: 1 },
  relationship: { id: 'relationship', label: 'Relationship analysis', cost: 1 },
}

export type TxnKind = 'charge' | 'grant' | 'purchase' | 'refund'

export interface Transaction {
  id: string
  kind: TxnKind
  tokens: number // negative for charges, positive for grants/purchases
  moduleId?: ModuleId
  packId?: string
  note?: string
  at: string // ISO timestamp
}

export interface TokenState {
  balance: number
  history: Transaction[]
  createdAt: string
}

export interface Pack {
  id: string
  label: string
  tokens: number
  priceEur: number
  badge?: string
}

// Mock shop. Real Stripe wiring can replace the purchase path later.
export const PACKS: Pack[] = [
  { id: 'single', label: 'Solo', tokens: 1, priceEur: 3 },
  { id: 'double', label: 'Duo', tokens: 2, priceEur: 5, badge: 'Popular' },
  { id: 'five', label: 'Five-pack', tokens: 5, priceEur: 10, badge: 'Best value' },
]

const STORAGE_KEY = 'roentgen.tokens.v1'
const INITIAL_GRANT = 3

function nowIso(): string {
  return new Date().toISOString()
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function read(): TokenState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seed()
    const parsed = JSON.parse(raw) as TokenState
    if (typeof parsed.balance !== 'number' || !Array.isArray(parsed.history)) return seed()
    return parsed
  } catch {
    return seed()
  }
}

function seed(): TokenState {
  const initial: TokenState = {
    balance: INITIAL_GRANT,
    history: [
      {
        id: uid('grant'),
        kind: 'grant',
        tokens: INITIAL_GRANT,
        note: 'Welcome credit',
        at: nowIso(),
      },
    ],
    createdAt: nowIso(),
  }
  write(initial)
  return initial
}

function write(state: TokenState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage full / disabled — silently fail, balance stays in memory for this session only
  }
}

type Listener = () => void
const listeners = new Set<Listener>()
let current: TokenState | null = null

function get(): TokenState {
  if (!current) current = read()
  return current
}

function emit(): void {
  for (const l of listeners) l()
}

function update(mutator: (s: TokenState) => TokenState): TokenState {
  const next = mutator(get())
  current = next
  write(next)
  emit()
  return next
}

export const tokenStore = {
  get,
  subscribe(l: Listener): () => void {
    listeners.add(l)
    return () => listeners.delete(l)
  },

  /** Returns true if the charge succeeded, false if balance insufficient. */
  charge(moduleId: ModuleId): boolean {
    const meta = MODULE_COSTS[moduleId]
    const state = get()
    if (state.balance < meta.cost) return false
    update((s) => ({
      ...s,
      balance: s.balance - meta.cost,
      history: [
        {
          id: uid('charge'),
          kind: 'charge' as const,
          tokens: -meta.cost,
          moduleId,
          note: meta.label,
          at: nowIso(),
        },
        ...s.history,
      ].slice(0, 100),
    }))
    return true
  },

  /** Refund a previously charged module (e.g. on error before success). */
  refund(moduleId: ModuleId, note = 'Analysis failed'): void {
    const meta = MODULE_COSTS[moduleId]
    update((s) => ({
      ...s,
      balance: s.balance + meta.cost,
      history: [
        {
          id: uid('refund'),
          kind: 'refund' as const,
          tokens: meta.cost,
          moduleId,
          note,
          at: nowIso(),
        },
        ...s.history,
      ].slice(0, 100),
    }))
  },

  /** Mock purchase — adds pack tokens without real payment. */
  purchasePack(packId: string): boolean {
    const pack = PACKS.find((p) => p.id === packId)
    if (!pack) return false
    update((s) => ({
      ...s,
      balance: s.balance + pack.tokens,
      history: [
        {
          id: uid('purchase'),
          kind: 'purchase' as const,
          tokens: pack.tokens,
          packId,
          note: `${pack.label} pack`,
          at: nowIso(),
        },
        ...s.history,
      ].slice(0, 100),
    }))
    return true
  },

  /** Dev/debug — wipe and reseed. */
  reset(): void {
    localStorage.removeItem(STORAGE_KEY)
    current = seed()
    emit()
  },
}

export function useTokenState(): TokenState {
  const state = useSyncExternalStore(
    (l) => tokenStore.subscribe(l),
    () => tokenStore.get(),
    () => tokenStore.get(),
  )
  // Ensure seed runs on first mount even if SSR-ish envs skipped it.
  useEffect(() => {
    void state
  }, [state])
  return state
}
