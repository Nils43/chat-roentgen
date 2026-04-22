import { useEffect, useState } from 'react'
import { getSupabase } from '../auth/supabase'
import { useSession } from '../auth/useSession'

export interface Transaction {
  id: string
  delta: number
  kind: 'purchase' | 'spend' | 'refund' | 'grant'
  note: string | null
  created_at: string
}

export interface CreditsState {
  balance: number | null
  transactions: Transaction[]
  loading: boolean
  refresh: () => Promise<void>
}

// Module-level store. Every mounted useCredits() reads + subscribes to this
// singleton, so a refresh() or realtime event in one component updates ALL
// consumers (badge, credits page, paywall room) atomically. Without this,
// each hook instance kept its own state and a spend/purchase only reflected
// in whichever component happened to call refresh.

interface InternalState {
  userId: string | null
  balance: number | null
  transactions: Transaction[]
  loading: boolean
}

let state: InternalState = {
  userId: null,
  balance: null,
  transactions: [],
  loading: true,
}
const subscribers = new Set<() => void>()

function emit(): void {
  subscribers.forEach((fn) => fn())
}

function setState(partial: Partial<InternalState>): void {
  state = { ...state, ...partial }
  emit()
}

async function doRefresh(userId: string | null): Promise<void> {
  if (!userId) {
    setState({ userId: null, balance: 0, transactions: [], loading: false })
    return
  }
  const sb = getSupabase()
  const [{ data: acc }, { data: txs }] = await Promise.all([
    sb.from('accounts').select('credits').eq('id', userId).maybeSingle(),
    sb
      .from('transactions')
      .select('id, delta, kind, note, created_at')
      .eq('account_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])
  setState({
    userId,
    balance: acc?.credits ?? 0,
    transactions: (txs ?? []) as Transaction[],
    loading: false,
  })
}

let currentChannel: ReturnType<ReturnType<typeof getSupabase>['channel']> | null = null

function attachRealtime(userId: string): void {
  // Tear down any existing channel first — userId changed, or StrictMode double-mount.
  detachRealtime()
  const sb = getSupabase()
  currentChannel = sb
    .channel(`credits-${userId}-${Math.random().toString(36).slice(2, 10)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'accounts', filter: `id=eq.${userId}` },
      () => void doRefresh(userId),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions', filter: `account_id=eq.${userId}` },
      () => void doRefresh(userId),
    )
    .subscribe()
}

function detachRealtime(): void {
  if (currentChannel) {
    void getSupabase().removeChannel(currentChannel)
    currentChannel = null
  }
}

export function useCredits(): CreditsState {
  const { session } = useSession()
  const userId = session?.user.id ?? null

  const [, force] = useState({})

  useEffect(() => {
    const sub = () => force({})
    subscribers.add(sub)
    return () => {
      subscribers.delete(sub)
    }
  }, [])

  useEffect(() => {
    // First hook mount or user change drives the refresh + channel attach.
    if (state.userId !== userId) {
      void doRefresh(userId)
    }
    if (userId) attachRealtime(userId)
    else detachRealtime()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  return {
    balance: state.balance,
    transactions: state.transactions,
    loading: state.loading,
    refresh: () => doRefresh(userId),
  }
}
