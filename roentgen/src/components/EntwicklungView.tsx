import { useMemo } from 'react'
import type { HardFacts } from '../analysis/hardFacts'
import { buildSymmetryTrend } from '../analysis/symmetryTrend'
import type {
  EntwicklungResult,
  GottmanSignal,
  PrognoseRichtung,
  ThemeCluster,
  ThemePhase,
  ThemePraegnanz,
} from '../ai/types'

interface Props {
  result: EntwicklungResult
  facts: HardFacts
}

const PERSON_COLORS = [
  '#7fe0c4', // a
  '#ff9a8b', // b
  '#89b4f4',
  '#fbbd5c',
  '#c9a6f0',
]

export function EntwicklungView({ result, facts }: Props) {
  const { payload } = result
  const symmetry = useMemo(() => buildSymmetryTrend(facts), [facts])

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 pt-12 pb-24 space-y-16">
      <header className="space-y-6">
        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
          What you <span className="italic text-ink-muted">talked about —</span>
          <br />
          and what you don't anymore.
        </h2>
        <p className="serif-body text-lg md:text-xl text-ink-muted max-w-2xl">
          {payload.gesamtbogen}
        </p>
      </header>

      {/* Lokale Symmetrie-Kurve */}
      <section>
        <h3 className="font-serif text-2xl md:text-4xl leading-tight tracking-tight mb-6">
          Who gives more — and how does it shift over time?
        </h3>
        <div className="card">
          <SymmetryCurve facts={facts} />
          <div className="mt-6 pt-5 border-t border-line/40 text-[13px] font-mono text-ink-muted">
            {symmetry.promptNote} ·{' '}
            <span className="text-ink">Trend: {trendLabel(symmetry.trend)}</span>
          </div>
        </div>
      </section>

      {/* Zentrale Themen */}
      <section>
        <div className="label-mono text-a mb-3">Central topics</div>
        <h3 className="font-serif text-2xl md:text-4xl leading-tight tracking-tight mb-6">
          What runs through the whole chat
        </h3>

        <div className="card">
          <div className="flex flex-wrap gap-2">
            {payload.zentrale_themen_gesamt.map((t, i) => (
              <ThemeChip key={i} cluster={t} />
            ))}
          </div>
        </div>
      </section>

      {/* Themen-Phasen */}
      <section>
        <div className="label-mono text-a mb-3">Topic phases</div>
        <h3 className="font-serif text-2xl md:text-4xl leading-tight tracking-tight mb-6">
          How the topics shifted
        </h3>
        <div className="space-y-3">
          {payload.themen_phasen.map((p, i) => (
            <ThemePhaseCard key={i} phase={p} index={i} />
          ))}
        </div>
      </section>

      {/* Prognose */}
      <section>
        <div className="label-mono text-b mb-3">Forecast · where this is heading</div>
        <h3 className="font-serif text-2xl md:text-4xl leading-tight tracking-tight mb-6">
          Where this leads
        </h3>
        <div className={`card border-l-4 ${richtungBorder(payload.prognose.richtung)}`}>
          <div className="flex items-baseline justify-between gap-4 flex-wrap mb-5">
            <div className={`font-serif text-4xl md:text-5xl ${richtungColor(payload.prognose.richtung)}`}>
              {richtungLabel(payload.prognose.richtung)}
            </div>
            <span className="label-mono border border-line/60 rounded-full px-3 py-1">
              Confidence · {levelLabel(payload.prognose.confidence)}
            </span>
          </div>

          <div className="space-y-6">
            <div>
              <div className="label-mono mb-2">The key patterns</div>
              <ul className="space-y-2">
                {payload.prognose.schluesselmuster.map((m, i) => (
                  <li key={i} className="serif-body text-lg text-ink flex gap-3">
                    <span className="text-ink-faint font-mono text-sm mt-1">·</span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="label-mono mb-2">Observed signals</div>
              <div className="flex flex-wrap gap-2">
                {payload.prognose.gottman_signale.map((s, i) => (
                  <GottmanChip key={i} signal={s} />
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-line/40">
              <div className="label-mono mb-2">If nothing changes</div>
              <p className="serif-body text-lg text-ink">{payload.prognose.wenn_nichts_aendert}</p>
            </div>

            <div>
              <div className="label-mono mb-2">What would shift the trend</div>
              <p className="serif-body text-lg text-ink">{payload.prognose.was_verschieben_wuerde}</p>
            </div>

            <div className="text-ink-muted text-sm italic pt-4 border-t border-line/40 font-serif">
              {payload.prognose.disclaimer}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

/* ---------- SymmetryCurve ---------- */

function SymmetryCurve({ facts }: { facts: HardFacts }) {
  const { weekly, perPerson } = facts
  if (weekly.length < 3) {
    return <div className="text-ink-muted font-mono text-sm">Not enough time span for a curve yet.</div>
  }

  const width = 720
  const height = 200
  const pad = { top: 16, right: 8, bottom: 28, left: 8 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom

  const stepX = plotW / (weekly.length - 1)

  // Per-person share series (0..1). We draw diverging lines from 0.5 baseline.
  const series = perPerson.map((p, i) => {
    const pts = weekly.map((w, wi) => {
      const total = Math.max(1, w.count)
      const share = (w.perPerson[p.author] ?? 0) / total
      const x = pad.left + wi * stepX
      // Map 0..1 share around 0.5 midline: higher share → line moves up for person 0, down for person 1 (mirrored)
      const mirror = i === 1 ? -1 : 1
      const delta = (share - 1 / perPerson.length) * mirror
      const y = pad.top + plotH / 2 - delta * (plotH / 2)
      return { x, y }
    })
    return { person: p.author, color: PERSON_COLORS[i % PERSON_COLORS.length], points: pts }
  })

  // Midline reference
  const midY = pad.top + plotH / 2

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="none">
        {/* Midline */}
        <line
          x1={pad.left}
          y1={midY}
          x2={pad.left + plotW}
          y2={midY}
          stroke="#2a323c"
          strokeDasharray="4,4"
          strokeWidth="1"
        />
        {/* Grid */}
        {[0.25, 0.75].map((p) => (
          <line
            key={p}
            x1={pad.left}
            y1={pad.top + plotH * p}
            x2={pad.left + plotW}
            y2={pad.top + plotH * p}
            stroke="#2a323c"
            strokeWidth="0.5"
            opacity={0.4}
          />
        ))}
        {/* Area fills */}
        {series.map((s) => {
          const pathTop = s.points
            .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
            .join(' ')
          const pathBase = `L ${s.points[s.points.length - 1].x} ${midY} L ${s.points[0].x} ${midY} Z`
          return (
            <path
              key={`area-${s.person}`}
              d={`${pathTop} ${pathBase}`}
              fill={s.color}
              opacity="0.18"
            />
          )
        })}
        {/* Lines on top */}
        {series.map((s) => (
          <path
            key={`line-${s.person}`}
            d={s.points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-ink-faint">
        <span>{fmtMonth(weekly[0].weekStart)}</span>
        <div className="flex gap-4">
          {series.map((s) => (
            <span key={s.person} className="flex items-center gap-2" style={{ color: s.color }}>
              <span className="inline-block w-4 h-[2px]" style={{ background: s.color }} />
              {s.person}
            </span>
          ))}
        </div>
        <span>{fmtMonth(weekly[weekly.length - 1].weekStart)}</span>
      </div>
    </div>
  )
}

/* ---------- ThemeChip & ThemePhaseCard ---------- */

function ThemeChip({ cluster }: { cluster: ThemeCluster }) {
  const px = praegnanzStyle(cluster.praegnanz)
  return (
    <div
      className={`inline-flex items-baseline gap-2 rounded-full px-3 py-1.5 border ${px.border} ${px.bg}`}
      title={cluster.beispiele.join(' · ')}
    >
      <span className="font-mono text-sm text-ink">{cluster.thema}</span>
      <span className={`label-mono ${px.text}`}>{cluster.praegnanz}</span>
    </div>
  )
}

function ThemePhaseCard({ phase, index }: { phase: ThemePhase; index: number }) {
  return (
    <div className="card relative">
      <div className="absolute -left-3 top-5 w-7 h-7 rounded-full bg-bg-raised border border-line flex items-center justify-center font-mono text-[11px] text-ink-muted">
        {index + 1}
      </div>
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-3">
        <h4 className="font-serif text-2xl md:text-3xl text-ink">{phase.titel}</h4>
        <span className="label-mono text-ink-muted">
          {fmtDate(phase.start)} — {fmtDate(phase.end)}
        </span>
      </div>

      <div className="mb-5">
        <div className="label-mono mb-2">Dominant topics</div>
        <div className="flex flex-wrap gap-2">
          {phase.dominante_themen.map((t, i) => (
            <ThemeChip key={i} cluster={t} />
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {phase.neue_themen.length > 0 && (
          <div>
            <div className="label-mono mb-2 text-a">New from here</div>
            <ul className="space-y-1">
              {phase.neue_themen.map((t, i) => (
                <li key={i} className="font-mono text-sm text-ink">
                  <span className="text-a mr-2">+</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}
        {phase.verschwundene_themen.length > 0 && (
          <div>
            <div className="label-mono mb-2 text-b">Gone from here</div>
            <ul className="space-y-1">
              {phase.verschwundene_themen.map((t, i) => (
                <li key={i} className="font-mono text-sm text-ink-muted line-through decoration-b/60">
                  <span className="text-b mr-2 no-underline">−</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function GottmanChip({ signal }: { signal: GottmanSignal }) {
  const cfg = gottmanConfig(signal)
  return (
    <span
      className={`inline-flex items-baseline gap-2 rounded-full px-3 py-1.5 border ${cfg.border} ${cfg.bg} font-mono text-sm`}
      title={cfg.erklaerung}
    >
      <span className={cfg.text}>{cfg.icon}</span>
      <span className="text-ink">{cfg.label}</span>
    </span>
  )
}

/* ---------- Helpers ---------- */

function praegnanzStyle(p: ThemePraegnanz): { border: string; bg: string; text: string } {
  return {
    hoch: { border: 'border-a/50', bg: 'bg-a/10', text: 'text-a' },
    mittel: { border: 'border-line', bg: 'bg-bg-surface', text: 'text-ink-muted' },
    niedrig: { border: 'border-line/40', bg: 'bg-bg-surface/40', text: 'text-ink-faint' },
  }[p]
}

function gottmanConfig(signal: GottmanSignal): {
  label: string
  icon: string
  border: string
  bg: string
  text: string
  erklaerung: string
} {
  const map: Record<GottmanSignal, { label: string; icon: string; negative: boolean; erklaerung: string }> = {
    kritik: { label: 'Criticism', icon: '!', negative: true, erklaerung: 'When criticism lands on the person, not the behavior' },
    verachtung: { label: 'Contempt', icon: '△', negative: true, erklaerung: 'Sarcasm, cynicism, superiority — the sharpest warning sign' },
    abwehr: { label: 'Defensiveness', icon: '◇', negative: true, erklaerung: 'Justifying yourself instead of actually listening' },
    stonewalling: { label: 'Stonewalling', icon: '▢', negative: true, erklaerung: 'Silence and withdrawal as a weapon' },
    repair_attempt: { label: 'Repair attempt', icon: '+', negative: false, erklaerung: 'When someone tries to heal the break' },
    bid_for_connection: { label: 'Bid for connection', icon: '◯', negative: false, erklaerung: 'Small invitations to get into contact' },
    turning_away: { label: 'Turning away', icon: '—', negative: true, erklaerung: 'When those invitations are ignored' },
    keine: { label: 'No signals', icon: '·', negative: false, erklaerung: '' },
  }
  const entry = map[signal]
  return {
    label: entry.label,
    icon: entry.icon,
    border: entry.negative ? 'border-b/40' : 'border-a/40',
    bg: entry.negative ? 'bg-b/10' : 'bg-a/10',
    text: entry.negative ? 'text-b' : 'text-a',
    erklaerung: entry.erklaerung,
  }
}

function richtungLabel(r: PrognoseRichtung): string {
  return { positiv: 'Rising', stagnation: 'Stagnating', negativ: 'Declining', unklar: 'Unclear' }[r]
}

function levelLabel(l: 'niedrig' | 'mittel' | 'hoch'): string {
  return { niedrig: 'low', mittel: 'medium', hoch: 'high' }[l]
}

function richtungColor(r: PrognoseRichtung): string {
  return { positiv: 'text-a', stagnation: 'text-ink-muted', negativ: 'text-b', unklar: 'text-ink' }[r]
}

function richtungBorder(r: PrognoseRichtung): string {
  return { positiv: 'border-a', stagnation: 'border-line', negativ: 'border-b', unklar: 'border-ink-muted' }[r]
}

function trendLabel(t: 'balanced' | 'diverging' | 'converging' | 'volatile'): string {
  return { balanced: 'steady', diverging: 'diverging', converging: 'converging', volatile: 'volatile' }[t]
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${m}/${d}/${y.slice(2)}`
}

function fmtMonth(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}
