import { useMemo } from 'react'
import {
  MODULE_COSTS,
  PACKS,
  tokenStore,
  useTokenState,
  type ModuleId,
  type Transaction,
} from '../tokens/store'

interface Props {
  onClose: () => void
  highlightReason?: 'insufficient' | null
  pendingModule?: ModuleId | null
}

const MODULE_ID_TO_LABEL: Record<ModuleId, string> = {
  profiles: 'Persönliche Profile',
  relationship: 'Beziehungsebene',
  entwicklung: 'Entwicklung',
  highlights: 'Highlights',
  timeline: 'Timeline',
}

export function TokenOverview({ onClose, highlightReason, pendingModule }: Props) {
  const { balance, history, createdAt } = useTokenState()

  const { chargedCount, purchasedCount, refundedCount } = useMemo(() => {
    let c = 0
    let p = 0
    let r = 0
    for (const t of history) {
      if (t.kind === 'charge') c += -t.tokens
      else if (t.kind === 'purchase' || t.kind === 'grant') p += t.tokens
      else if (t.kind === 'refund') r += t.tokens
    }
    return { chargedCount: c, purchasedCount: p, refundedCount: r }
  }, [history])

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 pt-12 pb-24 space-y-14">
      <header className="space-y-6">
        <div className="flex items-baseline justify-between">
          <div className="label-mono text-a">Tokens · Übersicht</div>
          <button
            onClick={onClose}
            className="label-mono text-ink-muted hover:text-ink transition-colors"
          >
            Schließen ✕
          </button>
        </div>
        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
          Dein <span className="italic text-ink-muted">Guthaben.</span>
        </h2>
        <p className="serif-body text-lg md:text-xl text-ink-muted max-w-2xl">
          Jedes AI-Modul kostet einen Token. Hard Facts bleiben gratis — die laufen lokal in deinem Browser.
        </p>
      </header>

      {highlightReason === 'insufficient' && (
        <div className="card border-b/60 bg-b/5">
          <div className="label-mono text-b mb-2">Nicht genug Tokens</div>
          <p className="serif-body text-lg text-ink">
            Für „{pendingModule ? MODULE_ID_TO_LABEL[pendingModule] : 'dieses Modul'}" brauchst du mindestens einen
            Token. Lade unten nach, dann geht&apos;s weiter.
          </p>
        </div>
      )}

      {/* Balance + stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Tile label="Aktuell" value={balance} accent />
        <Tile label="Verbraucht" value={chargedCount} />
        <Tile label="Gekauft / Erhalten" value={purchasedCount} />
        <Tile label="Erstattet" value={refundedCount} />
      </section>

      {/* Costs */}
      <section>
        <SectionKicker label="Was kostet was" />
        <div className="grid md:grid-cols-2 gap-3">
          <CostRow label="Hard Facts" cost="gratis" note="Lokal berechnet" free />
          {Object.values(MODULE_COSTS).map((m) => (
            <CostRow key={m.id} label={m.label} cost={`${m.cost} Token`} />
          ))}
        </div>
      </section>

      {/* Shop */}
      <section>
        <SectionKicker label="Tokens nachladen" />
        <div className="grid md:grid-cols-3 gap-4">
          {PACKS.map((p) => (
            <article
              key={p.id}
              className="card relative overflow-hidden flex flex-col"
            >
              {p.badge && (
                <div className="absolute top-4 right-4 label-mono text-a border border-a/40 rounded-full px-2 py-0.5">
                  {p.badge}
                </div>
              )}
              <div className="label-mono mb-2">{p.label}</div>
              <div className="font-serif text-5xl leading-none tracking-tight text-ink mb-1">
                {p.tokens}
              </div>
              <div className="label-mono mb-6">
                {p.tokens === 1 ? 'Token' : 'Tokens'}
              </div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="font-mono text-2xl tabular-nums tracking-tight text-ink">
                  €{p.priceEur.toFixed(2).replace('.', ',')}
                </span>
                <span className="label-mono text-ink-faint">
                  · €{(p.priceEur / p.tokens).toFixed(2).replace('.', ',')} / Token
                </span>
              </div>
              <button
                onClick={() => tokenStore.purchasePack(p.id)}
                className="mt-auto w-full px-4 py-2.5 bg-ink text-bg rounded-full font-sans text-sm tracking-wide hover:bg-a hover:text-bg transition-colors"
              >
                Kaufen (Mock)
              </button>
            </article>
          ))}
        </div>
        <p className="label-mono text-ink-faint mt-4 text-center">
          Demo-Modus · Der „Kaufen"-Button fügt Tokens ohne echte Zahlung hinzu. Stripe-Integration folgt.
        </p>
      </section>

      {/* History */}
      <section>
        <SectionKicker label="Verlauf" />
        {history.length === 0 ? (
          <p className="serif-body text-ink-muted italic">Noch keine Bewegungen.</p>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead className="bg-bg-surface/40">
                <tr className="label-mono">
                  <th className="text-left px-5 py-3">Zeitpunkt</th>
                  <th className="text-left px-5 py-3">Aktion</th>
                  <th className="text-right px-5 py-3">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {history.map((t) => (
                  <HistoryRow key={t.id} txn={t} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="text-center serif-body text-ink-muted italic pt-6 border-t border-line/40">
        Konto aktiv seit {new Date(createdAt).toLocaleString('de-DE')}.{' '}
        <button
          onClick={() => {
            if (confirm('Token-Guthaben & Verlauf zurücksetzen?')) tokenStore.reset()
          }}
          className="underline underline-offset-2 hover:text-ink transition-colors not-italic label-mono ml-2"
        >
          Zurücksetzen
        </button>
      </div>
    </div>
  )
}

function SectionKicker({ label }: { label: string }) {
  return <div className="label-mono text-ink-muted mb-4">{label}</div>
}

function Tile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`card ${accent ? 'border-a/50 bg-a/5' : ''}`}>
      <div className="label-mono mb-3">{label}</div>
      <div
        className={`font-serif text-5xl md:text-6xl leading-none tracking-tight ${
          accent ? 'text-a' : 'text-ink'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

function CostRow({
  label,
  cost,
  note,
  free,
}: {
  label: string
  cost: string
  note?: string
  free?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between border border-line/40 rounded-xl px-5 py-4 bg-bg-raised/30">
      <div>
        <div className="font-serif text-xl text-ink">{label}</div>
        {note && <div className="label-mono text-ink-faint mt-0.5">{note}</div>}
      </div>
      <div className={`font-mono text-sm tabular-nums ${free ? 'text-a' : 'text-ink-muted'}`}>
        {cost}
      </div>
    </div>
  )
}

function HistoryRow({ txn }: { txn: Transaction }) {
  const label =
    txn.kind === 'charge'
      ? `Analyse: ${txn.moduleId ? MODULE_ID_TO_LABEL[txn.moduleId] : '—'}`
      : txn.kind === 'grant'
        ? `Geschenk: ${txn.note ?? 'Guthaben'}`
        : txn.kind === 'purchase'
          ? `Kauf: ${txn.note ?? 'Pack'}`
          : `Erstattung: ${txn.note ?? '—'}`

  const color =
    txn.tokens < 0 ? 'text-b' : txn.kind === 'refund' ? 'text-ink-muted' : 'text-a'
  const sign = txn.tokens > 0 ? '+' : ''

  return (
    <tr className="border-t border-line/30">
      <td className="px-5 py-3 font-mono text-[12px] text-ink-muted tabular-nums">
        {new Date(txn.at).toLocaleString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </td>
      <td className="px-5 py-3 font-serif text-base text-ink">{label}</td>
      <td className={`px-5 py-3 text-right font-mono tabular-nums ${color}`}>
        {sign}
        {txn.tokens}
      </td>
    </tr>
  )
}
