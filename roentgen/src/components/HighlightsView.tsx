import { useMemo, useState } from 'react'
import type { Highlight, HighlightCategory, HighlightFramework, HighlightsResult } from '../ai/types'

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
  verletzlichkeit: { label: 'Verletzlichkeit', hint: 'jemand öffnet sich' },
  machtverschiebung: { label: 'Machtverschiebung', hint: 'die Dynamik kippt' },
  subtext: { label: 'Subtext', hint: 'zwischen den Zeilen' },
  emotional_peak: { label: 'Emotionaler Peak', hint: 'hohe Temperatur' },
  red_flag: { label: 'Red Flag', hint: 'Muster zur Vorsicht' },
  green_flag: { label: 'Green Flag', hint: 'gesundes Muster' },
  goffman_moment: { label: 'Goffman-Moment', hint: 'Fassade bricht' },
  ignoriert: { label: 'Ignoriert', hint: 'das Schweigen spricht' },
}

const FRAMEWORK_LABEL: Record<HighlightFramework, string> = {
  horney: 'Horney',
  berne: 'Berne',
  bowlby: 'Bowlby',
  adler: 'Adler',
  goffman: 'Goffman',
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

  const visible =
    filter === 'all'
      ? payload.highlights
      : payload.highlights.filter((h) => h.category === filter)

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 pt-12 pb-24 space-y-14">
      <header className="space-y-6">
        <div className="label-mono text-b">Modul 05 · Highlights · AI</div>
        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
          Die Momente, <span className="italic text-ink-muted">die bleiben.</span>
        </h2>
        <p className="serif-body text-lg md:text-xl text-ink-muted max-w-2xl">
          {payload.highlights.length} Einzelnachrichten — ausgewählt nach psychologischer Dichte, nicht nach Lautstärke.
          Jede dekodiert, jede verortet in einem Rahmen.
        </p>
      </header>

      {payload.meta.gesamtbefund && (
        <blockquote className="relative font-serif italic text-2xl md:text-3xl leading-snug text-ink pl-6 border-l-2 border-b/60">
          „{payload.meta.gesamtbefund}"
        </blockquote>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <FilterChip
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label="Alle"
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
            <p className="serif-body text-lg text-ink-muted">Keine Highlights in dieser Kategorie.</p>
          </div>
        )}
      </div>

      <div className="text-center serif-body text-ink-muted italic pt-6 border-t border-line/40">
        „Highlights sind Momente, keine Urteile. Wenn etwas hier dich berührt, nimm es als Anlass zu sprechen, nicht als
        Beweis."
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

      {/* Chat bubble — mimics original style */}
      <div className="mb-6">
        <div className={`inline-flex flex-col max-w-full`}>
          <div className={`label-mono mb-1.5 ${color.text}`}>{highlight.author}</div>
          <div
            className={`rounded-2xl rounded-tl-sm border px-4 py-3 font-sans text-[15px] leading-relaxed ${color.bubble}`}
          >
            {highlight.original_text}
          </div>
        </div>
      </div>

      {/* Toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left group pt-2"
      >
        <span className="label-mono text-ink-muted group-hover:text-ink transition-colors">
          {open ? 'Dekodierung schließen' : 'Dekodierung öffnen'}
        </span>
        <span className={`label-mono ${color.text}`}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="mt-5 pt-5 border-t border-line/40 space-y-4 animate-fade-in">
          <p className="serif-body text-lg text-ink">{highlight.dekodierung}</p>
          <div className="flex items-start gap-3 pt-2">
            <span className="label-mono shrink-0 mt-1">Warum</span>
            <p className="serif-body text-base text-ink-muted italic">{highlight.signifikanz}</p>
          </div>
        </div>
      )}
    </article>
  )
}
