import { useEffect, useState, type ReactNode } from 'react'
import type { HardFacts } from '../analysis/hardFacts'
import { formatDuration } from '../analysis/hardFacts'
import { interpretHardFacts } from '../analysis/interpretation'
import { CountUp } from './CountUp'
import { SplitBar } from './charts/SplitBar'
import { Heatmap } from './charts/Heatmap'
import { EngagementCurve } from './charts/EngagementCurve'
import { ReplyDistribution } from './charts/ReplyDistribution'
import type { ModuleId } from '../store/chatLibrary'

interface Props {
  facts: HardFacts
  onStartAi?: () => void
  onStartModule?: (moduleId: ModuleId) => void
  /** 'exhibit' — page-by-page navigation. 'scroll' — single long page. */
  mode?: 'exhibit' | 'scroll'
  /** Called once when the user finishes the exhibit (reaches final room). */
  onExhibitComplete?: () => void
  chatId?: string | null
  /** Modules the user already generated — cards show OPEN instead of UNLOCK. */
  completedModules?: ModuleId[]
  /** Relationship analysis only makes sense for exactly two participants. */
  canAnalyzeRelationship?: boolean
}

const PERSON_COLORS = ['text-a', 'text-b', 'text-blue-400', 'text-orange-400', 'text-violet-400']

export function HardFactsView({ facts, onStartAi, onStartModule, mode = 'exhibit', onExhibitComplete, chatId, completedModules = [], canAnalyzeRelationship = true }: Props) {
  const interpretations = interpretHardFacts(facts)
  const shareInterp = interpretations.find((i) => i.metric === 'share')
  const personA = facts.perPerson[0]?.author ?? 'Person A'
  const personB = facts.perPerson[1]?.author ?? 'Person B'

  const handleModule = (moduleId: ModuleId) => {
    if (onStartModule) return onStartModule(moduleId)
    if (onStartAi) return onStartAi()
  }

  // Argmax helper that scans all perPerson entries, not just the first two.
  const argmax = <K extends keyof typeof facts.perPerson[number]>(key: K): number => {
    let best = 0
    for (let i = 1; i < facts.perPerson.length; i++) {
      if ((facts.perPerson[i][key] as number) > (facts.perPerson[best][key] as number)) best = i
    }
    return best
  }

  const moreShareIdx = facts.perPerson.length > 0 ? argmax('sharePct') : 0
  const shareLeader = facts.perPerson[moreShareIdx]?.author ?? personA
  const shareLeaderPct = facts.perPerson[moreShareIdx]?.sharePct ?? 50
  const moreHedgeIdx = facts.perPerson.length > 0 ? argmax('hedgeRatio') : 0
  const hedgeLeader = facts.perPerson[moreHedgeIdx]?.author ?? personA
  const hedgePct = Math.round((facts.perPerson[moreHedgeIdx]?.hedgeRatio ?? 0) * 100)
  const fasterIdx = facts.perPerson.reduce(
    (best, p, i, arr) => (p.medianReplyMs != null && (arr[best].medianReplyMs == null || p.medianReplyMs < arr[best].medianReplyMs!) ? i : best),
    0,
  )
  const fasterPerson = facts.perPerson[fasterIdx]?.author ?? personA
  // Slowest = largest medianReplyMs (skipping nulls). For N=2 this coincides with "the other one".
  const slowerIdx = facts.perPerson.reduce(
    (worst, p, i, arr) => (p.medianReplyMs != null && (arr[worst].medianReplyMs == null || p.medianReplyMs > arr[worst].medianReplyMs!) ? i : worst),
    0,
  )
  const slowerPerson = facts.perPerson[slowerIdx]?.author ?? personB

  // Late-night leader
  const lateLeaderIdx = facts.perPerson.length > 0 ? argmax('lateNightCount') : 0
  const lateLeader = facts.perPerson[lateLeaderIdx]?.author ?? personA
  const lateLeaderCount = facts.perPerson[lateLeaderIdx]?.lateNightCount ?? 0
  const lateLeaderPct = Math.round((facts.perPerson[lateLeaderIdx]?.lateNightRatio ?? 0) * 100)

  // Burst leader (most consecutive un-answered messages)
  const burstLeaderIdx = facts.perPerson.length > 0 ? argmax('longestBurst') : 0
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

  const isGroup = facts.perPerson.length > 2
  const peopleLabel = isGroup
    ? `${facts.perPerson.length} voices`
    : `${personA.toLowerCase()} & ${personB.toLowerCase()}`

  const rooms: RoomDef[] = [
    {
      kind: 'content',
      id: 'opener',
      render: () => (
        <>
          <header>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 mb-2">
              intel · {peopleLabel} · filed
            </div>
            <h2 className="font-serif text-[20vw] md:text-[180px] leading-[0.85] tracking-[-0.01em] text-ink overflow-hidden whitespace-nowrap">
              RECEIPTS
            </h2>
          </header>
          <div className="quote-box mt-6 max-w-2xl" style={{ transform: 'rotate(-0.3deg)' }}>
            <span className="exhibit-label">EXHIBIT 0: PREMISE</span>
            <p className="serif-body text-base md:text-lg mt-2">
              Honey. <strong className="not-italic font-bold">{facts.totalMessages.toLocaleString('en-US')} messages</strong> across <strong className="not-italic font-bold">{facts.durationDays} days</strong>
              {isGroup ? (
                <> across <span className="circled">{facts.perPerson.length} people</span>.</>
              ) : (
                <> between <span className="circled">{personA}</span> and <span className="circled">{personB}</span>.</>
              )} Ten findings coming up — one per room.
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
        <PaywallRoom
          facts={facts}
          personA={personA}
          personB={personB}
          shareLeader={shareLeader}
          shareLeaderPct={shareLeaderPct}
          fasterPerson={fasterPerson}
          slowerPerson={slowerPerson}
          hedgeLeader={hedgeLeader}
          hedgePct={hedgePct}
          lateLeader={lateLeader}
          lateLeaderPct={lateLeaderPct}
          burstLeader={burstLeader}
          burstLongest={burstLongest}
          chatId={chatId ?? null}
          onStart={handleModule}
          completedModules={completedModules}
          canAnalyzeRelationship={canAnalyzeRelationship}
        />
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

  // Scroll mode — all content rooms stacked in order, including paywall at the
  // end as just another section. No gate, no interstitial — opening a chat
  // means you see the facts immediately.
  if (mode === 'scroll') {
    const sections = rooms.filter(
      (r) => !(r.kind === 'gimmick' && r.stamp === 'SPILL IT.'),
    )

    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 pb-32 pt-8 space-y-14">
        {sections.map((r, i) =>
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

const PRICE_SINGLE = 3
const PRICE_BUNDLE = 5

function PaywallRoom({
  personA,
  personB,
  shareLeader,
  shareLeaderPct,
  hedgeLeader,
  hedgePct,
  lateLeader,
  chatId,
  onStart,
  completedModules,
  canAnalyzeRelationship,
}: {
  facts: HardFacts
  personA: string
  personB: string
  shareLeader: string
  shareLeaderPct: number
  fasterPerson: string
  slowerPerson: string
  hedgeLeader: string
  hedgePct: number
  lateLeader: string
  lateLeaderPct: number
  burstLeader: string
  burstLongest: number
  chatId: string | null
  onStart: (m: ModuleId) => void
  completedModules: ModuleId[]
  canAnalyzeRelationship: boolean
}) {
  const [picked, setPicked] = useState<ModuleId | null>(null)
  const profilesDone = completedModules.includes('profiles')
  const relationshipDone = completedModules.includes('relationship')

  // Personalized bullet copy — 3 concrete deliverables per file
  const youBullets = [
    `how you write when ${personB.toLowerCase()} goes quiet`,
    `the soft words you use ${hedgePct}% of the time — what they cover`,
    `the move you keep making after every fight`,
  ]
  const usBullets = [
    `why ${shareLeader.toLowerCase()} does ${Math.round(shareLeaderPct)}% of the talking`,
    `the rule neither of you said out loud`,
    `who leads, who follows, and when it flipped`,
  ]

  // After a pick: upsell — now with clear WHAT-YOU-GET on the "other" file.
  // In group chats there is no "other" file, so the upsell is skipped and the
  // FileCard dispatches straight to onStart.
  if (picked && canAnalyzeRelationship) {
    const otherId: ModuleId = picked === 'profiles' ? 'relationship' : 'profiles'
    const pickedName = picked === 'profiles' ? 'PERSONAL ANALYSIS' : 'RELATIONSHIP ANALYSIS'
    const otherName = otherId === 'profiles' ? 'PERSONAL ANALYSIS' : 'RELATIONSHIP ANALYSIS'
    const otherBullets = otherId === 'profiles' ? youBullets : usBullets

    return (
      <section className="space-y-6 md:space-y-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">
          → picked: {pickedName.toLowerCase()}
        </div>

        <div
          className="bg-pop-yellow border-2 border-ink relative p-5 md:p-8"
          style={{ boxShadow: '6px 6px 0 #0A0A0A', transform: 'rotate(-0.4deg)' }}
        >
          <span className="exhibit-label">WAIT.</span>
          <div
            className="absolute -top-3 -right-3 inline-flex items-center gap-2 px-3 py-1 bg-ink text-pop-yellow border-2 border-ink"
            style={{
              transform: 'rotate(8deg)',
              boxShadow: '2px 2px 0 #0A0A0A',
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '14px',
              letterSpacing: '0.04em',
            }}
          >
            SAVE €{PRICE_SINGLE * 2 - PRICE_BUNDLE}
          </div>

          <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink">
            add file {otherId === 'profiles' ? '01' : '02'} · {otherName.toLowerCase()}
          </div>
          <div className="font-serif text-5xl md:text-7xl leading-[0.9] tracking-[-0.02em] text-ink mt-1">
            {otherName}
          </div>
          <p className="serif-body text-base md:text-lg mt-3 text-ink">
            {otherId === 'profiles'
              ? 'how you actually write — when stakes rise, when the room goes quiet.'
              : `what's actually happening between ${personA.toLowerCase()} and ${personB.toLowerCase()}.`}
          </p>

          <ul className="mt-4 space-y-1.5 border-t-2 border-ink border-dashed pt-4">
            {otherBullets.map((b, i) => (
              <li key={i} className="serif-body text-base md:text-lg text-ink flex gap-2">
                <span className="text-ink shrink-0">—</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <p className="serif-body text-base md:text-lg mt-4 text-ink">
            <span className="font-bold not-italic">+€{PRICE_BUNDLE - PRICE_SINGLE}</span> on top of the €{PRICE_SINGLE} you picked. <span className="italic">(normally €{PRICE_SINGLE}.)</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onStart(picked)}
            className="border-2 border-ink bg-pop-yellow px-4 md:px-6 py-4 md:py-5 flex flex-col items-start gap-1 hover:bg-white transition-colors"
            style={{ boxShadow: '3px 3px 0 #0A0A0A' }}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink">just {pickedName.toLowerCase()}</span>
            <span className="font-serif text-3xl md:text-5xl leading-[0.9] text-ink">€{PRICE_SINGLE}</span>
          </button>
          <button
            onClick={() => onStart(picked)}
            className="bg-ink text-pop-yellow border-2 border-ink px-4 md:px-6 py-4 md:py-5 flex flex-col items-start gap-1 hover:bg-pop-yellow hover:text-ink transition-colors relative"
            style={{ boxShadow: '3px 3px 0 #0A0A0A' }}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-pop-yellow">
              both · save €{PRICE_SINGLE * 2 - PRICE_BUNDLE}
            </span>
            <span className="font-serif text-3xl md:text-5xl leading-[0.9]">€{PRICE_BUNDLE}</span>
          </button>
        </div>

        <button
          onClick={() => setPicked(null)}
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/60 hover:text-ink"
        >
          ← change pick
        </button>

        <div className="pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/50">
          95% take the bundle · no subscription · one-time
        </div>
      </section>
    )
  }

  // Initial choice — two cards, each with what-you-get. In group chats only
  // the personal file is offered since "relationship" is inherently pairwise.
  return (
    <section className="space-y-6 md:space-y-8">
      <header>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 mb-1">
          {canAnalyzeRelationship ? '→ two analyses · €3 each' : '→ personal file · €3'}
        </div>
        <h3 className="font-serif text-[20vw] md:text-[180px] leading-[0.82] tracking-[-0.02em] text-ink">
          THE DEEP <span className="bg-pop-yellow px-1">TEA.</span>
        </h3>
        <p className="serif-body text-lg md:text-xl text-ink mt-2 max-w-2xl">
          the numbers were the <span className="italic">what</span>.
          <br />
          {canAnalyzeRelationship ? (
            <>two analyses are the <span className="italic">why</span>.</>
          ) : (
            <>the personal file is the <span className="italic">why</span>.</>
          )}
        </p>
      </header>

      <div className={`grid gap-3 md:gap-5 ${canAnalyzeRelationship ? 'md:grid-cols-2' : ''}`}>
        <FileCard
          num="01"
          title="PERSONAL ANALYSIS."
          tag={`about ${personA.toLowerCase()}`}
          lede={`a psychological read of how ${personA.toLowerCase()} writes in this chat — patterns, tells, the moves you keep making.`}
          bullets={youBullets}
          price={PRICE_SINGLE}
          tilt={-0.4}
          done={profilesDone}
          onPick={() => {
            if (profilesDone) return onStart('profiles')
            if (!canAnalyzeRelationship) return onStart('profiles')
            setPicked('profiles')
          }}
        />
        {canAnalyzeRelationship && (
          <FileCard
            num="02"
            title="RELATIONSHIP ANALYSIS."
            tag={`${personA.toLowerCase()} × ${personB.toLowerCase()}`}
            lede={`what's actually going on between ${personA.toLowerCase()} and ${personB.toLowerCase()} — who gives more, unwritten rules, who leads when.`}
            bullets={usBullets}
            price={PRICE_SINGLE}
            tilt={0.5}
            done={relationshipDone}
            onPick={() => (relationshipDone ? onStart('relationship') : setPicked('relationship'))}
          />
        )}
      </div>

      <MiniShare chatId={chatId} personA={personA} personB={personB} isGroup={!canAnalyzeRelationship} />
    </section>
  )
}

function FileCard({
  num,
  title,
  tag,
  lede,
  bullets,
  price,
  tilt,
  done,
  onPick,
}: {
  num: string
  title: string
  tag: string
  lede: string
  bullets: string[]
  price: number
  tilt: number
  done?: boolean
  onPick: () => void
}) {
  return (
    <button
      onClick={onPick}
      className={`relative p-5 md:p-6 text-left flex flex-col border-2 border-ink transition-colors ${done ? 'bg-pop-yellow hover:bg-white' : 'bg-white hover:bg-pop-yellow'}`}
      style={{ boxShadow: '6px 6px 0 #0A0A0A', transform: `rotate(${tilt}deg)` }}
    >
      <span className="exhibit-label">FILE {num}</span>
      {done && (
        <span
          className="absolute -top-3 -right-3 inline-flex items-center gap-1 px-2.5 py-0.5 bg-ink text-pop-yellow border-2 border-ink"
          style={{
            transform: 'rotate(6deg)',
            boxShadow: '2px 2px 0 #0A0A0A',
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '13px',
            letterSpacing: '0.04em',
          }}
        >
          ✓ YOURS
        </span>
      )}
      <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">
        {tag}
      </div>
      <h4 className="mt-1 font-serif text-3xl md:text-5xl leading-[0.92] tracking-[-0.01em] text-ink">
        {title}
      </h4>
      <p className="mt-2 serif-body text-sm md:text-base text-ink/80 leading-snug">
        {lede}
      </p>

      <ul className="mt-3 space-y-1 border-t-2 border-ink/20 border-dashed pt-3 flex-1">
        {bullets.map((b, i) => (
          <li key={i} className="font-mono text-[11px] md:text-xs uppercase tracking-[0.06em] text-ink/80 flex gap-1.5 leading-snug">
            <span className="text-ink/40 shrink-0">—</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between pt-3 border-t-2 border-ink">
        {done ? (
          <span
            className="font-serif text-xl md:text-2xl tracking-[0.04em] bg-ink text-pop-yellow border-2 border-ink px-3 py-1.5 leading-none"
            style={{ boxShadow: '3px 3px 0 #0A0A0A' }}
          >
            OPEN →
          </span>
        ) : (
          <>
            <span
              className="font-serif text-xl md:text-2xl tracking-[0.04em] bg-pop-yellow text-ink border-2 border-ink px-3 py-1.5 leading-none"
              style={{ boxShadow: '3px 3px 0 #0A0A0A' }}
            >
              UNLOCK
            </span>
            <span className="font-serif text-3xl md:text-4xl leading-none">€{price}</span>
          </>
        )}
      </div>
    </button>
  )
}

function MiniShare({ chatId, personA, personB, isGroup = false }: { chatId: string | null; personA: string; personB: string; isGroup?: boolean }) {
  const [copied, setCopied] = useState(false)
  const canShare = Boolean(chatId)
  const copyLink = async () => {
    if (!chatId) return
    const url = `${window.location.origin}/?scroll=${encodeURIComponent(chatId)}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2400)
    } catch {
      /* ignore */
    }
  }
  void personA
  const sendLabel = isGroup ? 'SEND TO THE GROUP.' : `SEND TO ${personB.toUpperCase()}.`
  return (
    <div
      className="w-full bg-white border-2 border-ink p-4 md:p-5 flex items-center justify-between gap-4"
      style={{ boxShadow: '4px 4px 0 #0A0A0A', transform: 'rotate(-0.2deg)' }}
    >
      <div className="min-w-0 flex flex-col gap-0.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">share this read</span>
        <span className="font-serif text-2xl md:text-3xl leading-[0.95] text-ink truncate">
          {sendLabel}
        </span>
      </div>
      <button
        onClick={copyLink}
        disabled={!canShare}
        className="btn-pop shrink-0 disabled:opacity-40"
      >
        {copied ? (
          <>✓ COPIED</>
        ) : (
          <>
            COPY
            <span aria-hidden className="ml-1">→</span>
          </>
        )}
      </button>
    </div>
  )
}

function ShareBlock({ chatId, personA, personB }: { chatId: string | null; personA: string; personB: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')
  const canShare = Boolean(chatId)

  const copyLink = async () => {
    if (!chatId) return
    const url = `${window.location.origin}/?scroll=${encodeURIComponent(chatId)}`
    try {
      await navigator.clipboard.writeText(url)
      setState('copied')
      setTimeout(() => setState('idle'), 2400)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2400)
    }
  }

  return (
    <aside className="relative" style={{ transform: 'rotate(-0.4deg)' }}>
      <div className="quote-box">
        <span className="exhibit-label">EXHIBIT · SHARE THE TAPE</span>
        <div className="flex flex-col md:flex-row gap-5 md:items-center mt-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-serif text-2xl md:text-4xl leading-tight tracking-tight mb-2 not-italic">
              Send the scroll to {personB}.
            </h4>
            <p className="serif-body text-base leading-snug">
              One link. They see the same numbers {personA} just saw — no signup, no app. Just the receipts.
            </p>
          </div>
          <button
            onClick={copyLink}
            disabled={!canShare || state === 'copied'}
            className="btn-pop shrink-0 self-start md:self-center disabled:opacity-40"
          >
            {state === 'copied' ? (
              <>
                <span aria-hidden>✓</span>
                COPIED
                <span className="text-[10px] font-mono opacity-70 ml-2">· paste it</span>
              </>
            ) : state === 'error' ? (
              <>
                <span aria-hidden>×</span>
                CLIPBOARD BLOCKED
              </>
            ) : (
              <>
                <span aria-hidden>⎘</span>
                COPY LINK
                <span className="text-[10px] font-mono opacity-70 ml-2">· 1 TAP</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
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

