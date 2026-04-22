import { useEffect, useState } from 'react'
import type { PerPersonStats } from '../../analysis/hardFacts'

// 24-hour radial "wrapped-style" clock.
//
//   • Hour bars extend from the inner hub outward, length ∝ message volume.
//   • The chat's peak hour is highlighted in pop-yellow with a sticker label.
//   • Each participant's own peak hour gets a colored dot on the rim with a
//     name label that tilts outward so it stays readable.
//   • The "night zone" (22–06) is faintly stroked to frame the witching hour.
//   • Bars animate in from the hub on mount (scale X across 700ms).
//
// The goal is big-bold-number drama: you should be able to screenshot this.

interface Props {
  heatmap: number[][] // [dow 0-6][hour 0-23] = count
  perPerson: PerPersonStats[]
  locale: 'en' | 'de'
}

// Extra horizontal breathing room on the viewBox so radially-staggered name
// labels don't clip when two people share a peak hour.
const SIZE = 480
const CX = SIZE / 2
const CY = SIZE / 2
const R_INNER = 80
const R_OUTER = 170
const R_LABEL = 195
const R_DOT = 180

// Distinct person colors — matches the rest of the app's person palette.
const PERSON_HEX = ['#FFE234', '#FF4E3A', '#60A5FA', '#FB923C']
const INK = '#0A0A0A'
const INK_FAINT = '#0A0A0A33'
const INK_MUTED = '#0A0A0A80'

function polar(angleDeg: number, r: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return [CX + Math.cos(rad) * r, CY + Math.sin(rad) * r]
}

// SVG path for an annular segment from h1 → h2 (hours), used for the night-zone.
function arcPath(h1: number, h2: number, rIn: number, rOut: number): string {
  const a1 = (h1 / 24) * 360
  const a2 = (h2 / 24) * 360
  const [x1o, y1o] = polar(a1, rOut)
  const [x2o, y2o] = polar(a2, rOut)
  const [x2i, y2i] = polar(a2, rIn)
  const [x1i, y1i] = polar(a1, rIn)
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0
  return `M ${x1o} ${y1o} A ${rOut} ${rOut} 0 ${large} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${rIn} ${rIn} 0 ${large} 0 ${x1i} ${y1i} Z`
}

export function ChatClock({ heatmap, perPerson, locale }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    // Kick off the grow-from-hub animation on next tick.
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Aggregate total per hour across all 7 days.
  const hourly: number[] = Array(24).fill(0)
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) hourly[h] += heatmap[d]?.[h] ?? 0
  }
  const max = Math.max(...hourly, 1)
  const total = hourly.reduce((a, b) => a + b, 0) || 1
  const peakHour = hourly.reduce((best, c, i, arr) => (c > arr[best] ? i : best), 0)
  const deadHour = hourly.reduce((worst, c, i, arr) => (c < arr[worst] ? i : worst), 0)

  // "Night club" — 22:00–06:00 share. Prime-time — 18:00–23:00 share.
  const nightCount =
    hourly[22] + hourly[23] + hourly[0] + hourly[1] + hourly[2] + hourly[3] + hourly[4] + hourly[5]
  const nightPct = Math.round((nightCount / total) * 100)

  const de = locale === 'de'

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-lg mx-auto block">
        {/* Night zone band — from hour 22 to 6 (wrap through midnight). */}
        <path
          d={arcPath(22, 30 /* 22→06 wraps */, R_INNER - 4, R_OUTER + 6)}
          fill={INK}
          opacity="0.06"
        />

        {/* Hour tick marks every 3 hours (0, 3, 6, …). */}
        {Array.from({ length: 8 }, (_, i) => i * 3).map((h) => {
          const angle = (h / 24) * 360
          const [x1, y1] = polar(angle, R_INNER - 6)
          const [x2, y2] = polar(angle, R_INNER - 2)
          return <line key={`t${h}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK_FAINT} strokeWidth="1" />
        })}

        {/* The hour bars. Each bar at hour h points radially from R_INNER outward.
            Peak bar gets the pop-yellow treatment. */}
        {hourly.map((count, h) => {
          const angle = (h / 24) * 360
          const frac = count / max
          const len = mounted ? frac * (R_OUTER - R_INNER - 8) : 0
          const [x1, y1] = polar(angle, R_INNER)
          const [x2, y2] = polar(angle, R_INNER + len)
          const isPeak = h === peakHour
          return (
            <line
              key={h}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isPeak ? '#FFE234' : INK}
              strokeWidth={isPeak ? 14 : 10}
              strokeLinecap="round"
              style={{
                transition: 'all 700ms cubic-bezier(.2,.8,.2,1)',
                transitionDelay: `${h * 12}ms`,
              }}
            />
          )
        })}

        {/* Outer ring */}
        <circle cx={CX} cy={CY} r={R_OUTER + 2} fill="none" stroke={INK} strokeWidth="2" />
        <circle cx={CX} cy={CY} r={R_INNER - 4} fill="none" stroke={INK} strokeWidth="1.5" />

        {/* Hour labels at cardinal points. */}
        {[
          { h: 0, label: '00' },
          { h: 6, label: '06' },
          { h: 12, label: '12' },
          { h: 18, label: '18' },
        ].map(({ h, label }) => {
          const angle = (h / 24) * 360
          const [x, y] = polar(angle, R_LABEL)
          return (
            <text
              key={h}
              x={x}
              y={y + 5}
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
              fontSize="13"
              fontWeight="600"
              fill={INK_MUTED}
              style={{ letterSpacing: '0.12em' }}
            >
              {label}
            </text>
          )
        })}

        {/* Per-person peak dots on the rim + name labels.
            Collision handling: when two people share the same peak hour, fan
            them out by ±6° per additional person AND stagger the label radius
            so names don't sit on top of each other. First-name only keeps
            labels compact. */}
        {(() => {
          const taken = perPerson.slice(0, 4)
          const buckets: Record<number, typeof taken> = {}
          for (const p of taken) {
            const key = p.peakHour
            if (!buckets[key]) buckets[key] = []
            buckets[key].push(p)
          }
          return taken.map((p, i) => {
            const hex = PERSON_HEX[i] ?? INK
            const bucket = buckets[p.peakHour]
            const bucketIdx = bucket.indexOf(p)
            // Fan out: single → 0°, two → ±6°, three → -8/0/+8°, etc.
            const spread = (bucketIdx - (bucket.length - 1) / 2) * 6
            const angle = (p.peakHour / 24) * 360 + spread
            // Radial stagger for labels when collisions happen — second person
            // gets pushed further out by ~16px.
            const labelR = R_LABEL + 10 + bucketIdx * 16
            const [dx, dy] = polar(angle, R_DOT)
            const [lx, ly] = polar(angle, labelR)
            const firstName = p.author.split(/\s+/)[0] ?? p.author
            return (
              <g key={p.author}>
                <circle cx={dx} cy={dy} r={7} fill={hex} stroke={INK} strokeWidth="2" />
                <text
                  x={lx}
                  y={ly + 4}
                  textAnchor="middle"
                  fontFamily="'Bebas Neue', sans-serif"
                  fontSize="13"
                  fontWeight="700"
                  fill={INK}
                  style={{ letterSpacing: '0.04em' }}
                >
                  {firstName.toUpperCase()}
                </text>
              </g>
            )
          })
        })()}

        {/* Center — big peak-hour headline. */}
        <text
          x={CX}
          y={CY - 2}
          textAnchor="middle"
          fontFamily="'Bebas Neue', sans-serif"
          fontSize="54"
          fill={INK}
          style={{ letterSpacing: '-0.02em' }}
        >
          {String(peakHour).padStart(2, '0')}:00
        </text>
        <text
          x={CX}
          y={CY + 20}
          textAnchor="middle"
          fontFamily="'JetBrains Mono', monospace"
          fontSize="10"
          fill={INK_MUTED}
          style={{ letterSpacing: '0.16em' }}
        >
          {de ? 'PEAK · DIE HOT HOUR' : 'PEAK · THE HOT HOUR'}
        </text>
      </svg>

      {/* Below the clock — punchy stat callouts, Wrapped-style. */}
      <div className="mt-8 grid grid-cols-3 gap-3">
        <Stat
          value={`${nightPct}%`}
          label={de ? 'nach 22 uhr' : 'after 22:00'}
          accent={nightPct >= 30}
        />
        <Stat
          value={`${String(deadHour).padStart(2, '0')}:00`}
          label={de ? 'tote zeit' : 'dead hour'}
        />
        <Stat
          value={hourly[peakHour].toLocaleString(de ? 'de-DE' : 'en-US')}
          label={de ? 'messages um ' + String(peakHour).padStart(2, '0') : 'messages at ' + String(peakHour).padStart(2, '0')}
          accent
        />
      </div>
    </div>
  )
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div
      className={`border-2 border-ink p-3 md:p-4 text-center ${accent ? 'bg-pop-yellow' : 'bg-white'}`}
      style={{ boxShadow: '3px 3px 0 #0A0A0A' }}
    >
      <div
        className="font-serif text-3xl md:text-4xl leading-none text-ink tabular-nums"
        style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}
      >
        {value}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink/60 mt-1.5">
        {label}
      </div>
    </div>
  )
}
