import type { HardFacts } from './hardFacts'

// Local-only symmetry trend — the "objective" side of Modul 04.
// Turns weekly HardFacts aggregates into a time series that shows how the
// balance shifts over the chat's life. Zero AI here; this feeds into the
// Entwicklung view as a diverging-lines chart AND as context for the AI prompt.

export interface SymmetryPoint {
  weekStart: Date
  totalMessages: number
  // share of each person this week (0..1)
  shares: Record<string, number>
  // cumulative share up to this point (rolling)
  cumulativeShares: Record<string, number>
}

export interface SymmetryTrend {
  points: SymmetryPoint[]
  // delta between the two biggest contributors over time (0..1).
  // 0 = perfectly balanced, 1 = one person writes everything.
  deltaSeries: number[]
  // slope of the delta series: positive = diverging (getting more asymmetric)
  trend: 'balanced' | 'diverging' | 'converging' | 'volatile'
  // phrased for prompt-injection — a one-paragraph summary the AI can read
  promptNote: string
}

export function buildSymmetryTrend(facts: HardFacts): SymmetryTrend {
  const { weekly, perPerson } = facts
  const names = perPerson.map((p) => p.author)

  // Cumulative totals for rolling share
  const cumulative: Record<string, number> = {}
  for (const n of names) cumulative[n] = 0

  const points: SymmetryPoint[] = weekly.map((w) => {
    const shares: Record<string, number> = {}
    const total = Math.max(1, w.count)
    for (const n of names) {
      const count = w.perPerson[n] ?? 0
      shares[n] = count / total
      cumulative[n] += count
    }
    const cumulativeTotal = Math.max(
      1,
      Object.values(cumulative).reduce((a, b) => a + b, 0),
    )
    const cumulativeShares: Record<string, number> = {}
    for (const n of names) cumulativeShares[n] = cumulative[n] / cumulativeTotal
    return {
      weekStart: w.weekStart,
      totalMessages: w.count,
      shares,
      cumulativeShares,
    }
  })

  // Delta between top two shares per week
  const deltaSeries = points.map((p) => {
    const sorted = [...Object.values(p.shares)].sort((a, b) => b - a)
    if (sorted.length < 2) return 0
    return Math.abs(sorted[0] - sorted[1])
  })

  // Trend classification via linear regression slope on the delta series.
  const trend = classifyTrend(deltaSeries)

  const promptNote = buildPromptNote(points, deltaSeries, trend, names)

  return { points, deltaSeries, trend, promptNote }
}

function classifyTrend(series: number[]): SymmetryTrend['trend'] {
  if (series.length < 3) return 'balanced'
  const slope = linearSlope(series)
  const mean = series.reduce((a, b) => a + b, 0) / series.length
  const variance = series.reduce((s, v) => s + (v - mean) ** 2, 0) / series.length
  const stdev = Math.sqrt(variance)

  // Thresholds chosen to be informative without being jumpy.
  if (stdev > 0.2 && Math.abs(slope) < 0.004) return 'volatile'
  if (slope > 0.003) return 'diverging'
  if (slope < -0.003) return 'converging'
  // Low slope, low stdev → stable
  if (mean < 0.15) return 'balanced'
  // Stable but asymmetric: still classify as balanced (it's not changing).
  return 'balanced'
}

function linearSlope(series: number[]): number {
  const n = series.length
  if (n < 2) return 0
  const xs = Array.from({ length: n }, (_, i) => i)
  const meanX = (n - 1) / 2
  const meanY = series.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (series[i] - meanY)
    den += (xs[i] - meanX) ** 2
  }
  return den === 0 ? 0 : num / den
}

function buildPromptNote(
  points: SymmetryPoint[],
  deltaSeries: number[],
  trend: SymmetryTrend['trend'],
  names: string[],
): string {
  if (points.length === 0 || names.length < 2) return 'Unzureichend Daten für eine Symmetrie-Aussage.'

  const startDelta = deltaSeries[0] ?? 0
  const endDelta = deltaSeries[deltaSeries.length - 1] ?? 0
  const startPct = Math.round(startDelta * 100)
  const endPct = Math.round(endDelta * 100)

  const startWeek = points[0].weekStart
  const endWeek = points[points.length - 1].weekStart
  const fmt = (d: Date) => d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })

  const labelTrend = {
    diverging: 'Das Investment-Gefälle wächst kontinuierlich',
    converging: 'Das Investment-Gefälle gleicht sich über Zeit an',
    volatile: 'Das Investment-Gefälle schwankt stark über Zeit',
    balanced: 'Das Investment-Gefälle bleibt über Zeit weitgehend stabil',
  }[trend]

  return `Symmetrie-Zeitreihe (lokal berechnet): Zu Beginn (${fmt(startWeek)}) lag das Delta zwischen den Top-Sprechern bei ~${startPct} Prozentpunkten; am Ende (${fmt(endWeek)}) bei ~${endPct} Prozentpunkten. ${labelTrend}.`
}
