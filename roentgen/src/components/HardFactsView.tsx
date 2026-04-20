import { useEffect, useState, type ReactNode } from 'react'
import type { HardFacts } from '../analysis/hardFacts'
import { formatDuration } from '../analysis/hardFacts'
import { interpretHardFacts } from '../analysis/interpretation'
import { CountUp } from './CountUp'
import { SplitBar } from './charts/SplitBar'
import { Heatmap } from './charts/Heatmap'
import { EngagementCurve } from './charts/EngagementCurve'
import { ReplyDistribution } from './charts/ReplyDistribution'
import { MODULE_COSTS, useTokenState, type ModuleId } from '../tokens/store'

interface Props {
  facts: HardFacts
  onStartAi?: () => void
  onStartModule?: (moduleId: ModuleId) => void
  onOpenTokens?: () => void
  /** 'exhibit' — page-by-page navigation. 'scroll' — single long page. */
  mode?: 'exhibit' | 'scroll'
  /** Called once when the user finishes the exhibit (reaches final room). */
  onExhibitComplete?: () => void
}

const PERSON_COLORS = ['text-a', 'text-b', 'text-blue-400', 'text-orange-400', 'text-violet-400']

export function HardFactsView({ facts, onStartAi, onStartModule, onOpenTokens, mode = 'exhibit', onExhibitComplete }: Props) {
  const interpretations = interpretHardFacts(facts)
  const shareInterp = interpretations.find((i) => i.metric === 'share')
  const { balance } = useTokenState()
  const personA = facts.perPerson[0]?.author ?? 'Person A'
  const personB = facts.perPerson[1]?.author ?? 'Person B'

  const handleModule = (moduleId: ModuleId) => {
    if (balance < MODULE_COSTS[moduleId].cost) return onOpenTokens?.()
    if (onStartModule) return onStartModule(moduleId)
    if (onStartAi) return onStartAi()
  }

  // Pick the more striking person on a metric — used for data-driven teasers.
  const moreShareIdx = facts.perPerson[0] && facts.perPerson[1]
    ? facts.perPerson[0].sharePct >= facts.perPerson[1].sharePct ? 0 : 1
    : 0
  const shareLeader = facts.perPerson[moreShareIdx]?.author ?? personA
  const shareLeaderPct = facts.perPerson[moreShareIdx]?.sharePct ?? 50
  const moreHedgeIdx = facts.perPerson[0] && facts.perPerson[1]
    ? facts.perPerson[0].hedgeRatio >= facts.perPerson[1].hedgeRatio ? 0 : 1
    : 0
  const hedgeLeader = facts.perPerson[moreHedgeIdx]?.author ?? personA
  const hedgePct = Math.round((facts.perPerson[moreHedgeIdx]?.hedgeRatio ?? 0) * 100)
  const fasterIdx = facts.perPerson.reduce(
    (best, p, i, arr) => (p.medianReplyMs != null && (arr[best].medianReplyMs == null || p.medianReplyMs < arr[best].medianReplyMs!) ? i : best),
    0,
  )
  const fasterPerson = facts.perPerson[fasterIdx]?.author ?? personA
  const slowerPerson = facts.perPerson[1 - fasterIdx]?.author ?? personB

  // Late-night leader
  const lateLeaderIdx =
    facts.perPerson[0] && facts.perPerson[1]
      ? facts.perPerson[0].lateNightCount >= facts.perPerson[1].lateNightCount
        ? 0
        : 1
      : 0
  const lateLeader = facts.perPerson[lateLeaderIdx]?.author ?? personA
  const lateLeaderCount = facts.perPerson[lateLeaderIdx]?.lateNightCount ?? 0
  const lateLeaderPct = Math.round((facts.perPerson[lateLeaderIdx]?.lateNightRatio ?? 0) * 100)

  // Burst leader (most consecutive un-answered messages)
  const burstLeaderIdx =
    facts.perPerson[0] && facts.perPerson[1]
      ? facts.perPerson[0].longestBurst >= facts.perPerson[1].longestBurst
        ? 0
        : 1
      : 0
  const burstLeader = facts.perPerson[burstLeaderIdx]?.author ?? personA
  const burstLongest = facts.perPerson[burstLeaderIdx]?.longestBurst ?? 0
  const burstCount = facts.perPerson[burstLeaderIdx]?.burstCount ?? 0

  // Initiation drift
  const drift = facts.initiationDrift
  const driftDeltaPct = Math.round((drift.firstHalfShare - drift.secondHalfShare) * 100)
  const driftDirection = drift.swap
    ? 'flipped'
    : driftDeltaPct > 10
      ? 'dropped'
      : driftDeltaPct < -10
        ? 'rose'
        : 'stayed steady'

  type RoomDef =
    | { kind: 'content'; id: string; render: () => ReactNode }
    | { kind: 'gimmick'; stamp: string; sub?: string }

  const rooms: RoomDef[] = [
    {
      kind: 'content',
      id: 'opener',
      render: () => (
        <>
          <header>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 mb-2">
              intel · {personA.toLowerCase()} & {personB.toLowerCase()} · filed
            </div>
            <h2 className="font-serif text-[20vw] md:text-[180px] leading-[0.85] tracking-[-0.01em] text-ink overflow-hidden whitespace-nowrap">
              RECEIPTS
            </h2>
          </header>
          <div className="quote-box mt-6 max-w-2xl" style={{ transform: 'rotate(-0.3deg)' }}>
            <span className="exhibit-label">EXHIBIT 0: PREMISE</span>
            <p className="serif-body text-base md:text-lg mt-2">
              Honey. <strong className="not-italic font-bold">{facts.totalMessages.toLocaleString('en-US')} messages</strong> across <strong className="not-italic font-bold">{facts.durationDays} days</strong> between <span className="circled">{personA}</span> and <span className="circled">{personB}</span>. Ten findings coming up — one per room.
            </p>
          </div>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-8">
            <Tile label="Messages" value={<CountUp value={facts.totalMessages} format={(n) => Math.round(n).toLocaleString('en-US')} />} />
            <Tile label="Words" value={<CountUp value={facts.totalWords} format={(n) => Math.round(n).toLocaleString('en-US')} />} />
            <Tile label="Active days" value={<CountUp value={facts.activeDays} format={(n) => Math.round(n).toLocaleString('en-US')} />} />
            <Tile label="Emojis" value={<CountUp value={facts.totalEmojis} format={(n) => Math.round(n).toLocaleString('en-US')} />} />
          </section>
        </>
      ),
    },
    { kind: 'gimmick', stamp: 'TEN FINDINGS', sub: 'no judgement · just receipts' },
    {
      kind: 'content',
      id: 'distribution',
      render: () => (
        <Section kicker="01 · Distribution" title="Who writes more?" body={shareInterp?.body}>
          <SplitBar perPerson={facts.perPerson} metric="share" label="Share of messages" />
          <div className="mt-10">
            <SplitBar perPerson={facts.perPerson} metric="words" label="Share of words" />
          </div>
        </Section>
      ),
    },
    {
      kind: 'content',
      id: 'speed',
      render: () => (
        <Section kicker="02 · Speed" title="Who replies how fast?" body={interpretations.find((i) => i.metric.startsWith('reply:'))?.body}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-10">
            {facts.perPerson.map((p, i) => (
              <Tile
                key={p.author}
                label={`${p.author} · typical`}
                accent={PERSON_COLORS[i % PERSON_COLORS.length]}
                value={formatDuration(p.medianReplyMs)}
              />
            ))}
            {facts.perPerson.length === 2 && <div className="hidden md:block" />}
          </div>
          <ReplyDistribution perPerson={facts.perPerson} />
        </Section>
      ),
    },
    {
      kind: 'content',
      id: 'initiative',
      render: () => (
        <Section kicker="03 · Initiative" title="Who thinks of the other?" body={interpretations.find((i) => i.metric.startsWith('init:'))?.body}>
          <SplitBar
            perPerson={facts.perPerson}
            metric="initiation"
            label={`First message after a pause · ${facts.perPerson.reduce((s, p) => s + p.initiations, 0)} times`}
          />
          <div className="mt-10 grid md:grid-cols-2 gap-4">
            {facts.perPerson.map((p, i) => (
              <div key={p.author} className="bg-bg-surface rounded-xl p-5">
                <div className="label-mono mb-1">Questions</div>
                <div className="flex items-baseline gap-3">
                  <span className={`metric-num text-3xl ${PERSON_COLORS[i % PERSON_COLORS.length]}`}>
                    {(p.questionRatio * 100).toFixed(0)}%
                  </span>
                  <span className="font-sans text-sm text-ink-muted">of messages · {p.author}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      ),
    },
    { kind: 'gimmick', stamp: 'PLOT THICKENS', sub: 'keep going' },
    {
      kind: 'content',
      id: 'howwrite',
      render: () => (
        <Section kicker="04 · How they write" title="Words, emojis, hedges" body={interpretations.find((i) => i.metric.startsWith('hedge:'))?.body ?? interpretations.find((i) => i.metric.startsWith('emoji:'))?.body}>
          <div className="grid md:grid-cols-2 gap-4">
            {facts.perPerson.map((p, i) => (
              <div key={p.author} className="bg-bg-surface rounded-xl p-6 space-y-5">
                <div className={`font-sans ${PERSON_COLORS[i % PERSON_COLORS.length]}`}>{p.author}</div>
                <MiniRow label="Avg words per message" value={p.avgWords.toFixed(1)} />
                <MiniRow label={'Soft words ("maybe", "actually")'} value={`${(p.hedgeRatio * 100).toFixed(0)}%`} />
                <MiniRow label="Emojis per message" value={p.emojiPerMsg.toFixed(2)} />
                {p.topEmojis.length > 0 && (
                  <div>
                    <div className="label-mono mb-2">Top emojis</div>
                    <div className="flex gap-3 text-2xl">
                      {p.topEmojis.map((e) => (
                        <span key={e.emoji} title={`${e.count}×`}>{e.emoji}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      ),
    },
    {
      kind: 'content',
      id: 'rhythm',
      render: () => (
        <Section kicker="05 · Rhythm" title="When do they write?" body={`Most active day: ${fmtDayKey(facts.peakDay.date)} with ${facts.peakDay.count} messages. Messages sent on ${facts.activeDays} of ${facts.durationDays} days.`}>
          <Heatmap matrix={facts.heatmap} />
        </Section>
      ),
    },
    {
      kind: 'content',
      id: 'arc',
      render: () => (
        <Section kicker="06 · Arc" title="How much was written — over time?" body="Each line a month, every tall spike a weekend you couldn't stop. Is it going up, holding steady, or quieting down?">
          <EngagementCurve facts={facts} />
        </Section>
      ),
    },
    { kind: 'gimmick', stamp: 'NOW IT GETS SPICY', sub: 'nobody dares look at these' },
    {
      kind: 'content',
      id: 'latenight',
      render: () => (
        <Section kicker="08 · After midnight" title="Who writes while the world sleeps?" body="11pm to 5am. The daytime facade drops. What's written now carries different weight.">
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {facts.perPerson.map((p, i) => (
              <Tile
                key={p.author}
                label={`${p.author} · late`}
                accent={PERSON_COLORS[i % PERSON_COLORS.length]}
                value={`${p.lateNightCount} (${Math.round(p.lateNightRatio * 100)}%)`}
              />
            ))}
          </div>
        </Section>
      ),
    },
    {
      kind: 'content',
      id: 'bursts',
      render: () => (
        <Section kicker="09 · Bursts" title="Who spams a run of messages without a reply?" body="Three or more messages in a row before the other person responds. Bursts say a lot — urgency, worry, need, pressure.">
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {facts.perPerson.map((p, i) => (
              <div key={p.author} className="bg-bg-surface rounded-xl p-5">
                <div className={`label-mono mb-2 ${PERSON_COLORS[i % PERSON_COLORS.length]}`}>{p.author}</div>
                <div className="metric-num text-2xl mb-1">{p.burstCount}</div>
                <div className="text-sm text-ink-muted">
                  Burst sequences · longest: <span className="text-ink">{p.longestBurst}</span> messages in a row
                </div>
              </div>
            ))}
          </div>
        </Section>
      ),
    },
    ...(drift.firstHalfLeader && drift.secondHalfLeader
      ? [
          {
            kind: 'content' as const,
            id: 'shift',
            render: () => (
              <Section kicker="10 · Shift" title="Who started — back then vs. now?" body="Whoever sends the first message after a pause is the one holding the contact. When that changes, the relationship is shifting too.">
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <Tile label="First half · leader" value={`${drift.firstHalfLeader} (${Math.round(drift.firstHalfShare * 100)}%)`} />
                  <Tile
                    label="Second half · leader"
                    value={`${drift.secondHalfLeader} (${Math.round(drift.secondHalfShare * 100)}%)`}
                    accent={drift.swap ? 'text-b' : undefined}
                  />
                </div>
                <p className="serif-body text-base text-ink-muted mt-4">
                  {drift.swap
                    ? `Initiative flipped: first ${drift.firstHalfLeader}, now ${drift.secondHalfLeader}.`
                    : `${drift.firstHalfLeader}'s initiative ${driftDirection} by ${Math.abs(driftDeltaPct)} points.`}
                </p>
              </Section>
            ),
          },
        ]
      : []),
    { kind: 'gimmick', stamp: "SPILL IT.", sub: 'the real read starts now' },
    {
      kind: 'content',
      id: 'paywall',
      render: () => (
        <>
          <BridgeCTA totalFindings={10} balance={balance} onStart={handleModule} onBuy={onOpenTokens} />
          <section className="relative mt-12 space-y-10">
            <div className="space-y-5">
              <h3 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
                Go <span className="gradient-text">deeper</span>.
              </h3>
              <p className="serif-body text-lg md:text-xl text-ink-muted max-w-2xl">
                Who {personA} and {personB} really are, what's going on between you, and which moments explain everything.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <LockedCard number="02" moduleId="profiles" tone="a" emoji="🧠" title="Who's who?" subtitle="A portrait of each — no judgement"
                lines={[
                  `${personA}: often comes off reserved, apologizes a lot — what that actually means …`,
                  `${personB}: needs closeness, reacts to distance — shows up as …`,
                  `When ${personA} breaks character: usually late at night, when …`,
                ]}
                balance={balance} onStart={handleModule} onBuy={onOpenTokens}
              />
              <LockedCard number="03" moduleId="relationship" tone="a" emoji="🔗" title="What's going on between you?" subtitle="Closeness, distance, unwritten rules"
                lines={[
                  `${personA} structurally does more — how wide the real gap actually is …`,
                  `One thing you never talk about — even though it keeps popping up …`,
                  `Who leads, who follows — and how often that flips …`,
                ]}
                balance={balance} onStart={handleModule} onBuy={onOpenTokens}
              />
              <LockedCard number="04" moduleId="entwicklung" tone="a" emoji="📈" title="How has it changed?" subtitle="Chapters, turning points, what flipped"
                lines={[
                  'The first three months light, playful — at one point it tipped …',
                  `One particular day changed everything: reply times jumped from minutes to hours. The reason …`,
                  'Where you stand right now: noticeably cooler. The signs …',
                ]}
                balance={balance} onStart={handleModule} onBuy={onOpenTokens}
              />
              <LockedCard number="05" moduleId="highlights" tone="b" emoji="💥" title="The moments that explain everything" subtitle="Lines that land — silence that speaks"
                lines={[
                  `"I think I'm too much right now" — ${personA} at 11:41pm. What the line actually means …`,
                  `47 hours of silence after a message from ${personB}. Why the silence itself is the signal …`,
                  'The moment at 2:14 am where the facade drops — and why …',
                ]}
                balance={balance} onStart={handleModule} onBuy={onOpenTokens} featured
              />
              <LockedCard number="06" moduleId="timeline" tone="a" emoji="🌀" title="Your story at a glance" subtitle="The whole chat in one arc"
                lines={[
                  'The warmth between you: peaked in February, noticeably cooler today …',
                  'Four clear chapters — two of them with a crisp start …',
                  'One image that sums up your entire story …',
                ]}
                balance={balance} onStart={handleModule} onBuy={onOpenTokens} className="md:col-span-2"
              />
            </div>
          </section>
        </>
      ),
    },
  ]

  const [roomIdx, setRoomIdx] = useState(0)
  const [transitioning, setTransitioning] = useState(false)

  const go = (delta: number) => {
    const target = roomIdx + delta
    if (target < 0 || target >= rooms.length) return
    setTransitioning(true)
    setTimeout(() => {
      setRoomIdx(target)
      requestAnimationFrame(() => setTransitioning(false))
    }, 140)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (!transitioning && roomIdx < rooms.length - 1) go(1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (!transitioning && roomIdx > 0) go(-1)
      }
    }
    if (mode === 'exhibit') window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [roomIdx, transitioning, rooms.length, mode])

  // Mark exhibit seen when user reaches the final paywall room
  useEffect(() => {
    if (mode === 'exhibit' && roomIdx === rooms.length - 1) {
      onExhibitComplete?.()
    }
  }, [roomIdx, rooms.length, mode, onExhibitComplete])

  // Scroll mode — all content rooms stacked, gimmicks as slim dividers
  if (mode === 'scroll') {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 pb-32 pt-8 space-y-14">
        {rooms.map((r, i) =>
          r.kind === 'content' ? (
            <div key={`${r.id}-${i}`} className="space-y-8">
              {r.render()}
            </div>
          ) : (
            <div key={`gimmick-${i}`} className="flex justify-center py-4">
              <div
                className="inline-block font-serif text-ink border-2 border-ink px-4 py-1.5 text-xl md:text-2xl tracking-[0.04em] bg-pop-yellow"
                style={{ transform: `rotate(${i % 2 === 0 ? -2 : 2}deg)`, boxShadow: '4px 4px 0 #0A0A0A' }}
              >
                {r.stamp}
              </div>
            </div>
          ),
        )}
      </div>
    )
  }

  const currentRoom = rooms[roomIdx]
  const progressPct = Math.round(((roomIdx + 1) / rooms.length) * 100)

  return (
    <div className="relative min-h-[calc(100vh-80px)]">
      {/* Progress strip — BACK on the far left, counter, bar, percent */}
      <div className="sticky top-[52px] z-20 bg-bg/95 backdrop-blur border-b-2 border-ink">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-2 flex items-center gap-3 md:gap-4">
          {roomIdx > 0 ? (
            <button
              onClick={() => go(-1)}
              disabled={transitioning}
              className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border-2 border-ink font-mono text-[10px] uppercase tracking-[0.16em] font-bold hover:bg-pop-yellow transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ boxShadow: '2px 2px 0 #0A0A0A' }}
              aria-label="Previous"
            >
              ← BACK
            </button>
          ) : (
            <span className="shrink-0 w-[60px]" aria-hidden />
          )}
          <div className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-ink">
            <span className="font-bold">{String(roomIdx + 1).padStart(2, '0')}</span>
            <span className="opacity-50"> / {String(rooms.length).padStart(2, '0')}</span>
            <span className="opacity-50 hidden md:inline ml-3">· {currentRoom.kind === 'content' ? currentRoom.id : 'intermission'}</span>
          </div>
          <div className="flex-1 h-1 bg-ink/10 relative">
            <div className="absolute inset-y-0 left-0 bg-ink transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/60 hidden md:block">{progressPct}%</div>
        </div>
      </div>

      {/* Room content */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 pb-32">
        <div
          key={roomIdx}
          className="transition-all duration-200 ease-out"
          style={{
            opacity: transitioning ? 0 : 1,
            transform: transitioning ? 'translateY(6px)' : 'translateY(0)',
          }}
        >
          {currentRoom.kind === 'gimmick' ? (
            <div className="min-h-[60vh] flex items-center justify-center py-12">
              <div className="text-center">
                <div
                  className="inline-block font-serif text-ink border-4 border-ink px-6 py-3 text-5xl md:text-8xl tracking-[0.04em] bg-pop-yellow"
                  style={{ transform: 'rotate(-3deg)', boxShadow: '8px 8px 0 #0A0A0A' }}
                >
                  {currentRoom.stamp}
                </div>
                {currentRoom.sub && (
                  <div className="mt-8 font-mono italic text-base md:text-lg text-ink-muted">
                    {currentRoom.sub}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-8">{currentRoom.render()}</div>
          )}
        </div>
      </div>

      {/* Next button — big, centered at the bottom */}
      <div className="fixed bottom-14 left-0 right-0 z-30 pointer-events-none">
        <div className="max-w-6xl mx-auto px-4 md:px-6 pointer-events-none">
          <div className="relative flex items-center justify-center">
            <div className="pointer-events-auto flex flex-col items-center gap-1" style={{ transform: 'rotate(-0.6deg)' }}>
              <button
                onClick={() => go(1)}
                disabled={roomIdx === rooms.length - 1 || transitioning}
                className="inline-flex items-center gap-3 px-8 md:px-10 py-3 md:py-4 bg-pop-yellow border-2 border-ink font-serif text-2xl md:text-4xl tracking-[0.04em] text-ink hover:bg-white active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ boxShadow: '6px 6px 0 #0A0A0A' }}
              >
                <span>{roomIdx === 0 ? 'OPEN IT' : roomIdx >= rooms.length - 2 ? 'FINAL TAKE' : 'NEXT'}</span>
                <span aria-hidden>→</span>
              </button>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink/60 hidden md:block">
                or press space
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

function LockedCard({
  number,
  moduleId,
  title,
  subtitle,
  lines,
  tone,
  emoji,
  className,
  balance,
  onStart,
  onBuy,
}: {
  number: string
  moduleId: ModuleId
  title: string
  subtitle: string
  lines: string[]
  tone: 'a' | 'b'
  featured?: boolean
  emoji?: string
  className?: string
  balance: number
  onStart: (moduleId: ModuleId) => void
  onBuy?: () => void
}) {
  const accent = tone === 'a' ? 'text-a' : 'text-b'
  const glow = tone === 'a' ? 'bg-a/[0.06]' : 'bg-b/[0.08]'
  const cost = MODULE_COSTS[moduleId].cost
  const canAfford = balance >= cost
  const primaryAction = canAfford ? () => onStart(moduleId) : onBuy

  return (
    <article
      className={`group relative overflow-hidden rounded-3xl bg-bg-raised border border-line/60 p-6 md:p-8 transition-colors hover:border-line ${className ?? ''}`}
    >
      {/* Single quiet glow */}
      <div
        className={`absolute -top-24 -right-20 w-56 h-56 rounded-full ${glow} blur-3xl pointer-events-none`}
      />

      {/* Emoji sticker — subtle */}
      {emoji && (
        <span
          className="absolute top-6 right-6 text-2xl opacity-60 pointer-events-none"
          aria-hidden
        >
          {emoji}
        </span>
      )}

      <header className="relative flex items-baseline justify-between mb-4 pr-12">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className={`label-mono ${accent}`}>File {number}</span>
          <span className="label-mono text-ink-faint hidden md:inline">·</span>
          <span className="label-mono text-ink-muted hidden md:inline">{subtitle}</span>
        </div>
        <span className={`shrink-0 label-mono ${accent}`}>
          {cost} {cost === 1 ? 'ticket' : 'tickets'}
        </span>
      </header>

      <h4 className="font-serif text-2xl md:text-3xl leading-tight mb-1">{title}</h4>
      <p className="label-mono text-ink-muted mb-5 md:hidden">{subtitle}</p>

      <div className="relative">
        <div className="select-none pointer-events-none space-y-2.5 font-serif text-base text-ink-muted blur-[4px]">
          {lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg-raised/40 to-bg-raised" />
      </div>

      <div className="relative mt-5 pt-4 border-t border-line/40">
        <button
          onClick={primaryAction}
          disabled={!primaryAction}
          className={`w-full px-5 py-3 rounded-full font-sans font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
            canAfford ? 'btn-pop' : 'btn-pop'
          }`}
        >
          {canAfford ? (
            <>
              <span aria-hidden>✨</span>
              Let's go
              <span className="label-mono text-bg/70">
                {cost} {cost === 1 ? 'ticket' : 'tickets'} →
              </span>
            </>
          ) : (
            <>
              <span aria-hidden>⚡</span>
              Top up tickets
              <span className="label-mono text-bg/70">
                {balance}/{cost}
              </span>
            </>
          )}
        </button>
      </div>
    </article>
  )
}

function Section({
  kicker,
  title,
  body,
  children,
}: {
  kicker: string
  title: string
  body?: string
  children: React.ReactNode
}) {
  // kicker shape: "01 · Verteilung" → split into number + label
  const parts = kicker.split('·').map((s) => s.trim())
  const num = parts[0] ?? ''
  const label = (parts[1] ?? '').toLowerCase()

  return (
    <section className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-baseline gap-2 font-mono text-xs uppercase tracking-[0.18em]">
          <span className="text-ink-faint">{num}</span>
          <span className="text-ink-faint">/</span>
          <span className="text-a">{label}</span>
        </div>
        <h3 className="font-serif text-3xl md:text-5xl leading-[1.05] tracking-tight">{title}</h3>
        {body && (
          <p className="serif-body text-base md:text-lg text-ink-muted max-w-2xl leading-snug">{body}</p>
        )}
      </div>
      <div className="card">{children}</div>
    </section>
  )
}

function Whisper({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-2 max-w-xl">
      <p className="font-serif italic text-base md:text-lg text-ink-faint leading-snug pl-4 border-l-2 border-line/40">
        {children}
      </p>
    </div>
  )
}

function Tile({
  label,
  value,
  accent,
}: {
  label: string
  value: React.ReactNode
  accent?: string
}) {
  return (
    <div className="bg-bg-raised border border-line/60 rounded-2xl p-5 hover:border-line transition-colors">
      <div className="label-mono mb-2">{label}</div>
      <div className={`text-3xl md:text-4xl metric-num ${accent ?? 'text-ink'}`}>{value}</div>
    </div>
  )
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line/40 pb-2">
      <span className="label-mono">{label}</span>
      <span className="metric-num text-lg">{value}</span>
    </div>
  )
}

function fmtDayKey(key: string): string {
  if (!key) return '—'
  const [y, m, d] = key.split('-')
  return `${m}/${d}/${y.slice(2)}`
}

const MODULE_TONES: Record<ModuleId, 'a' | 'b'> = {
  profiles: 'a',
  relationship: 'b',
  highlights: 'b',
  timeline: 'a',
  entwicklung: 'a',
}

const MODULE_CTAS: Record<ModuleId, string> = {
  profiles: 'x-ray them both',
  relationship: 'the diagnosis please',
  highlights: 'the killer lines',
  timeline: 'the whole movie',
  entwicklung: 'spoilers please',
}

function InlineTeaser({
  finding,
  question,
  moduleId,
  balance,
  onStart,
  onBuy,
}: {
  finding: string
  question: string
  moduleId: ModuleId
  balance: number
  onStart: (m: ModuleId) => void
  onBuy?: () => void
}) {
  const cost = MODULE_COSTS[moduleId].cost
  const label = MODULE_COSTS[moduleId].label
  const canAfford = balance >= cost
  const action = canAfford ? () => onStart(moduleId) : onBuy
  const tone = MODULE_TONES[moduleId] ?? 'a'
  const accent = tone === 'a' ? 'text-a' : 'text-b'
  const glow = tone === 'a' ? 'bg-a/[0.06]' : 'bg-b/[0.08]'

  void glow
  void accent
  return (
    <aside className="relative my-4 max-w-3xl" style={{ transform: 'rotate(-0.4deg)' }}>
      <div className="quote-box">
        <span className="exhibit-label">WAIT — EXHIBIT · {label.toUpperCase()}</span>
        <div className="flex flex-col md:flex-row gap-5 md:items-center mt-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-serif text-2xl md:text-3xl leading-tight tracking-tight mb-2 not-italic">
              {finding}
            </h4>
            <p className="serif-body text-base leading-snug">{question}</p>
          </div>
          <button
            onClick={action}
            className="btn-pop shrink-0 self-start md:self-center"
          >
            {canAfford ? MODULE_CTAS[moduleId].toUpperCase() : `UNLOCK ${label.toUpperCase()}`}
            <span className="text-[10px] font-mono opacity-70 ml-2">
              {canAfford ? `· ${cost} TICKET` : `· ${balance}/${cost}`}
            </span>
          </button>
        </div>
      </div>
    </aside>
  )
}

function BridgeCTA({
  totalFindings,
  balance,
  onStart,
  onBuy,
}: {
  totalFindings: number
  balance: number
  onStart: (m: ModuleId) => void
  onBuy?: () => void
}) {
  const singleCost = MODULE_COSTS.profiles.cost
  const bundleCost = 5
  const canAffordSingle = balance >= singleCost
  const canAffordBundle = balance >= bundleCost
  const singleAction = canAffordSingle ? () => onStart('profiles') : onBuy
  const bundleAction = canAffordBundle ? () => onStart('profiles') : onBuy

  return (
    <section className="relative my-20 max-w-5xl">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 mb-2">→ paywall · spill the tea</div>
      <h3 className="font-serif text-[16vw] md:text-[120px] leading-[0.85] tracking-[-0.01em] text-ink overflow-hidden whitespace-nowrap">
        SPILL IT.
      </h3>
      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div className="quote-box" style={{ transform: 'rotate(-0.4deg)' }}>
          <span className="exhibit-label">EXHIBIT C: THE OFFER</span>
          <p className="serif-body text-base mt-2">
            <strong className="not-italic font-bold">{totalFindings} numbers</strong> were the skin. Five files are the skeleton scan: who you really are, what's really going on between you, which moments explain everything. No account. No subscription. One ticket per file — or the whole bundle at a discount.
          </p>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/60 mt-4">
            profiles · vibe · evolution · highlights · timeline
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={bundleAction}
            className="btn-pop relative justify-between text-left px-6 py-5"
            style={{ fontSize: '24px' }}
          >
            <span>SPILL ALL · 5 FILES</span>
            <span className="font-mono text-[11px] tracking-[0.14em]">
              {canAffordBundle ? `${bundleCost} TICKETS` : `10 €`}
            </span>
            {!canAffordBundle && (
              <span className="absolute -top-3 -right-3 sticker" style={{ transform: 'rotate(8deg)' }}>−25%</span>
            )}
          </button>
          <button
            onClick={singleAction}
            className="inline-flex items-center justify-between gap-2 px-6 py-4 border-2 border-ink bg-white text-ink font-mono text-sm uppercase tracking-[0.12em] hover:bg-ink hover:text-pop-yellow transition-colors"
            style={{ boxShadow: '3px 3px 0 #0A0A0A' }}
          >
            <span>{canAffordSingle ? 'just the profiles first' : 'grab one ticket'}</span>
            <span className="text-[10px] opacity-70">
              {canAffordSingle ? `${singleCost} TICKET` : `${balance}/${singleCost}`}
            </span>
          </button>
        </div>
      </div>
    </section>
  )
}

function StickyBuyBar({
  balance,
  onStart,
  onBuy,
}: {
  balance: number
  onStart: (m: ModuleId) => void
  onBuy?: () => void
}) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const cost = MODULE_COSTS.profiles.cost
  const canAfford = balance >= cost
  const action = canAfford ? () => onStart('profiles') : onBuy

  return (
    <div className="fixed bottom-16 left-4 right-4 z-30 pointer-events-none">
      <div className="max-w-3xl mx-auto pointer-events-auto" style={{ transform: 'rotate(-0.4deg)' }}>
        <div
          className="flex items-center gap-3 bg-pop-yellow border-2 border-ink pl-4 pr-2 py-2"
          style={{ boxShadow: '4px 4px 0 #0A0A0A' }}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] hidden sm:inline">
            {balance} {balance === 1 ? 'ticket' : 'tickets'}
          </span>
          <span className="font-mono text-[10px] hidden sm:inline">·</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] truncate">
            {canAfford ? 'ready when you are' : `profiles · ${cost} ticket needed`}
          </span>
          <div className="flex-1" />
          <button
            onClick={action}
            className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 bg-ink text-pop-yellow font-serif text-base tracking-[0.04em] border border-ink hover:bg-pop-yellow hover:text-ink transition-colors"
          >
            {canAfford ? 'GO' : 'TOP UP'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Hide bar"
            className="shrink-0 w-7 h-7 flex items-center justify-center text-ink hover:bg-ink hover:text-pop-yellow transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
