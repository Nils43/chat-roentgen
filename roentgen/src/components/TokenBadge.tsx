import { useTokenState } from '../tokens/store'

interface Props {
  onClick?: () => void
  compact?: boolean
}

export function TokenBadge({ onClick, compact = false }: Props) {
  const { balance } = useTokenState()
  const empty = balance === 0
  const low = balance > 0 && balance < 2

  return (
    <button
      onClick={onClick}
      className={[
        'group flex items-center gap-2 rounded-full border transition-colors',
        compact ? 'px-2.5 py-1' : 'px-3 py-1.5',
        empty
          ? 'border-b/60 bg-b/10 text-b hover:bg-b/15'
          : low
            ? 'border-a/40 bg-a/5 text-a hover:bg-a/10'
            : 'border-line/60 bg-bg-raised/50 text-ink hover:border-ink/40',
      ].join(' ')}
      title={empty ? 'Out of tickets — top up here' : 'Ticket overview'}
    >
      <span
        className={[
          'inline-block rounded-full',
          compact ? 'w-1.5 h-1.5' : 'w-2 h-2',
          empty ? 'bg-b animate-pulse-soft' : 'bg-a',
        ].join(' ')}
        aria-hidden
      />
      <span className="font-mono text-[12px] tabular-nums tracking-tight font-semibold">
        {balance}
      </span>
      {!compact && (
        <span className="label-mono text-ink-muted group-hover:text-ink transition-colors">
          {balance === 1 ? 'Ticket' : 'Tickets'}
        </span>
      )}
    </button>
  )
}
