import { useMemo, useState } from 'react'
import type { HardFacts } from '../analysis/hardFacts'
import type { HighlightsResult, TimelinePhase, TimelineResult } from '../ai/types'

interface Props {
  timeline: TimelineResult
  facts: HardFacts
  highlights?: HighlightsResult | null
}

// The visual centerpiece — "a relationship on one axis".
// Stacks four layers on a shared time axis:
//   1. Phase bands (colored by emotional temperature)
//   2. Temperature curve (smooth line connecting phase midpoints)
//   3. Daily activity — stacked area per person
//   4. Turning point + highlight markers as pins
//
// Width is viewport-responsive via viewBox. Clickable markers reveal detail.

export function TimelineView({ timeline, facts, highlights }: Props) {
  const { payload } = timeline
  const [selectedPhase, setSelectedPhase] = useState<number | null>(null)
  const [selectedKipp, setSelectedKipp] = useState<number | null>(null)

  const t0 = +facts.firstTs
  const t1 = +facts.lastTs
  const span = t1 - t0 || 1

  const width = 1000
  const height = 360
  const pad = { top: 24, right: 16, bottom: 44, left: 16 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom

  const xOf = (ts: number) => pad.left + ((ts - t0) / span) * plotW

  // Daily activity from HardFacts (aggregate weekly → daily sum)
  const daily = useMemo(() => buildDailySeries(facts), [facts])
  const maxDaily = Math.max(1, ...daily.map((d) => d.total))

  const temperatureCurve = useMemo(
    () => buildTemperatureCurve(payload.phasen, pad, plotW, plotH, xOf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payload.phasen, plotW, plotH],
  )

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 pt-12 pb-24 space-y-16">
      <header className="space-y-6">
        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
          Your story <span className="italic text-ink-muted">on one axis.</span>
        </h2>
        <p className="serif-body text-lg md:text-xl text-ink-muted max-w-2xl">
          {payload.gesamtbogen}
        </p>
      </header>

      {/* The timeline SVG */}
      <section className="card p-3 md:p-6 overflow-hidden">
        <div className="relative">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="w-full h-auto"
            style={{ minHeight: 260 }}
          >
            {/* 1. Phase bands */}
            {payload.phasen.map((ph, i) => {
              const x0 = xOf(isoToMs(ph.start))
              const x1 = xOf(isoToMs(ph.end, true))
              const fill = tempFill(ph.temperatur)
              const isActive = selectedPhase === i
              return (
                <g
                  key={`ph-${i}`}
                  onClick={() => setSelectedPhase(isActive ? null : i)}
                  className="cursor-pointer"
                >
                  <rect
                    x={x0}
                    y={pad.top}
                    width={Math.max(1, x1 - x0)}
                    height={plotH}
                    fill={fill}
                    opacity={isActive ? 0.9 : 0.55}
                    className="transition-opacity duration-300"
                  />
                  {/* Phase label at top */}
                  <text
                    x={x0 + 6}
                    y={pad.top + 14}
                    className="font-mono"
                    fill="#f5f2ea"
                    opacity="0.7"
                    style={{ fontSize: 9, letterSpacing: '0.1em' }}
                  >
                    {ph.titel.toUpperCase()}
                  </text>
                  <text
                    x={x0 + 6}
                    y={pad.top + plotH - 8}
                    className="font-mono"
                    fill="#f5f2ea"
                    opacity="0.5"
                    style={{ fontSize: 9 }}
                  >
                    {ph.temperatur}/10
                  </text>
                </g>
              )
            })}

            {/* Phase separators */}
            {payload.phasen.slice(1).map((ph, i) => (
              <line
                key={`sep-${i}`}
                x1={xOf(isoToMs(ph.start))}
                y1={pad.top}
                x2={xOf(isoToMs(ph.start))}
                y2={pad.top + plotH}
                stroke="#0a0d10"
                strokeWidth="1"
                opacity="0.5"
              />
            ))}

            {/* 3. Daily activity as stacked area (Person A + Person B) */}
            {daily.length >= 2 &&
              facts.perPerson.slice(0, 4).map((person, pi) => {
                const palette = ['#7fe0c4', '#ff9a8b', '#89b4f4', '#fbbd5c']
                // Build cumulative stack
                const pts = daily.map((d) => {
                  const below = facts.perPerson
                    .slice(0, pi)
                    .reduce((s, p) => s + (d.perPerson[p.author] ?? 0), 0)
                  const v = (d.perPerson[person.author] ?? 0) + below
                  return { x: xOf(+d.date), yTop: yForActivity(v, maxDaily, pad, plotH), yBottom: yForActivity(below, maxDaily, pad, plotH) }
                })
                const top = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yTop}`).join(' ')
                const bottom = pts
                  .slice()
                  .reverse()
                  .map((p) => `L ${p.x} ${p.yBottom}`)
                  .join(' ')
                return (
                  <path
                    key={`act-${pi}`}
                    d={`${top} ${bottom} Z`}
                    fill={palette[pi % palette.length]}
                    opacity="0.35"
                  />
                )
              })}

            {/* 2. Temperature curve (smoothed) */}
            <path
              d={temperatureCurve}
              fill="none"
              stroke="#f5f2ea"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />
            {/* Temperature curve glow */}
            <path
              d={temperatureCurve}
              fill="none"
              stroke="#f5f2ea"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.08"
            />

            {/* 4. Wendepunkt markers */}
            {payload.kipppunkte.map((k, i) => {
              const x = xOf(isoToMs(k.datum))
              const isActive = selectedKipp === i
              return (
                <g
                  key={`kipp-${i}`}
                  onClick={() => setSelectedKipp(isActive ? null : i)}
                  className="cursor-pointer"
                >
                  <line
                    x1={x}
                    y1={pad.top}
                    x2={x}
                    y2={pad.top + plotH}
                    stroke="#f5f2ea"
                    strokeWidth={isActive ? 1.5 : 0.8}
                    strokeDasharray="3,3"
                    opacity={isActive ? 0.9 : 0.5}
                  />
                  <circle
                    cx={x}
                    cy={pad.top + plotH + 14}
                    r={isActive ? 7 : 5}
                    fill="#ff9a8b"
                    className="transition-all"
                  />
                  <circle
                    cx={x}
                    cy={pad.top + plotH + 14}
                    r={3}
                    fill="#0a0d10"
                  />
                </g>
              )
            })}

            {/* Highlight markers — small dots */}
            {highlights?.payload.highlights.map((h, i) => {
              const msg = facts.perPerson // placeholder; real index-based lookup could anchor to message ts
              void msg
              // We attempt to parse h.timestamp; if it fails we skip.
              const d = parseLocalDate(h.timestamp)
              if (!d) return null
              const x = xOf(+d)
              return (
                <circle
                  key={`hi-${i}`}
                  cx={x}
                  cy={pad.top + 8}
                  r={3}
                  fill="#7fe0c4"
                  opacity="0.8"
                >
                  <title>{h.titel}</title>
                </circle>
              )
            })}

            {/* Bottom date axis */}
            {buildDateTicks(facts.firstTs, facts.lastTs).map((tick, i) => (
              <g key={`tick-${i}`}>
                <line
                  x1={xOf(+tick)}
                  x2={xOf(+tick)}
                  y1={pad.top + plotH}
                  y2={pad.top + plotH + 4}
                  stroke="#2a323c"
                  strokeWidth="1"
                />
                <text
                  x={xOf(+tick)}
                  y={pad.top + plotH + 30}
                  textAnchor="middle"
                  fill="#8b95a1"
                  style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                >
                  {fmtTick(tick)}
                </text>
              </g>
            ))}
          </svg>

          {/* Hover/click detail panel for phase */}
          {selectedPhase !== null && (
            <PhaseDetail
              phase={payload.phasen[selectedPhase]}
              onClose={() => setSelectedPhase(null)}
            />
          )}
          {selectedKipp !== null && (
            <WendepunktDetail
              kipp={payload.kipppunkte[selectedKipp]}
              onClose={() => setSelectedKipp(null)}
            />
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 items-baseline text-[11px] font-mono text-ink-muted">
          <span className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#7fe0c4', opacity: 0.55 }} />
            Person A
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#ff9a8b', opacity: 0.55 }} />
            Person B
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-8 h-[2px]" style={{ background: '#f5f2ea' }} />
            Emotional temperature
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#ff9a8b' }} />
            Turning point
          </span>
          {highlights && (
            <span className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#7fe0c4' }} />
              Highlight
            </span>
          )}
        </div>
      </section>

      {/* Phase list */}
      <section>
        <div className="label-mono text-a mb-4">Your chapters in detail</div>

        <div className="space-y-3">
          {payload.phasen.map((ph, i) => (
            <PhaseRow
              key={i}
              phase={ph}
              active={selectedPhase === i}
              onClick={() => setSelectedPhase(selectedPhase === i ? null : i)}
            />
          ))}
        </div>
      </section>

      {/* Wendepunkt list */}
      {payload.kipppunkte.length > 0 && (
        <section>
          <div className="label-mono text-b mb-4">Turning points</div>
          <div className="space-y-3">
            {payload.kipppunkte.map((k, i) => (
              <div key={i} className="card">
                <div className="flex items-baseline justify-between gap-4 mb-3 flex-wrap">
                  <h4 className="font-serif text-2xl md:text-3xl text-b">{k.titel}</h4>
                  <span className="label-mono text-ink-muted">{fmtDate(k.datum)}</span>
                </div>
                <p className="serif-body text-lg text-ink">{k.beschreibung}</p>
                <div className="mt-3 flex gap-2 flex-wrap">
                  {k.beteiligt.map((p, j) => (
                    <span
                      key={j}
                      className="label-mono bg-bg-surface/70 border border-line/50 rounded px-2.5 py-1"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Final verdict */}
      <section className="card text-center bg-bg-raised/60">
        <div className="label-mono mb-4">Final state</div>
        <div className={`font-serif text-5xl md:text-6xl tracking-tight ${stateColor(payload.finaler_zustand)}`}>
          {stateLabel(payload.finaler_zustand)}
        </div>
      </section>
    </div>
  )
}

/* ---------- Subcomponents ---------- */

function PhaseRow({
  phase,
  active,
  onClick,
}: {
  phase: TimelinePhase
  active: boolean
  onClick: () => void
}) {
  const tempPct = (phase.temperatur / 10) * 100
  return (
    <button
      onClick={onClick}
      className={`w-full text-left card transition-all ${active ? 'ring-1 ring-a' : 'hover:border-ink-muted/40'}`}
    >
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <h4 className="font-serif text-xl md:text-2xl text-ink">{phase.titel}</h4>
        <span className="label-mono text-ink-muted shrink-0">
          {fmtDate(phase.start)} — {fmtDate(phase.end)}
        </span>
      </div>
      <p className="serif-body text-base text-ink-muted mb-4">{phase.kurzbeschreibung}</p>
      <div className="flex items-center gap-4 text-[11px] font-mono text-ink-faint">
        <span>
          <span className="text-ink-muted">Temp</span>{' '}
          <span className="metric-num text-ink text-base">{phase.temperatur}/10</span>
        </span>
        {/* bar below */}
        <div className="flex-1 h-1 rounded-full bg-line overflow-hidden">
          <div
            className="h-full transition-all duration-1000"
            style={{
              width: `${tempPct}%`,
              background: tempSolid(phase.temperatur),
            }}
          />
        </div>
        <span className="shrink-0 uppercase tracking-[0.14em]">{phase.label}</span>
      </div>
      {active && (
        <div className="mt-5 pt-4 border-t border-line/40 text-base serif-body text-ink animate-fade-in">
          <span className="label-mono mr-2">Pattern</span>
          {phase.dominantes_muster}
        </div>
      )}
    </button>
  )
}

function PhaseDetail({
  phase,
  onClose,
}: {
  phase: TimelinePhase
  onClose: () => void
}) {
  return (
    <div className="absolute left-2 right-2 top-2 md:left-4 md:top-4 md:right-auto md:w-80 bg-bg-surface/95 border border-line rounded-xl p-4 shadow-2xl animate-fade-in backdrop-blur-xl">
      <div className="flex items-baseline justify-between mb-2 gap-4">
        <div className="label-mono text-a">{phase.label}</div>
        <button onClick={onClose} className="label-mono text-ink-faint hover:text-ink">
          ×
        </button>
      </div>
      <div className="font-serif text-xl text-ink mb-1">{phase.titel}</div>
      <div className="label-mono text-ink-muted mb-3">
        {fmtDate(phase.start)} — {fmtDate(phase.end)} · temp {phase.temperatur}/10
      </div>
      <p className="serif-body text-base text-ink leading-snug">{phase.kurzbeschreibung}</p>
    </div>
  )
}

function WendepunktDetail({
  kipp,
  onClose,
}: {
  kipp: { datum: string; titel: string; beschreibung: string; beteiligt: string[] }
  onClose: () => void
}) {
  return (
    <div className="absolute left-2 right-2 bottom-2 md:right-4 md:bottom-auto md:top-4 md:w-80 md:left-auto bg-bg-surface/95 border border-b/50 rounded-xl p-4 shadow-2xl animate-fade-in backdrop-blur-xl">
      <div className="flex items-baseline justify-between mb-2 gap-4">
        <div className="label-mono text-b">Wendepunkt · {fmtDate(kipp.datum)}</div>
        <button onClick={onClose} className="label-mono text-ink-faint hover:text-ink">
          ×
        </button>
      </div>
      <div className="font-serif text-xl text-b mb-3">{kipp.titel}</div>
      <p className="serif-body text-base text-ink leading-snug">{kipp.beschreibung}</p>
    </div>
  )
}

/* ---------- helpers ---------- */

interface DailyPoint {
  date: Date
  total: number
  perPerson: Record<string, number>
}

function buildDailySeries(facts: HardFacts): DailyPoint[] {
  // HardFacts gives weekly; to get a smoother curve we split each weekly bucket
  // into 7 equal days. Good enough for a macro view.
  const out: DailyPoint[] = []
  for (const w of facts.weekly) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(+w.weekStart + d * 86400000)
      if (+date < +facts.firstTs - 86400000 || +date > +facts.lastTs + 86400000) continue
      const perPerson: Record<string, number> = {}
      let total = 0
      for (const [p, v] of Object.entries(w.perPerson)) {
        perPerson[p] = v / 7
        total += v / 7
      }
      out.push({ date, total, perPerson })
    }
  }
  return out
}

function isoToMs(iso: string, endOfDay = false): number {
  // "2024-03-12" → local midnight (or 23:59:59 if endOfDay)
  const [y, m, d] = iso.split('-').map((v) => parseInt(v, 10))
  return +new Date(y, (m || 1) - 1, d || 1, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0)
}

function parseLocalDate(s: string): Date | null {
  // Accepts "YYYY-MM-DD" or "YYYY-MM-DD HH:MM"
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(s)
  if (!m) return null
  const [, y, mo, d, hh, mm] = m
  return new Date(
    parseInt(y, 10),
    parseInt(mo, 10) - 1,
    parseInt(d, 10),
    hh ? parseInt(hh, 10) : 0,
    mm ? parseInt(mm, 10) : 0,
  )
}

function yForActivity(v: number, max: number, pad: { top: number }, plotH: number): number {
  // Activity occupies the bottom 40% of the plot to leave room for temperature curve.
  const activityBand = plotH * 0.55
  const top = pad.top + plotH - activityBand
  const h = (v / max) * activityBand
  return Math.max(top, pad.top + plotH - h)
}

function buildTemperatureCurve(
  phasen: TimelinePhase[],
  pad: { top: number; left: number; right: number; bottom: number },
  plotW: number,
  plotH: number,
  xOf: (ts: number) => number,
): string {
  if (phasen.length === 0) return ''
  // Temperature curve occupies the top 50% of the plot.
  const tempBand = plotH * 0.45
  const tempTop = pad.top + 4
  const yOf = (t: number) => tempTop + tempBand - (t / 10) * tempBand
  void plotW

  const points: { x: number; y: number }[] = []
  phasen.forEach((ph, i) => {
    const midMs = (isoToMs(ph.start) + isoToMs(ph.end, true)) / 2
    points.push({ x: xOf(midMs), y: yOf(ph.temperatur) })
    // Also anchor at the boundaries for a more faithful curve
    if (i === 0) points.unshift({ x: xOf(isoToMs(ph.start)), y: yOf(ph.temperatur) })
    if (i === phasen.length - 1) points.push({ x: xOf(isoToMs(ph.end, true)), y: yOf(ph.temperatur) })
  })

  // Catmull-Rom → Bezier smoothing
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  return d
}

function buildDateTicks(start: Date, end: Date): Date[] {
  const days = (+end - +start) / 86400000
  // Choose a reasonable tick cadence: monthly if <6m, bi-monthly otherwise.
  const ticks: Date[] = []
  const d = new Date(start.getFullYear(), start.getMonth(), 1)
  const step = days < 180 ? 1 : 2
  while (+d <= +end) {
    if (+d >= +start) ticks.push(new Date(d))
    d.setMonth(d.getMonth() + step)
  }
  return ticks
}

function fmtDate(iso: string): string {
  const d = parseLocalDate(iso)
  if (!d) return iso
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' })
}

function fmtTick(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

// Temperature → color. Cool blue → neutral → warm coral/red.
function tempFill(t: number): string {
  // t in [1,10]. Return rgba fill.
  const palette = [
    [70, 130, 200], // cold blue
    [70, 130, 200],
    [80, 140, 180],
    [100, 150, 170],
    [140, 160, 160], // neutral
    [180, 150, 140],
    [220, 140, 120],
    [240, 130, 110],
    [250, 120, 100], // warm
    [255, 110, 90],
  ]
  const idx = Math.max(0, Math.min(9, Math.round(t) - 1))
  const [r, g, b] = palette[idx]
  return `rgba(${r},${g},${b},1)`
}

function tempSolid(t: number): string {
  return tempFill(t)
}

function stateLabel(state: string): string {
  return (
    {
      'aufwärts': 'Rising',
      stabil: 'Stable',
      'abwärts': 'Declining',
      gebrochen: 'Broken',
      unklar: 'Unclear',
    } as Record<string, string>
  )[state] ?? state
}

function stateColor(state: string): string {
  return (
    {
      'aufwärts': 'text-a',
      stabil: 'text-ink',
      'abwärts': 'text-b',
      gebrochen: 'text-b',
      unklar: 'text-ink-muted',
    } as Record<string, string>
  )[state] ?? 'text-ink'
}
