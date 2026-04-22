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
  balance: number | null // null while loading, number when loaded
  transactions: Transaction[]
  loading: boolean
  refresh: () => Promise<void>
}

// Single source of truth for the signed-in user's credits + transaction log.
// Live-subscribes via Supabase realtime so a webhook-triggered purchase reflects
// in the badge without a manual refresh. Signed-out users always see balance=0.
export function useCredits(): CreditsState {
  const { session } = useSession()
  const userId = session?.user.id ?? null

  const [balance, setBalance] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    if (!userId) {
      setBalance(0)
      setTransactions([])
      setLoading(false)
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
    setBalance(acc?.credits ?? 0)
    setTransactions((txs ?? []) as Transaction[])
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
    if (!userId) return
    // Realtime: any change to the accounts/transactions rows for this user
    // bumps a refresh. Scoped by account_id so we're not listening globally.
    const sb = getSupabase()
    const channel = sb
      .channel('credits-' + userId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'accounts', filter: `id=eq.${userId}` },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `account_id=eq.${userId}` },
        () => void refresh(),
      )
      .subscribe()
    return () => {
      void sb.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  return { balance, transactions, loading, refresh }
}
