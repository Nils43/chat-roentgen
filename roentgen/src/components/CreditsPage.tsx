import { useState } from 'react'
import { useLocale } from '../i18n'
import { PACKS, type Pack } from '../credits/packs'
import { useCredits, type Transaction } from '../credits/useCredits'
import { useSession, signOut } from '../auth/useSession'

// Credits page. Three pack cards + transaction history + signed-in phone.
// Buying a pack opens Stripe's embedded checkout in a modal; on complete the
// webhook credits the account and the realtime subscription in useCredits
// refreshes the balance badge + the list below.

interface Props {
  onBuy: (pack: Pack) => Promise<void>
  onBack?: () => void
  onSignIn: () => void
}

export function CreditsPage({ onBuy, onBack, onSignIn }: Props) {
  const locale = useLocale()
  const r = (en: string, de: string) => (locale === 'de' ? de : en)
  const { session } = useSession()
  const { balance, transactions } = useCredits()
  const [pending, setPending] = useState<Pack['id'] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const handleBuy = async (pack: Pack) => {
    setErr(null)
    setPending(pack.id)
    try {
      await onBuy(pack)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 pt-12 pb-24 space-y-10">
      {onBack && (
        <button
          onClick={onBack}
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/60 hover:text-ink"
        >
          ← {r('back', 'zurück')}
        </button>
      )}

      <header className="space-y-4">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 bg-ink text-pop-yellow"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '14px',
            letterSpacing: '0.06em',
            transform: 'rotate(-1deg)',
            boxShadow: '3px 3px 0 #0A0A0A',
          }}
        >
          ✦ {r('YOUR CREDITS', 'DEINE CREDITS')}
        </div>
        <h2 className="font-serif text-[14vw] md:text-[96px] leading-[0.9] tracking-[-0.02em] text-ink max-w-full break-words">
          {balance ?? 0} <span className="bg-pop-yellow px-1">✦</span>
        </h2>
        <p className="serif-body text-lg md:text-xl text-ink leading-relaxed max-w-2xl">
          {r(
            'One credit = one deep analysis (personal or relationship). No subscription.',
            'Ein credit = eine analyse (personal oder relationship). Kein abo.',
          )}
        </p>
      </header>

      {!session ? (
        <div
          className="bg-pop-yellow border-2 border-ink p-5 md:p-6"
          style={{ boxShadow: '4px 4px 0 #0A0A0A' }}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/70 mb-2">
            {r('sign in first', 'erst einloggen')}
          </div>
          <p className="serif-body text-base text-ink mb-4">
            {r(
              'Credits belong to a phone number so they stick around. One SMS, no email.',
              'Credits hängen an der handynummer — damit sie dir bleiben. Eine sms, keine email.',
            )}
          </p>
          <button
            onClick={onSignIn}
            className="bg-ink text-pop-yellow border-2 border-ink px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] hover:bg-white hover:text-ink transition-colors"
            style={{ boxShadow: '3px 3px 0 #0A0A0A' }}
          >
            {r('sign in with phone →', 'mit handy einloggen →')}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60">
            {r('signed in as', 'eingeloggt als')} · {session.user.phone}
          </div>
          <button
            onClick={() => void signOut()}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/60 hover:text-ink underline underline-offset-4 decoration-dotted"
          >
            {r('sign out', 'ausloggen')}
          </button>
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {PACKS.map((p) => (
          <PackCard
            key={p.id}
            pack={p}
            pending={pending === p.id}
            disabled={!session || pending !== null}
            onBuy={() => handleBuy(p)}
          />
        ))}
      </section>

      {err && (
        <div
          className="bg-pop-yellow border-2 border-ink px-4 py-3"
          style={{ boxShadow: '3px 3px 0 #0A0A0A' }}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-b mr-2">
            error
          </span>
          <span className="serif-body text-sm text-ink">{err}</span>
        </div>
      )}

      <section>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60 mb-3">
          {r('history', 'verlauf')}
        </div>
        {transactions.length === 0 ? (
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/40 py-8 text-center">
            — {r('no transactions yet', 'noch keine transaktionen')} —
          </div>
        ) : (
          <ul className="space-y-2">
            {transactions.map((t) => (
              <TxnRow key={t.id} t={t} locale={locale} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function PackCard({
  pack,
  pending,
  disabled,
  onBuy,
}: {
  pack: Pack
  pending: boolean
  disabled: boolean
  onBuy: () => void
}) {
  const locale = useLocale()
  const isFeatured = pack.id === 'pack_3'
  return (
    <button
      type="button"
      onClick={onBuy}
      disabled={disabled}
      className={`border-2 border-ink p-5 md:p-6 text-left relative transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${isFeatured ? 'bg-pop-yellow' : 'bg-white hover:bg-pop-yellow/30'}`}
      style={{
        boxShadow: isFeatured ? '6px 6px 0 #0A0A0A' : '4px 4px 0 #0A0A0A',
        transform: isFeatured ? 'rotate(-0.3deg)' : 'rotate(0.15deg)',
      }}
    >
      {pack.badge && (
        <div
          className="absolute -top-3 -right-3 px-2.5 py-1 bg-ink text-pop-yellow border-2 border-ink pointer-events-none"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '12px',
            letterSpacing: '0.06em',
            transform: 'rotate(6deg)',
            boxShadow: '2px 2px 0 #0A0A0A',
          }}
        >
          {pack.badge}
        </div>
      )}
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/70 mb-2">
        {pack.label}
      </div>
      <div
        className="text-5xl md:text-6xl leading-[0.85] text-ink tabular-nums"
        style={{ fontFamily: "'Bebas Neue', sans-serif" }}
      >
        {pack.tokens} ✦
      </div>
      <div className="border-t-2 border-ink border-dashed mt-4 pt-3 flex items-baseline justify-between">
        <span
          className="text-3xl text-ink leading-none tabular-nums"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          €{pack.priceEur}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/60">
          {pending
            ? locale === 'de'
              ? 'laden…'
              : 'loading…'
            : locale === 'de'
              ? 'kaufen →'
              : 'buy →'}
        </span>
      </div>
    </button>
  )
}

function TxnRow({ t, locale }: { t: Transaction; locale: 'en' | 'de' }) {
  const isCredit = t.delta > 0
  const kindLabel = (() => {
    if (locale === 'de') {
      return { purchase: 'gekauft', spend: 'genutzt', refund: 'erstattet', grant: 'geschenkt' }[t.kind]
    }
    return { purchase: 'bought', spend: 'used', refund: 'refunded', grant: 'gifted' }[t.kind]
  })()
  const date = new Date(t.created_at).toLocaleDateString(
    locale === 'de' ? 'de-DE' : 'en-US',
    { month: 'short', day: 'numeric' },
  )
  return (
    <li
      className="flex items-center justify-between gap-3 border-b border-line/40 pb-2"
    >
      <div className="flex items-baseline gap-3">
        <span
          className={`text-lg tabular-nums leading-none ${isCredit ? 'text-ink' : 'text-ink/60'}`}
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          {isCredit ? '+' : ''}
          {t.delta}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/60">
          {kindLabel}
        </span>
        {t.note && (
          <span className="serif-body text-sm text-ink/70 italic">{t.note}</span>
        )}
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
        {date}
      </span>
    </li>
  )
}
