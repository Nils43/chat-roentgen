import { useMemo, useState } from 'react'
import type { Highlight, HighlightCategory, HighlightFramework, HighlightsResult } from '../ai/types'
import { SafetyBanner } from './SafetyBanner'

interface Props {
  result: HighlightsResult
  participants: string[]
}

type ColorSet = {
  text: string
  bg: string
  border: string
  glow: string
  bubble: string
  chipBg: string
}

const PERSON_COLORS: ColorSet[] = [
  {
    text: 'text-a',
    bg: 'bg-a',
    border: 'border-a/40',
    glow: 'bg-a/10',
    bubble: 'bg-a/[0.08] border-a/30 text-ink',
    chipBg: 'bg-a/15',
  },
  {
    text: 'text-b',
    bg: 'bg-b',
    border: 'border-b/40',
    glow: 'bg-b/10',
    bubble: 'bg-b/[0.08] border-b/30 text-ink',
    chipBg: 'bg-b/15',
  },
  {
    text: 'text-blue-300',
    bg: 'bg-blue-400',
    border: 'border-blue-400/40',
    glow: 'bg-blue-400/10',
    bubble: 'bg-blue-400/[0.08] border-blue-400/30 text-ink',
    chipBg: 'bg-blue-400/15',
  },
  {
    text: 'text-orange-300',
    bg: 'bg-orange-400',
    border: 'border-orange-400/40',
    glow: 'bg-orange-400/10',
    bubble: 'bg-orange-400/[0.08] border-orange-400/30 text-ink',
    chipBg: 'bg-orange-400/15',
  },
]

const CATEGORY_META: Record<HighlightCategory, { label: string; hint: string }> = {
  verletzlichkeit: { label: 'Opening up', hint: 'someone gets vulnerable' },
  machtverschiebung: { label: 'Turning point', hint: 'the dynamic tilts' },
  subtext: { label: 'Between the lines', hint: "what isn't said" },
  emotional_peak: { label: 'Peak moment', hint: 'temperature spikes' },
  red_flag: { label: 'Red flag', hint: 'look closer' },
  green_flag: { label: 'Green flag', hint: 'healthy pattern' },
  goffman_moment: { label: 'Facade drops', hint: 'an honest moment' },
  ignoriert: { label: 'Ignored', hint: 'the silence speaks' },
}

const FRAMEWORK_LABEL: Record<HighlightFramework, string> = {
  horney: 'Closeness & distance',
  berne: 'Inner voice',
  bowlby: 'Attachment',
  adler: 'Compensation',
  goffman: 'Role & facade',
  keiner: '—',
}

type Filter = 'all' | HighlightCategory

export function HighlightsView({ result, participants }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const { payload } = result

  const colorByAuthor = useMemo(() => {
    const map = new Map<string, ColorSet>()
    participants.forEach((p, i) => map.set(p, PERSON_COLORS[i % PERSON_COLORS.length]))
    return map
  }, [participants])

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<HighlightCategory, number>> = {}
    for (const h of payload.highlights) {
      counts[h.category] = (counts[h.category] ?? 0) + 1
    }
    return counts
  }, [payload.highlights])

  const redFlags = useMemo(
    () => payload.highlights.filter((h) => h.category === 'red_flag'),
    [payload.highlights],
  )

  const visible =
    filter === 'all'
      ? payload.highlights
      : payload.highlights.filter((h) => h.category === filter)

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 pt-12 pb-24 space-y-14">
      <header className="space-y-6">
        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
          The moments <span className="italic text-ink-muted">that stick.</span>
        </h2>
        <p className="serif-body text-lg md:text-xl text-ink-muted max-w-2xl">
          {payload.highlights.length} messages that say a lot — not loud, but dense.
        </p>
      </header>

      {redFlags.length >= 2 && (
        <SafetyBanner
          pattern={`${redFlags.length} of the ${payload.highlights.length} flagged moments are red flags. When patterns like these stack up, it's rarely a coincidence.`}
          context={redFlags[0]?.dekodierung}
        />
      )}

      {payload.meta.gesamtbefund && (
        <blockquote className="relative font-serif italic text-2xl md:text-3xl leading-snug text-ink pl-6 border-l-2 border-b/60">
          "{payload.meta.gesamtbefund}"
        </blockquote>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <FilterChip
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label="All"
          count={payload.highlights.length}
        />
        {(Object.keys(CATEGORY_META) as HighlightCategory[])
          .filter((c) => (categoryCounts[c] ?? 0) > 0)
          .map((c) => (
            <FilterChip
              key={c}
              active={filter === c}
              onClick={() => setFilter(c)}
              label={CATEGORY_META[c].label}
              count={categoryCounts[c] ?? 0}
            />
          ))}
      </div>

      {/* Highlights */}
      <div className="space-y-6">
        {visible.map((h, i) => (
          <HighlightCard
            key={`${h.index}-${i}`}
            highlight={h}
            color={colorByAuthor.get(h.author) ?? PERSON_COLORS[0]}
            rank={i + 1}
          />
        ))}
        {visible.length === 0 && (
          <div className="card text-center">
            <p className="serif-body text-lg text-ink-muted">Nothing in this category.</p>
          </div>
        )}
      </div>

      <div className="text-center serif-body text-ink-muted italic pt-6 border-t border-line/40">
        "These are moments, not verdicts. If something lands, it's a reason to talk — not proof of anything."
      </div>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className={`label-mono px-3 py-1.5 rounded-full border transition-all ${
        active
          ? 'bg-ink text-bg border-ink'
          : 'border-line/60 text-ink-muted hover:text-ink hover:border-ink/50'
      }`}
    >
      {label} <span className="opacity-60">· {count}</span>
    </button>
  )
}

function HighlightCard({
  highlight,
  color,
  rank,
}: {
  highlight: Highlight
  color: ColorSet
  rank: number
}) {
  const [open, setOpen] = useState(rank <= 3)
  const cat = CATEGORY_META[highlight.category]
  const frameworkLabel = FRAMEWORK_LABEL[highlight.framework]

  return (
    <article className="card relative overflow-hidden">
      <div className={`absolute -top-16 -right-16 w-48 h-48 rounded-full ${color.glow} blur-3xl pointer-events-none`} />

      <header className="relative flex items-baseline justify-between mb-5">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="label-mono text-ink-faint">#{String(rank).padStart(2, '0')}</span>
          <span className={`label-mono ${color.text}`}>{cat.label}</span>
          {highlight.framework !== 'keiner' && (
            <span className="label-mono text-ink-muted">· {frameworkLabel}</span>
          )}
        </div>
        <div className="label-mono text-ink-faint shrink-0">{highlight.timestamp}</div>
      </header>

      <h3 className="font-serif text-2xl md:text-3xl leading-tight mb-5 text-ink">
        {highlight.titel}
      </h3>

      {/* Pattern frame — moment metadata, no verbatim quote */}
      <div className={`mb-6 border-l-2 ${color.bg.replace('bg-', 'border-')} pl-4 py-1`}>
        <div className={`label-mono ${color.text}`}>{highlight.author}</div>
      </div>

      {/* Toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left group pt-2"
      >
        <span className="label-mono text-ink-muted group-hover:text-ink transition-colors">
          {open ? 'Close reading' : 'Read it'}
        </span>
        <span className={`label-mono ${color.text}`}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="mt-5 pt-5 border-t border-line/40 space-y-4 animate-fade-in">
          <p className="serif-body text-lg text-ink">{highlight.dekodierung}</p>
          <div className="flex items-start gap-3 pt-2">
            <span className="label-mono shrink-0 mt-1">Why</span>
            <p className="serif-body text-base text-ink-muted italic">{highlight.signifikanz}</p>
          </div>
        </div>
      )}
    </article>
  )
}
