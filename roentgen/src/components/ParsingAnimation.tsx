import { useEffect, useMemo, useRef, useState } from 'react'
import type { Message, ParsedChat } from '../parser/types'

interface Props {
  chat: ParsedChat
  onDone: () => void
}

const DURATION_MS = 3400
const PERSON_COLORS = ['#7fe0c4', '#ff9a8b', '#89b4f4', '#fbbd5c', '#c9a6f0']
const ROW_HEIGHT = 30
const VIEWPORT_HEIGHT = 440
const SAMPLE_COUNT = 110

// Reading moment: real messages stream through while the counters
// tick up in parallel. Gives the user the feeling tea is actually reading,
// even though the real parser finishes in < 200ms.
export function ParsingAnimation({ chat, onDone }: Props) {
  const [progress, setProgress] = useState(0)
  const startedAt = useRef<number | null>(null)

  const samples = useMemo(() => sampleMessages(chat.messages, SAMPLE_COUNT), [chat.messages])
  const span = formatSpan(chat.messages[0].ts, chat.messages[chat.messages.length - 1].ts)
  const columnHeight = samples.length * ROW_HEIGHT
  const travel = columnHeight + VIEWPORT_HEIGHT * 0.6

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
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        window.setTimeout(onDone, 420)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [onDone])

  const eased = easeInOut(progress)
  const offsetY = VIEWPORT_HEIGHT * 0.4 - eased * travel
  const scanY = VIEWPORT_HEIGHT / 2
  const pctLabel = Math.round(eased * 100).toString().padStart(3, '0')

  const messagesCount = Math.round(chat.messages.length * eased)
  const participantsCount = progress > 0.18 ? chat.participants.length : 0
  const spanLabel = progress > 0.55 ? span : '···'

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-5 md:px-8 py-12">
      <div className="w-full max-w-3xl">
        {/* Kicker */}
        <div className="label-mono text-a mb-5 flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 bg-a rounded-full animate-pulse-soft" />
          <span>tea · reading</span>
          <span className="text-ink-faint">· runs on your device, not in the cloud</span>
        </div>

        {/* Scanner window */}
        <div
          className="relative rounded-3xl border border-a/20 bg-bg-raised/60 overflow-hidden shadow-[0_0_80px_-20px_rgba(127,224,196,0.25)]"
          style={{ height: VIEWPORT_HEIGHT }}
        >
          {/* Horizontal scan grid (thin lines) */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.18]"
            style={{
              backgroundImage:
                'linear-gradient(to bottom, rgba(127,224,196,0.6) 1px, transparent 1px)',
              backgroundSize: `100% ${ROW_HEIGHT}px`,
            }}
          />

          {/* Vertical edge ticks */}
          <div
            className="absolute inset-y-0 left-0 w-8 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(to bottom, rgba(127,224,196,0.5) 1px, transparent 1px)',
              backgroundSize: `6px ${ROW_HEIGHT}px`,
              maskImage: 'linear-gradient(to right, black, transparent)',
              WebkitMaskImage: 'linear-gradient(to right, black, transparent)',
            }}
          />
          <div
            className="absolute inset-y-0 right-0 w-8 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(to bottom, rgba(127,224,196,0.5) 1px, transparent 1px)',
              backgroundSize: `6px ${ROW_HEIGHT}px`,
              maskImage: 'linear-gradient(to left, black, transparent)',
              WebkitMaskImage: 'linear-gradient(to left, black, transparent)',
            }}
          />

          {/* Scrolling message column */}
          <div
            className="absolute left-14 right-14 will-change-transform"
            style={{
              transform: `translate3d(0, ${offsetY}px, 0)`,
            }}
          >
            {samples.map((m, i) => {
              // Each bubble's current Y position inside the viewport
              const bubbleY = i * ROW_HEIGHT + offsetY + ROW_HEIGHT / 2
              const d = Math.abs(bubbleY - scanY)
              const near = Math.max(0, 1 - d / 80)
              const author = m.author ?? '—'
              const color = colorFor(author)
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 font-mono text-[12px]"
                  style={{
                    height: ROW_HEIGHT,
                    opacity: 0.22 + near * 0.78,
                    transform: `scale(${1 + near * 0.02})`,
                    color: near > 0.5 ? '#f5f2ea' : '#8b95a1',
                  }}
                >
                  <span
                    className="shrink-0 w-10 truncate text-[10px] tracking-wider uppercase"
                    style={{ color, opacity: 0.55 + near * 0.45 }}
                  >
                    {author.slice(0, 4)}
                  </span>
                  <span
                    className="shrink-0 w-[60px] text-[10px] text-right tabular-nums"
                    style={{ opacity: 0.3 + near * 0.5 }}
                  >
                    {fmtTs(m.ts)}
                  </span>
                  <span className="truncate flex-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    {sanitize(m.text)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Top fade */}
          <div
            className="absolute top-0 left-0 right-0 h-28 pointer-events-none z-10"
            style={{
              background:
                'linear-gradient(to bottom, rgba(18,23,28,0.98), rgba(18,23,28,0.75) 40%, transparent)',
            }}
          />
          {/* Bottom fade */}
          <div
            className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none z-10"
            style={{
              background:
                'linear-gradient(to top, rgba(18,23,28,0.98), rgba(18,23,28,0.75) 40%, transparent)',
            }}
          />

          {/* Scan glow band (wide, soft) */}
          <div
            className="absolute left-0 right-0 pointer-events-none z-10"
            style={{
              top: scanY - 36,
              height: 72,
              background:
                'radial-gradient(ellipse at center, rgba(127,224,196,0.22), rgba(127,224,196,0) 70%)',
              mixBlendMode: 'screen',
            }}
          />

          {/* Scan line (sharp) */}
          <div
            className="absolute left-0 right-0 pointer-events-none z-20"
            style={{
              top: scanY - 0.5,
              height: 1,
              background:
                'linear-gradient(90deg, transparent, rgba(127,224,196,0.95) 15%, rgba(127,224,196,1) 50%, rgba(127,224,196,0.95) 85%, transparent)',
              boxShadow:
                '0 0 12px rgba(127,224,196,0.9), 0 0 28px rgba(127,224,196,0.5)',
            }}
          />

          {/* Scan line endpoints */}
          <div
            className="absolute pointer-events-none z-30 w-1.5 h-1.5 rounded-full bg-a"
            style={{ top: scanY - 3, left: -3, boxShadow: '0 0 10px rgba(127,224,196,0.9)' }}
          />
          <div
            className="absolute pointer-events-none z-30 w-1.5 h-1.5 rounded-full bg-a"
            style={{ top: scanY - 3, right: -3, boxShadow: '0 0 10px rgba(127,224,196,0.9)' }}
          />

          {/* Corner HUD — top-left */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 z-30 font-mono text-[10px] text-a/80 tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-a animate-pulse-soft" />
            <span>Rec</span>
          </div>
          {/* Corner HUD — top-right */}
          <div className="absolute top-3 right-3 z-30 font-mono text-[10px] text-a/80 tracking-widest uppercase tabular-nums">
            scan · {pctLabel}%
          </div>
          {/* Corner HUD — bottom-left */}
          <div className="absolute bottom-4 left-3 z-30 font-mono text-[10px] text-ink-faint tracking-widest uppercase">
            local · no upload
          </div>
          {/* Corner HUD — bottom-right: current index */}
          <div className="absolute bottom-4 right-3 z-30 font-mono text-[10px] text-ink-faint tracking-widest uppercase tabular-nums">
            {messagesCount.toLocaleString('en-US')} / {chat.messages.length.toLocaleString('en-US')}
          </div>

          {/* Progress bar at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-line/60 z-20">
            <div
              className="h-full bg-a"
              style={{
                width: `${eased * 100}%`,
                boxShadow: '0 0 12px rgba(127,224,196,0.8)',
              }}
            />
          </div>
        </div>

        {/* Stats row — tick up in parallel with the scan */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <StatTile
            label="Messages"
            value={messagesCount.toLocaleString('en-US')}
            active={progress > 0}
          />
          <StatTile
            label="People"
            value={participantsCount.toString()}
            active={progress > 0.18}
          />
          <StatTile
            label="Span"
            value={spanLabel}
            active={progress > 0.55}
          />
        </div>

        {/* Small helper below */}
        <div className="mt-5 text-center font-mono text-[11px] text-ink-faint tracking-wider">
          {progress < 1 ? 'X-raying every message — nobody sees it but you' : 'done · moving on'}
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
      className={`bg-bg-raised/50 border rounded-2xl px-5 py-4 transition-colors ${
        active ? 'border-a/30' : 'border-line/40'
      }`}
    >
      <div className="label-mono mb-1">{label}</div>
      <div
        className={`metric-num text-2xl md:text-3xl transition-colors ${
          active ? 'text-ink' : 'text-ink-faint'
        }`}
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
  // Compact a message for single-line display — remove line breaks, trim, limit length.
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
