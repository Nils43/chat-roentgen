import { useEffect, useMemo, useRef, useState } from 'react'
import { t, useLocale } from '../i18n'
import type { Message, ParsedChat } from '../parser/types'

interface Props {
  chat: ParsedChat
  onDone: () => void
}

const DURATION_MS = 4200
const PERSON_COLORS = ['#0A0A0A', '#FF90BB', '#FFE234', '#0A0A0A', '#FF90BB']
const BUBBLE_COUNT = 14
const STICKER_PHRASES = [
  'RECEIPTS.',
  'oh honey...',
  'CAUGHT.',
  'the audacity',
  'exhibit filed.',
  'noted.',
  'interesting...',
  'red flag?',
  'PATTERN.',
  'tea.',
  'reading you.',
  'logged.',
  'hmm.',
  'tell me more.',
]

export function ParsingAnimation({ chat, onDone }: Props) {
  const locale = useLocale()
  const [progress, setProgress] = useState(0)
  const [visibleBubbles, setVisibleBubbles] = useState(0)
  const startedAt = useRef<number | null>(null)

  const samples = useMemo(() => sampleMessages(chat.messages, BUBBLE_COUNT), [chat.messages])
  const span = formatSpan(chat.messages[0].ts, chat.messages[chat.messages.length - 1].ts)

  // Pre-compute random positions and rotations for each bubble
  const layouts = useMemo(() => {
    return samples.map((_, i) => ({
      x: 5 + Math.random() * 60,
      y: 8 + (i / samples.length) * 65,
      rotation: (Math.random() - 0.5) * 6,
      delay: (i / samples.length) * 0.85,
      isHighlighted: Math.random() > 0.7,
      stickerPhrase: STICKER_PHRASES[i % STICKER_PHRASES.length],
      showSticker: Math.random() > 0.55,
      fromRight: Math.random() > 0.5,
    }))
  }, [samples])

  const colorFor = (author: string): string => {
    const idx = chat.participants.indexOf(author)
    return PERSON_COLORS[Math.max(0, idx) % PERSON_COLORS.length]
  }

  useEffect(() => {
    let raf = 0
    const tick = (now: number) => {
      if (startedAt.current == null) startedAt.current = now
      const t = Math.min(1, (now - startedAt.current) / DURATION_MS)
      setProgress(t)
      setVisibleBubbles(Math.floor(t * (BUBBLE_COUNT + 2)))
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        window.setTimeout(onDone, 600)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [onDone])

  const eased = easeInOut(progress)
  const messagesCount = Math.round(chat.messages.length * eased)

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-5 md:px-8 py-12">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-block px-3 py-1 bg-black text-white font-mono text-[10px] uppercase tracking-[0.2em] mb-4"
            style={{ boxShadow: '3px 3px 0 #FFE234' }}
          >
            <span className="inline-block w-1.5 h-1.5 bg-[#FFE234] rounded-full animate-pulse mr-2" />
            {t('parsing.intercepting', locale, { pct: Math.round(eased * 100) })}
          </div>
          <h2
            className="font-serif text-5xl md:text-7xl tracking-tight leading-[0.9]"
            style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.02em' }}
          >
            {t('parsing.heroA', locale)}
            <br />
            <span
              className="inline-block px-2"
              style={{ background: '#FFE234', transform: 'rotate(-1deg)', display: 'inline-block' }}
            >
              {t('parsing.heroB', locale)}
            </span>
          </h2>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-black/50 mt-3">
            {progress < 1 ? t('parsing.scanning', locale) : t('parsing.collected', locale)}
          </p>
        </div>

        {/* Gossip Board — messages pop up */}
        <div
          className="relative overflow-hidden border-2 border-black bg-white"
          style={{
            height: 420,
            boxShadow: '6px 6px 0 #0A0A0A',
            backgroundImage:
              'radial-gradient(rgba(10,10,10,0.06) 1px, transparent 1.5px)',
            backgroundSize: '12px 12px',
          }}
        >
          {/* Corner stamps */}
          <div
            className="absolute top-3 left-3 z-30 font-mono text-[9px] uppercase tracking-[0.2em] bg-black text-white px-2 py-1"
          >
            {t('parsing.caseNo', locale, { id: chat.messages.length.toString().slice(-4) })}
          </div>
          <div
            className="absolute top-3 right-3 z-30 font-mono text-[9px] uppercase tracking-[0.2em] text-black/40"
          >
            {messagesCount.toLocaleString('en-US')} / {chat.messages.length.toLocaleString('en-US')}
          </div>

          {/* Popping bubbles */}
          {samples.map((m, i) => {
            const layout = layouts[i]
            const isVisible = i < visibleBubbles
            const author = m.author ?? '—'
            const color = colorFor(author)

            return (
              <div
                key={i}
                className="absolute transition-all duration-500"
                style={{
                  left: `${layout.fromRight ? 'auto' : layout.x + '%'}`,
                  right: layout.fromRight ? `${100 - layout.x - 30}%` : 'auto',
                  top: `${layout.y}%`,
                  transform: `rotate(${layout.rotation}deg) scale(${isVisible ? 1 : 0.3})`,
                  opacity: isVisible ? 1 : 0,
                  zIndex: isVisible ? 10 + i : 0,
                  transitionDelay: `${i * 30}ms`,
                }}
              >
                {/* Chat bubble */}
                <div
                  className="relative max-w-[240px] px-3 py-2 border-[1.5px] border-black text-[12px] leading-snug"
                  style={{
                    background: layout.isHighlighted ? '#FFE234' : '#fff',
                    boxShadow: '2px 2px 0 #0A0A0A',
                    fontFamily: 'Courier Prime, monospace',
                  }}
                >
                  {/* Author tag */}
                  <span
                    className="absolute -top-2 -left-1 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.14em] font-bold"
                    style={{
                      background: color,
                      color: color === '#0A0A0A' ? '#fff' : '#0A0A0A',
                      transform: `rotate(${-layout.rotation - 2}deg)`,
                    }}
                  >
                    {author.slice(0, 8)}
                  </span>
                  <span className="block mt-1 truncate" style={{ maxWidth: 200 }}>
                    {sanitize(m.text).slice(0, 60)}
                  </span>
                  <span className="block text-[9px] text-black/40 mt-0.5">{fmtTs(m.ts)}</span>
                </div>

                {/* Random sticker */}
                {layout.showSticker && isVisible && (
                  <div
                    className="absolute -bottom-3 -right-2 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] font-bold"
                    style={{
                      background: '#FFE234',
                      border: '1px solid #0A0A0A',
                      boxShadow: '1px 1px 0 #0A0A0A',
                      transform: `rotate(${(Math.random() - 0.5) * 12}deg)`,
                      fontFamily: 'Bebas Neue, sans-serif',
                      fontSize: '11px',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {layout.stickerPhrase}
                  </div>
                )}
              </div>
            )
          })}

          {/* Redaction lines appearing */}
          {progress > 0.4 && (
            <div
              className="absolute bottom-12 left-6 right-6 space-y-2 transition-opacity duration-700"
              style={{ opacity: progress > 0.6 ? 0.15 : 0.08 }}
            >
              <div className="h-3 bg-black" style={{ width: '70%' }} />
              <div className="h-3 bg-black" style={{ width: '45%' }} />
              <div className="h-3 bg-black" style={{ width: '60%' }} />
            </div>
          )}

          {/* Progress bar at very bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/10 z-20">
            <div
              className="h-full bg-black transition-all duration-200"
              style={{ width: `${eased * 100}%` }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <StatTile
            label={t('parsing.stat.messages', locale)}
            value={messagesCount.toLocaleString(locale === 'de' ? 'de-DE' : 'en-US')}
            active={progress > 0}
          />
          <StatTile
            label={t('parsing.stat.people', locale)}
            value={progress > 0.18 ? chat.participants.length.toString() : '···'}
            active={progress > 0.18}
          />
          <StatTile
            label={t('parsing.stat.span', locale)}
            value={progress > 0.55 ? span : '···'}
            active={progress > 0.55}
          />
        </div>

        {/* Bottom text */}
        <div className="mt-5 text-center">
          {progress < 1 ? (
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-black/40 animate-pulse">
              {t('parsing.compiling', locale)}
            </span>
          ) : (
            <span
              className="inline-block px-4 py-2 font-mono text-[12px] uppercase tracking-[0.14em] bg-black text-white"
              style={{ boxShadow: '3px 3px 0 #FFE234', transform: 'rotate(-0.5deg)' }}
            >
              {t('parsing.done', locale)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  active,
}: {
  label: string
  value: string
  active: boolean
}) {
  return (
    <div
      className="border-2 border-black px-5 py-4 transition-all"
      style={{
        background: active ? '#FFE234' : '#fff',
        boxShadow: active ? '3px 3px 0 #0A0A0A' : '2px 2px 0 #0A0A0A',
        transform: active ? 'rotate(-0.3deg)' : 'none',
      }}
    >
      <div
        className="font-mono text-[10px] uppercase tracking-[0.16em] font-bold mb-1"
        style={{ color: active ? '#0A0A0A' : '#999' }}
      >
        {label}
      </div>
      <div
        className="text-2xl md:text-3xl"
        style={{
          fontFamily: 'Bebas Neue, sans-serif',
          color: active ? '#0A0A0A' : '#ccc',
        }}
      >
        {value}
      </div>
    </div>
  )
}

// --- helpers ---

function sampleMessages(messages: Message[], n: number): Message[] {
  if (messages.length === 0) return []
  if (messages.length <= n) return messages
  const step = messages.length / n
  const out: Message[] = []
  for (let i = 0; i < n; i++) {
    out.push(messages[Math.floor(i * step)])
  }
  return out
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function sanitize(s: string): string {
  const flat = s.replace(/\s+/g, ' ').trim()
  return flat.length > 120 ? flat.slice(0, 117) + '…' : flat
}

function fmtTs(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = String(d.getFullYear()).slice(2)
  return `${day}.${month}.${year}`
}

function formatSpan(a: Date, b: Date): string {
  const days = Math.ceil((+b - +a) / 86400000)
  if (days < 31) return `${days} days`
  const months = Math.round(days / 30.4)
  if (months < 12) return `${months} months`
  const years = Math.round((days / 365) * 10) / 10
  return `${years} years`
}
