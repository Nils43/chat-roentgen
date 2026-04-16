import type { PerPersonStats } from '../../analysis/hardFacts'

interface Props {
  perPerson: PerPersonStats[]
}

// Visualizes power delta between two people. For 3+ participants, shows a ranked list.
export function PowerGauge({ perPerson }: Props) {
  const colors = ['text-a', 'text-b', 'text-blue-400', 'text-orange-400']
  const bgs = ['bg-a', 'bg-b', 'bg-blue-400', 'bg-orange-400']

  if (perPerson.length === 2) {
    const [a, b] = perPerson
    const total = a.powerScore + b.powerScore || 1
    const aPct = (a.powerScore / total) * 100
    const bPct = (b.powerScore / total) * 100
    return (
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className={`metric-num text-4xl md:text-5xl ${colors[0]}`}>{a.powerScore}</div>
            <div className="font-sans text-sm text-ink-muted mt-1">{a.author}</div>
          </div>
          <div className="label-mono text-ink-faint">vs</div>
          <div className="text-right">
            <div className={`metric-num text-4xl md:text-5xl ${colors[1]}`}>{b.powerScore}</div>
            <div className="font-sans text-sm text-ink-muted mt-1">{b.author}</div>
          </div>
        </div>
        <div className="h-2 rounded-full overflow-hidden flex bg-bg-surface mt-6">
          <div className={`${bgs[0]} transition-all duration-1000`} style={{ width: `${aPct}%` }} />
          <div className={`${bgs[1]} transition-all duration-1000`} style={{ width: `${bPct}%` }} />
        </div>
      </div>
    )
  }

  const ranked = [...perPerson].sort((a, b) => b.powerScore - a.powerScore)
  return (
    <div className="space-y-3">
      {ranked.map((p) => (
        <div key={p.author} className="flex items-baseline justify-between gap-3">
          <span className={`font-sans ${colors[perPerson.indexOf(p) % colors.length]}`}>{p.author}</span>
          <div className="flex-1 h-1.5 rounded-full bg-bg-surface overflow-hidden">
            <div
              className={`${bgs[perPerson.indexOf(p) % bgs.length]} h-full`}
              style={{ width: `${p.powerScore}%` }}
            />
          </div>
          <span className="metric-num text-sm w-10 text-right">{p.powerScore}</span>
        </div>
      ))}
    </div>
  )
}
