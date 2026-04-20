import type { HardFacts } from '../../analysis/hardFacts'

interface Props {
  facts: HardFacts
  width?: number
  height?: number
}

// Stacked area per person over weekly buckets. Uses SVG for crisp lines.
export function EngagementCurve({ facts, width = 720, height = 180 }: Props) {
  const { weekly, perPerson } = facts
  if (weekly.length < 2) {
    return <div className="text-ink-muted font-mono text-sm">Not enough time span for a curve yet.</div>
  }

  const palette: Record<string, string> = {}
  const colors = ['#7fe0c4', '#ff9a8b', '#89b4f4', '#fbbd5c', '#c9a6f0']
  perPerson.forEach((p, i) => (palette[p.author] = colors[i % colors.length]))

  const max = Math.max(...weekly.map((w) => w.count))
  const stepX = width / (weekly.length - 1)

  const buildPath = (getY: (w: typeof weekly[number]) => number) =>
    weekly.map((w, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${getY(w)}`).join(' ')

  // For each person: build cumulative area stack
  const cumulative = weekly.map((w) => {
    const acc: Record<string, number> = {}
    let running = 0
    for (const p of perPerson) {
      running += w.perPerson[p.author] ?? 0
      acc[p.author] = running
    }
    return acc
  })

  const yOf = (v: number) => height - (v / max) * height

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        preserveAspectRatio="none"
      >
        {/* Grid */}
        <line x1="0" y1={height} x2={width} y2={height} stroke="#2a323c" strokeWidth="1" />
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1="0"
            y1={height * p}
            x2={width}
            y2={height * p}
            stroke="#2a323c"
            strokeWidth="0.5"
            strokeDasharray="2,4"
          />
        ))}
        {/* Stacked areas (bottom → top) */}
        {[...perPerson].reverse().map((p) => {
          const path =
            buildPath((_, ) => 0).replace('M', 'M').trim() // placeholder, we'll use proper area below
          void path
          const areaTop = weekly.map((_w, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${yOf(cumulative[i][p.author])}`).join(' ')
          const areaBottom = weekly
            .map((_w, i) => {
              const idx = perPerson.indexOf(p)
              const below = idx === 0 ? 0 : cumulative[i][perPerson[idx - 1].author]
              return `L ${(weekly.length - 1 - i) * stepX} ${yOf(below)}`
            })
            .reverse()
            .join(' ')
          return (
            <path
              key={p.author}
              d={`${areaTop} ${areaBottom} Z`}
              fill={palette[p.author]}
              opacity={0.35}
            />
          )
        })}
        {/* Total line on top */}
        <path
          d={buildPath((w) => yOf(w.count))}
          fill="none"
          stroke="#f5f2ea"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mt-3 flex items-baseline justify-between font-mono text-[11px] text-ink-faint">
        <span>{fmtDate(weekly[0].weekStart)}</span>
        <span className="text-ink-muted">Messages · weekly</span>
        <span>{fmtDate(weekly[weekly.length - 1].weekStart)}</span>
      </div>
    </div>
  )
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}
