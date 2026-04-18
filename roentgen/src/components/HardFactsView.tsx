import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { HardFacts, PerPersonStats } from '../analysis/hardFacts'
import { formatDuration } from '../analysis/hardFacts'
import { SplitBar } from './charts/SplitBar'
import { Heatmap } from './charts/Heatmap'
import { EngagementCurve } from './charts/EngagementCurve'
import { ReplyDistribution } from './charts/ReplyDistribution'
import { PowerGauge } from './charts/PowerGauge'

interface Props {
  facts: HardFacts
  onStartAi?: () => void
}

type Accent = 'a' | 'b' | 'ink'

interface ComparePane {
  author: string
  value: ReactNode
  sub?: string
  accent: Accent
}

type Slide =
  | { kind: 'cover' }
  | { kind: 'stat'; label: string; value: ReactNode; hint?: string; accent?: Accent }
  | { kind: 'breather'; variant: 'breathe' | 'quote' | 'dots' | 'sticker' | 'ellipsis'; text?: string; symbol?: string }
  | { kind: 'split'; title: string; metric: 'share' | 'words' | 'initiation'; caption?: string }
  | { kind: 'compare'; title: string; left: ComparePane; right: ComparePane; caption?: string }
  | { kind: 'replyDist'; title: string; caption?: string }
  | { kind: 'heatmap'; caption?: string }
  | { kind: 'curve'; caption?: string }
  | { kind: 'power'; caption?: string }
  | { kind: 'cta' }

// ---------- Slide-Plan ----------

function buildSlides(facts: HardFacts): Slide[] {
  const [a, b] = facts.perPerson
  const twoPeople = facts.perPerson.length === 2 && !!a && !!b
  const slides: Slide[] = []

  slides.push({ kind: 'cover' })

  slides.push({
    kind: 'stat',
    label: 'nachrichten insgesamt',
    value: facts.totalMessages.toLocaleString('de-DE'),
    hint: `in ${facts.durationDays} tagen`,
  })

  slides.push({
    kind: 'stat',
    label: 'wörter',
    value: facts.totalWords.toLocaleString('de-DE'),
    hint: romanHint(facts.totalWords),
  })

  if (facts.totalEmojis > 0) {
    slides.push({
      kind: 'stat',
      label: 'emojis',
      value: facts.totalEmojis.toLocaleString('de-DE'),
      hint: facts.totalEmojis > 500 ? 'nicht gerade sparsam' : undefined,
    })
  }

  slides.push({ kind: 'breather', variant: 'breathe', text: 'einmal durchatmen.' })

  if (twoPeople) {
    slides.push({ kind: 'split', title: 'wer schreibt mehr?', metric: 'share' })

    const longer = a.avgWords >= b.avgWords ? a : b
    slides.push({
      kind: 'compare',
      title: 'und wer schreibt länger?',
      left:  { author: a.author, value: a.avgWords.toFixed(1), sub: 'wörter pro nachricht', accent: 'a' },
      right: { author: b.author, value: b.avgWords.toFixed(1), sub: 'wörter pro nachricht', accent: 'b' },
      caption: `${longer.author} schreibt im schnitt die längeren nachrichten.`,
    })
  }

  slides.push({ kind: 'breather', variant: 'quote', text: 'jede nachricht ist eine kleine entscheidung.' })

  if (twoPeople) {
    const fast = pickFaster(a, b)
    if (fast) {
      slides.push({
        kind: 'stat',
        label: `${fast.author} antwortet am schnellsten`,
        value: formatDuration(fast.medianReplyMs),
        hint: 'median — also die mitte aller antwortzeiten',
        accent: fast === a ? 'a' : 'b',
      })
    }
    slides.push({
      kind: 'replyDist',
      title: 'wie schnell kommt die antwort?',
      caption: 'unter 5 min · unter 1 h · unter 1 tag · drüber.',
    })
  }

  slides.push({ kind: 'breather', variant: 'dots', text: 'nächster gedanke …' })

  if (twoPeople) {
    slides.push({
      kind: 'split',
      title: 'wer meldet sich zuerst?',
      metric: 'initiation',
      caption: 'gezählt nach mindestens 4h stille.',
    })

    const curious = a.questionRatio >= b.questionRatio ? a : b
    slides.push({
      kind: 'stat',
      label: `${curious.author} fragt mehr`,
      value: `${(curious.questionRatio * 100).toFixed(0)}%`,
      hint: 'der nachrichten enthalten ein ?',
      accent: curious === a ? 'a' : 'b',
    })
  }

  slides.push({ kind: 'breather', variant: 'sticker', symbol: '✧', text: 'ein beat.' })

  if (twoPeople) {
    const soft = a.hedgeRatio >= b.hedgeRatio ? a : b
    if (soft.hedgeRatio >= 0.08) {
      slides.push({
        kind: 'stat',
        label: `${soft.author} schreibt oft weich`,
        value: `${(soft.hedgeRatio * 100).toFixed(0)}%`,
        hint: '„vielleicht" · „eigentlich" · „irgendwie"',
        accent: soft === a ? 'a' : 'b',
      })
    }

    if (a.topEmojis.length || b.topEmojis.length) {
      slides.push({
        kind: 'compare',
        title: 'lieblings-emojis',
        left:  { author: a.author, value: joinEmojis(a.topEmojis), sub: 'top 3', accent: 'a' },
        right: { author: b.author, value: joinEmojis(b.topEmojis), sub: 'top 3', accent: 'b' },
      })
    }
  }

  slides.push({ kind: 'breather', variant: 'breathe', text: 'halt kurz.' })

  if (facts.peakDay.date) {
    slides.push({
      kind: 'stat',
      label: 'euer lautester tag',
      value: fmtDayKey(facts.peakDay.date),
      hint: `${facts.peakDay.count} nachrichten an einem tag`,
    })
  }

  slides.push({
    kind: 'heatmap',
    caption: 'wann geschrieben wird. je heller das kästchen, desto mehr.',
  })

  if (facts.longestSilenceDays >= 1) {
    slides.push({
      kind: 'stat',
      label: 'längste stille',
      value: `${facts.longestSilenceDays} ${facts.longestSilenceDays === 1 ? 'tag' : 'tage'}`,
      hint: `aktiv an ${facts.activeDays} von ${facts.durationDays} tagen`,
    })
  }

  slides.push({ kind: 'breather', variant: 'ellipsis', text: 'jetzt die kurve.' })

  slides.push({ kind: 'curve', caption: 'eure kommunikation über die zeit.' })

  if (twoPeople) {
    slides.push({
      kind: 'power',
      caption: 'wer hängt mehr drin — und wer hält sich eher zurück.',
    })
  }

  slides.push({ kind: 'cta' })

  return slides
}

function pickFaster(a: PerPersonStats, b: PerPersonStats): PerPersonStats | null {
  const am = a.medianReplyMs
  const bm = b.medianReplyMs
  if (am == null && bm == null) return null
  if (am == null) return b
  if (bm == null) return a
  return am <= bm ? a : b
}

function joinEmojis(top: { emoji: string }[]): string {
  return top.slice(0, 3).map((e) => e.emoji).join('  ') || '—'
}

function romanHint(words: number): string | undefined {
  const r = words / 60000
  if (r < 0.2) return undefined
  if (r < 1) return `≈ ${Math.max(0.2, Math.round(r * 10) / 10)} romane wert`
  return `≈ ${Math.round(r * 10) / 10} romane wert`
}

function fmtDayKey(key: string): string {
  if (!key) return '—'
  const [y, m, d] = key.split('-')
  return `${d}.${m}.${y.slice(2)}`
}

function accentText(a?: Accent): string {
  if (a === 'a') return 'text-a'
  if (a === 'b') return 'text-b'
  return 'text-ink'
}

function accentGlow(a?: Accent): string {
  if (a === 'a') return 'bg-a-glow'
  if (a === 'b') return 'bg-b-glow'
  return 'bg-ink/20'
}

// ---------- Main ----------

export function HardFactsView({ facts, onStartAi }: Props) {
  const slides = useMemo(() => buildSlides(facts), [facts])
  const [idx, setIdx] = useState(0)

  const total = slides.length
  const clampIdx = (n: number) => Math.max(0, Math.min(total - 1, n))
  const next = () => setIdx((i) => clampIdx(i + 1))
  const prev = () => setIdx((i) => clampIdx(i - 1))

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [idx])

  const slide = slides[idx]
  const atEnd = idx === total - 1

  return (
    <div className="relative min-h-[calc(100vh-80px)] select-none">
      <StoryProgress count={total} active={idx} />

      {/* Tap-Zonen: nur die äußeren Streifen, Mitte bleibt interaktiv für Charts */}
      <button
        aria-label="zurück"
        onClick={prev}
        disabled={idx === 0}
        className="absolute left-0 top-[48px] bottom-0 w-[18%] md:w-[14%] z-10 cursor-w-resize disabled:cursor-default focus:outline-none group"
      >
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 label-mono text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity hidden md:inline">
          ←
        </span>
      </button>
      <button
        aria-label="weiter"
        onClick={next}
        disabled={atEnd}
        className="absolute right-0 top-[48px] bottom-0 w-[18%] md:w-[14%] z-10 cursor-e-resize disabled:cursor-default focus:outline-none group"
      >
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 label-mono text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity hidden md:inline">
          →
        </span>
      </button>

      {/* Slide-Content */}
      <div key={idx} className="relative z-0 mx-auto max-w-3xl px-5 md:px-8 pt-12 pb-32 md:pt-20 animate-fade-in">
        <SlideView slide={slide} facts={facts} onStartAi={onStartAi} onNext={next} />
      </div>

      {/* Bottom Dock */}
      <div className="fixed bottom-5 inset-x-0 px-5 md:px-8 flex items-center justify-between z-20 pointer-events-none">
        <span className="label-mono text-ink-faint pointer-events-auto">
          {idx + 1}<span className="opacity-50"> / {total}</span>
        </span>
        <div className="flex items-center gap-5 pointer-events-auto">
          <button
            onClick={prev}
            disabled={idx === 0}
            className="label-mono text-ink-muted hover:text-ink transition-colors disabled:opacity-30 disabled:cursor-default"
          >
            ←
          </button>
          <button
            onClick={next}
            disabled={atEnd}
            className={`label-mono transition-colors ${atEnd ? 'text-ink-faint cursor-default' : 'text-ink hover:text-a'}`}
          >
            {atEnd ? 'ende' : 'weiter →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Progress ----------

function StoryProgress({ count, active }: { count: number; active: number }) {
  return (
    <div className="sticky top-[57px] md:top-[65px] z-30 px-5 md:px-8 py-2.5 bg-bg/75 backdrop-blur-md">
      <div className="flex gap-1 max-w-5xl mx-auto">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="h-[2px] flex-1 rounded-full bg-line/40 overflow-hidden">
            <div
              className={`h-full bg-ink transition-all duration-500 ${
                i < active ? 'w-full' : i === active ? 'w-full' : 'w-0'
              }`}
              style={{ opacity: i > active ? 0 : i === active ? 1 : 0.55 }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- Slide-Switch ----------

function SlideView({
  slide,
  facts,
  onStartAi,
  onNext,
}: {
  slide: Slide
  facts: HardFacts
  onStartAi?: () => void
  onNext: () => void
}) {
  switch (slide.kind) {
    case 'cover':
      return <CoverSlide facts={facts} onNext={onNext} />
    case 'stat':
      return <StatSlide {...slide} />
    case 'breather':
      return <BreatherSlide {...slide} />
    case 'split':
      return <SplitSlide facts={facts} {...slide} />
    case 'compare':
      return <CompareSlide {...slide} />
    case 'replyDist':
      return <ReplyDistSlide facts={facts} {...slide} />
    case 'heatmap':
      return <HeatmapSlide facts={facts} {...slide} />
    case 'curve':
      return <CurveSlide facts={facts} {...slide} />
    case 'power':
      return <PowerSlide facts={facts} {...slide} />
    case 'cta':
      return <CtaSlide facts={facts} onStartAi={onStartAi} />
  }
}

// ---------- Slides ----------

function heroAnim(delayMs = 0) {
  return { animation: `storyHeroIn 700ms ${delayMs}ms cubic-bezier(.2,.8,.2,1) both` }
}

function CoverSlide({ facts, onNext }: { facts: HardFacts; onNext: () => void }) {
  const names = facts.perPerson.map((p) => p.author)
  const pair = names.length === 2 ? `${names[0]}  ·  ${names[1]}` : names.join('  ·  ')

  return (
    <div className="min-h-[70vh] flex flex-col justify-center text-center space-y-8">
      <div className="mx-auto relative">
        <div
          className="absolute -inset-24 rounded-full bg-a-glow blur-3xl"
          style={{ animation: 'storyGlow 4.5s ease-in-out infinite' }}
        />
        <div
          className="relative w-20 h-20 rounded-full border border-line/60 grid place-items-center"
          style={{ animation: 'storyBreathe 4.5s ease-in-out infinite' }}
        >
          <div className="w-2 h-2 rounded-full bg-a" />
        </div>
      </div>

      <div className="space-y-4" style={heroAnim(100)}>
        <p className="font-serif italic text-xl md:text-2xl text-ink-muted">ok.</p>
        <h1 className="font-serif text-5xl md:text-7xl leading-[1.02] tracking-tight">
          <span className="metric-num text-ink">{facts.totalMessages.toLocaleString('de-DE')}</span>
          <span className="text-ink-muted"> nachrichten.</span>
          <br />
          <span className="metric-num text-ink">{facts.durationDays}</span>
          <span className="text-ink-muted"> tage.</span>
        </h1>
        <p className="font-sans text-sm tracking-wide text-ink-muted">{pair}</p>
      </div>

      <button
        onClick={onNext}
        className="mx-auto mt-6 label-mono text-ink-muted hover:text-ink transition-colors"
        style={heroAnim(500)}
      >
        tippen um zu starten  →
      </button>
    </div>
  )
}

function StatSlide({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: ReactNode
  hint?: string
  accent?: Accent
}) {
  return (
    <div className="min-h-[65vh] flex flex-col justify-center text-center space-y-10">
      <div className="label-mono" style={heroAnim(0)}>
        {label}
      </div>

      <div className="relative mx-auto" style={heroAnim(120)}>
        <div
          className={`absolute -inset-20 md:-inset-28 rounded-full blur-3xl ${accentGlow(accent)}`}
          style={{ animation: 'storyGlow 4.5s ease-in-out infinite' }}
        />
        <div
          className={`relative metric-num text-7xl md:text-[9rem] leading-none tracking-tight ${accentText(accent)}`}
        >
          {value}
        </div>
      </div>

      {hint && (
        <p className="serif-body text-lg md:text-2xl text-ink-muted max-w-xl mx-auto" style={heroAnim(260)}>
          {hint}
        </p>
      )}
    </div>
  )
}

function BreatherSlide({
  variant,
  text,
  symbol,
}: {
  variant: 'breathe' | 'quote' | 'dots' | 'sticker' | 'ellipsis'
  text?: string
  symbol?: string
}) {
  if (variant === 'quote') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
        <div className="font-serif text-ink-faint text-4xl leading-none" style={heroAnim(0)}>„</div>
        <p
          className="font-serif italic text-3xl md:text-5xl leading-tight text-ink max-w-2xl"
          style={heroAnim(150)}
        >
          {text}
        </p>
      </div>
    )
  }

  if (variant === 'breathe') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-8">
        <div className="relative">
          <div
            className="absolute -inset-20 rounded-full bg-a-glow blur-3xl"
            style={{ animation: 'storyGlow 4.5s ease-in-out infinite' }}
          />
          <div
            className="relative w-40 h-40 md:w-52 md:h-52 rounded-full border border-a/40"
            style={{ animation: 'storyBreathe 4.5s ease-in-out infinite' }}
          />
        </div>
        <p className="font-serif italic text-xl md:text-2xl text-ink-muted" style={heroAnim(200)}>
          {text ?? 'atme.'}
        </p>
      </div>
    )
  }

  if (variant === 'dots') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-8">
        <div className="flex items-center gap-3">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-3 h-3 rounded-full bg-ink"
              style={{ animation: `storyDot 1.4s ease-in-out ${i * 0.18}s infinite` }}
            />
          ))}
        </div>
        <p className="label-mono text-ink-muted" style={heroAnim(200)}>
          {text ?? 'einen moment.'}
        </p>
      </div>
    )
  }

  if (variant === 'sticker') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-8">
        <div
          className="text-7xl md:text-8xl text-a"
          style={{ animation: 'storyFloat 4.5s ease-in-out infinite' }}
        >
          {symbol ?? '✧'}
        </div>
        <p className="font-serif italic text-lg md:text-xl text-ink-muted" style={heroAnim(200)}>
          {text ?? 'kurze pause.'}
        </p>
      </div>
    )
  }

  // ellipsis
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-8">
      <div className="flex items-center gap-4 font-serif italic text-2xl md:text-3xl text-ink-muted">
        {['noch', 'was', 'kleines'].map((w, i) => (
          <span
            key={w}
            style={{ animation: `storyDrift 2.8s ease-in-out ${i * 0.25}s infinite` }}
          >
            {w}
          </span>
        ))}
      </div>
      <p className="label-mono text-ink-faint" style={heroAnim(300)}>
        {text ?? '… und weiter.'}
      </p>
    </div>
  )
}

function SplitSlide({
  title,
  metric,
  caption,
  facts,
}: {
  title: string
  metric: 'share' | 'words' | 'initiation'
  caption?: string
  facts: HardFacts
}) {
  const label =
    metric === 'initiation'
      ? `${facts.perPerson.reduce((s, p) => s + p.initiations, 0)} gespräche angestoßen`
      : metric === 'words'
        ? 'wort-anteil'
        : 'nachrichten-anteil'

  return (
    <div className="min-h-[60vh] flex flex-col justify-center space-y-10">
      <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight text-center" style={heroAnim(0)}>
        {title}
      </h2>

      <div className="card" style={heroAnim(180)}>
        <SplitBar perPerson={facts.perPerson} metric={metric} label={label} />
      </div>

      {caption && (
        <p className="serif-body text-lg md:text-xl text-ink-muted max-w-xl mx-auto text-center" style={heroAnim(320)}>
          {caption}
        </p>
      )}
    </div>
  )
}

function CompareSlide({
  title,
  left,
  right,
  caption,
}: {
  title: string
  left: ComparePane
  right: ComparePane
  caption?: string
}) {
  return (
    <div className="min-h-[60vh] flex flex-col justify-center space-y-10">
      <h2 className="font-serif text-3xl md:text-5xl leading-[1.05] tracking-tight text-center" style={heroAnim(0)}>
        {title}
      </h2>

      <div className="grid grid-cols-2 gap-3 md:gap-5" style={heroAnim(160)}>
        <ComparePaneView pane={left} />
        <ComparePaneView pane={right} />
      </div>

      {caption && (
        <p className="serif-body text-lg md:text-xl text-ink-muted max-w-xl mx-auto text-center" style={heroAnim(300)}>
          {caption}
        </p>
      )}
    </div>
  )
}

function ComparePaneView({ pane }: { pane: ComparePane }) {
  return (
    <div className="card text-center relative overflow-hidden">
      <div className={`absolute -inset-16 blur-3xl ${accentGlow(pane.accent)}`} />
      <div className="relative">
        <div className={`label-mono mb-4 ${accentText(pane.accent)}`}>{pane.author}</div>
        <div className={`metric-num text-5xl md:text-7xl leading-none ${accentText(pane.accent)}`}>
          {pane.value}
        </div>
        {pane.sub && <div className="label-mono mt-4 text-ink-muted">{pane.sub}</div>}
      </div>
    </div>
  )
}

function ReplyDistSlide({
  title,
  caption,
  facts,
}: {
  title: string
  caption?: string
  facts: HardFacts
}) {
  return (
    <div className="min-h-[60vh] flex flex-col justify-center space-y-10">
      <h2 className="font-serif text-3xl md:text-5xl leading-[1.05] tracking-tight text-center" style={heroAnim(0)}>
        {title}
      </h2>
      <div className="card" style={heroAnim(160)}>
        <ReplyDistribution perPerson={facts.perPerson} />
      </div>
      {caption && (
        <p className="label-mono text-ink-muted text-center" style={heroAnim(300)}>
          {caption}
        </p>
      )}
    </div>
  )
}

function HeatmapSlide({ caption, facts }: { caption?: string; facts: HardFacts }) {
  return (
    <div className="min-h-[60vh] flex flex-col justify-center space-y-10">
      <h2 className="font-serif text-3xl md:text-5xl leading-[1.05] tracking-tight text-center" style={heroAnim(0)}>
        wann geschrieben wird
      </h2>
      <div className="card" style={heroAnim(160)}>
        <Heatmap matrix={facts.heatmap} />
      </div>
      {caption && (
        <p className="serif-body text-base md:text-lg text-ink-muted max-w-xl mx-auto text-center" style={heroAnim(300)}>
          {caption}
        </p>
      )}
    </div>
  )
}

function CurveSlide({ caption, facts }: { caption?: string; facts: HardFacts }) {
  return (
    <div className="min-h-[60vh] flex flex-col justify-center space-y-10">
      <h2 className="font-serif text-3xl md:text-5xl leading-[1.05] tracking-tight text-center" style={heroAnim(0)}>
        die kurve
      </h2>
      <div className="card" style={heroAnim(160)}>
        <EngagementCurve facts={facts} />
      </div>
      {caption && (
        <p className="serif-body text-base md:text-lg text-ink-muted max-w-xl mx-auto text-center" style={heroAnim(300)}>
          {caption}
        </p>
      )}
    </div>
  )
}

function PowerSlide({ caption, facts }: { caption?: string; facts: HardFacts }) {
  return (
    <div className="min-h-[60vh] flex flex-col justify-center space-y-10">
      <h2 className="font-serif text-3xl md:text-5xl leading-[1.05] tracking-tight text-center" style={heroAnim(0)}>
        wer hängt mehr drin?
      </h2>
      <div className="card" style={heroAnim(160)}>
        <PowerGauge perPerson={facts.perPerson} />
      </div>
      {caption && (
        <p className="serif-body text-base md:text-lg text-ink-muted max-w-xl mx-auto text-center" style={heroAnim(300)}>
          {caption}
        </p>
      )}
      <p className="label-mono text-ink-faint text-center" style={heroAnim(420)}>
        kein urteil — nur ein muster aus volumen, initiative & tempo.
      </p>
    </div>
  )
}

function CtaSlide({ facts, onStartAi }: { facts: HardFacts; onStartAi?: () => void }) {
  const a = facts.perPerson[0]
  const b = facts.perPerson[1]

  return (
    <div className="min-h-[70vh] flex flex-col justify-center space-y-10">
      <div className="text-center space-y-5" style={heroAnim(0)}>
        <p className="label-mono text-ink-muted">zahlen sind durch.</p>
        <h2 className="font-serif text-4xl md:text-6xl leading-[1.02] tracking-tight">
          jetzt das,
          <br />
          <span className="italic text-ink-muted">was die zahlen nicht sagen.</span>
        </h2>
      </div>

      <div className="card relative overflow-hidden" style={heroAnim(200)}>
        <div className="filter blur-md select-none pointer-events-none space-y-3 font-serif text-lg text-ink-muted">
          {a && (
            <p>
              {a.author} schreibt schnell, aber mit sehr viel „vielleicht" — ein muster das meistens bedeutet, dass …
            </p>
          )}
          {b && (
            <p>
              {b.author} hält sich in den worten kürzer, aber zieht die gespräche hinein wenn …
            </p>
          )}
          <p>die asymmetrie zwischen euch zeigt sich vor allem dann, wenn …</p>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg-raised/70 to-bg-raised" />
      </div>

      <div className="text-center" style={heroAnim(360)}>
        {onStartAi ? (
          <button
            onClick={onStartAi}
            className="inline-flex items-center gap-3 px-6 py-4 bg-ink text-bg rounded-full font-sans font-medium text-base hover:bg-a transition-colors"
          >
            weiter analysieren
            <span className="label-mono text-bg/60">gratis</span>
          </button>
        ) : (
          <button
            disabled
            className="inline-flex items-center gap-3 px-6 py-3 bg-ink/10 text-ink-muted rounded-full font-sans font-medium text-sm cursor-not-allowed"
          >
            weiter analysieren
            <span className="text-xs">(bald)</span>
          </button>
        )}
      </div>
    </div>
  )
}
