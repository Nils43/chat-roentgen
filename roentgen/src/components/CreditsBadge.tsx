import { useCredits } from '../credits/useCredits'
import { useSession } from '../auth/useSession'
import { useLocale } from '../i18n'

// Compact balance readout for the top nav. Clicking opens the credits page.
// When signed out, shows a discreet "sign in" link instead of a zero balance.

interface Props {
  onOpen: () => void
  onSignIn: () => void
}

export function CreditsBadge({ onOpen, onSignIn }: Props) {
  const { session, loading } = useSession()
  const { balance } = useCredits()
  const locale = useLocale()
  if (loading) return null

  if (!session) {
    return (
      <button
        onClick={onSignIn}
        className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 hover:text-pop-yellow transition-colors"
      >
        {locale === 'de' ? 'login' : 'sign in'}
      </button>
    )
  }

  return (
    <button
      onClick={onOpen}
      className="inline-flex items-center gap-1.5 px-2 py-1 bg-pop-yellow text-ink border border-ink hover:bg-white transition-colors"
      style={{ boxShadow: '2px 2px 0 #0A0A0A' }}
      aria-label="credits"
    >
      <span
        className="text-base leading-none tabular-nums"
        style={{ fontFamily: "'Bebas Neue', sans-serif" }}
      >
        {balance ?? '—'}
      </span>
      <span className="text-[10px]">✦</span>
    </button>
  )
}
