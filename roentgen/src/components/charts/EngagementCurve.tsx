import type { HardFacts } from '../../analysis/hardFacts'
import { i18n } from '../../i18n'

interface Props {
  facts: HardFacts
  width?: number
  height?: number
}

const COLORS = ['#0A0A0A', '#FF90BB', '#89b4f4', '#fbbd5c', '#c9a6f0']

export function EngagementCurve({ facts, width = 720, height = 220 }: Props) {
  const { weekly, perPerson } = facts
  if (weekly.length < 2) {
    return <div className="text-ink-muted font-mono text-sm">{i18n.get() === 'de' ? 'Noch nicht genug Daten für eine Kurve.' : 'Not enough data for a curve yet.'}</div>
  }

  const pad = { top: 16, right: 12, bottom: 32, left: 36 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  // Find max per-person weekly count (not total, since we draw separate lines)
  const maxPerPerson = Math.max(
    ...weekly.flatMap((w) => perPerson.map((p) => w.perPerson[p.author] ?? 0)),
    1
  )
  // Round up to nice number for Y-axis
  const yMax = niceMax(maxPerPerson)
  const stepX = innerW / (weekly.length - 1)
  const yOf = (v: number) => pad.top + innerH - (v / yMax) * innerH
  const xOf = (i: number) => pad.left + i * stepX

  // Peak week index
  const peakIdx = weekly.reduce((best, w, i, arr) => w.count > arr[best].count ? i : best, 0)

  // Build per-person line paths
  const personPaths = perPerson.map((p, pIdx) => {
    const points = weekly.map((w, i) => ({
      x: xOf(i),
      y: yOf(w.perPerson[p.author] ?? 0),
    }))
    const d = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
    return { author: p.author, d, color: COLORS[pIdx % COLORS.length], points }
  })

  // Y-axis ticks
  const yTicks = [0, Math.round(yMax / 2), yMax]

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" style={{ minHeight: 180 }}>
        {/* Background grid */}
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={pad.left}
              y1={yOf(v)}
              x2={width - pad.right}
              y2={yOf(v)}
              stroke="#0A0A0A"
              strokeWidth="0.5"
              opacity={v === 0 ? 0.3 : 0.1}
            />
            <text
              x={pad.left - 6}
              y={yOf(v) + 3}
              textAnchor="end"
              fontSize="9"
              fontFamily="'Courier Prime', monospace"
              fill="#0A0A0A"
              opacity="0.4"
            >
              {v}
            </text>
          </g>
        ))}

        {/* Per-person filled areas (subtle) */}
        {personPaths.map(({ author, d, color, points }) => {
          const areaD = `${d} L ${points[points.length - 1].x.toFixed(1)} ${yOf(0).toFixed(1)} L ${points[0].x.toFixed(1)} ${yOf(0).toFixed(1)} Z`
          return (
            <path
              key={`area-${author}`}
              d={areaD}
              fill={color}
              opacity={0.12}
            />
          )
        })}

        {/* Per-person lines */}
        {personPaths.map(({ author, d, color }) => (
          <path
            key={`line-${author}`}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Peak annotation */}
        <line
          x1={xOf(peakIdx)}
          y1={pad.top}
          x2={xOf(peakIdx)}
          y2={yOf(0)}
          stroke="#FFE234"
          strokeWidth="1.5"
          strokeDasharray="3,3"
        />
        <rect
          x={xOf(peakIdx) - 24}
          y={pad.top - 2}
          width="48"
          height="16"
          fill="#FFE234"
          stroke="#0A0A0A"
          strokeWidth="1"
        />
        <text
          x={xOf(peakIdx)}
          y={pad.top + 10}
          textAnchor="middle"
          fontSize="8"
          fontFamily="'Courier Prime', monospace"
          fontWeight="bold"
          fill="#0A0A0A"
        >
          PEAK
        </text>

        {/* Dots at end of each line (current state) */}
        {personPaths.map(({ author, color, points }) => {
          const last = points[points.length - 1]
          return (
            <circle
              key={`dot-${author}`}
              cx={last.x}
              cy={last.y}
              r="4"
              fill={color}
              stroke="#fff"
              strokeWidth="1.5"
            />
          )
        })}

        {/* X-axis labels */}
        <text
          x={pad.left}
          y={height - 6}
          fontSize="9"
          fontFamily="'Courier Prime', monospace"
          fill="#0A0A0A"
          opacity="0.5"
        >
          {fmtDate(weekly[0].weekStart)}
        </text>
        <text
          x={width - pad.right}
          y={height - 6}
          textAnchor="end"
          fontSize="9"
          fontFamily="'Courier Prime', monospace"
          fill="#0A0A0A"
          opacity="0.5"
        >
          {fmtDate(weekly[weekly.length - 1].weekStart)}
        </text>
        <text
          x={width / 2}
          y={height - 6}
          textAnchor="middle"
          fontSize="9"
          fontFamily="'Courier Prime', monospace"
          fill="#0A0A0A"
          opacity="0.35"
        >
          messages per week
        </text>
      </svg>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.14em]">
        {perPerson.map((p, i) => (
          <div key={p.author} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-[3px] rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="text-ink/70">{p.author}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function niceMax(v: number): number {
  if (v <= 10) return 10
  if (v <= 25) return 25
  if (v <= 50) return 50
  const magnitude = Math.pow(10, Math.floor(Math.log10(v)))
  return Math.ceil(v / magnitude) * magnitude
}
