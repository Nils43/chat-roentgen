import type { PerPersonStats } from '../../analysis/hardFacts'

interface Props {
  perPerson: PerPersonStats[]
  metric?: 'share' | 'words' | 'initiation'
  label?: string
}

export function SplitBar({ perPerson, metric = 'share', label }: Props) {
  const values = perPerson.map((p) => {
    if (metric === 'words') return p.words
    if (metric === 'initiation') return p.initiations
    return p.messages
  })
  const total = values.reduce((a, b) => a + b, 0) || 1

  const colors = ['bg-a', 'bg-b', 'bg-blue-400', 'bg-orange-400', 'bg-violet-400']
  const textColors = ['text-a', 'text-b', 'text-blue-400', 'text-orange-400', 'text-violet-400']

  return (
    <div>
      {label && <div className="label-mono mb-3">{label}</div>}
      <div className="h-3 rounded-full overflow-hidden flex bg-bg-surface">
        {perPerson.map((p, i) => {
          const pct = (values[i] / total) * 100
          return (
            <div
              key={p.author}
              className={`${colors[i % colors.length]} transition-all duration-1000 ease-out`}
              style={{ width: `${pct}%` }}
            />
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {perPerson.map((p, i) => {
          const pct = (values[i] / total) * 100
          return (
            <div key={p.author} className="flex items-baseline gap-3">
              <span className={`metric-num text-2xl md:text-3xl ${textColors[i % textColors.length]}`}>
                {pct.toFixed(0)}%
              </span>
              <span className="font-sans text-sm text-ink-muted">{p.author}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
