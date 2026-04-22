import type { PerPersonStats } from '../../analysis/hardFacts'
import { useLocale } from '../../i18n'

interface Props {
  perPerson: PerPersonStats[]
}

export function ReplyDistribution({ perPerson }: Props) {
  const locale = useLocale()
  const de = locale === 'de'
  const buckets = [
    { key: 'under5m', label: de ? 'unter 5 Minuten' : 'under 5 minutes' },
    { key: 'under1h', label: de ? 'unter 1 Stunde' : 'under 1 hour' },
    { key: 'under1d', label: de ? 'unter 1 Tag' : 'under 1 day' },
    { key: 'over1d', label: de ? 'über 1 Tag' : 'over 1 day' },
  ] as const
  const replyHeader = de ? 'antwortet innerhalb von' : 'replies within'
  const answerNoun = de ? 'Antworten' : 'replies'
  const colors = ['bg-a', 'bg-b', 'bg-blue-400', 'bg-orange-400']
  const textColors = ['text-a', 'text-b', 'text-blue-400', 'text-orange-400']

  return (
    <div className="space-y-5">
      {perPerson.map((p, i) => {
        const total =
          p.replyBuckets.under5m + p.replyBuckets.under1h + p.replyBuckets.under1d + p.replyBuckets.over1d || 1
        return (
          <div key={p.author}>
            <div className="flex items-baseline justify-between mb-2">
              <span className={`font-sans text-sm ${textColors[i % textColors.length]}`}>{p.author}</span>
              <span className="label-mono">{replyHeader}</span>
            </div>
            <div className="flex gap-1">
              {buckets.map((b) => {
                const v = p.replyBuckets[b.key]
                const pct = (v / total) * 100
                return (
                  <div
                    key={b.key}
                    className="flex-1 text-center"
                    title={`${b.label}: ${v} ${answerNoun} (${pct.toFixed(0)}%)`}
                  >
                    <div
                      className={`${colors[i % colors.length]} rounded-sm transition-all duration-1000 ease-out`}
                      style={{ height: `${4 + pct * 0.6}px`, opacity: 0.4 + (pct / 100) * 0.6 }}
                    />
                    <div className="mt-2 metric-num text-sm">{pct.toFixed(0)}%</div>
                    <div className="label-mono mt-0.5">{b.label}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
