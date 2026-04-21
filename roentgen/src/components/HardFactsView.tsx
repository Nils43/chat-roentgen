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

  // Initiation leader
  const initLeaderIdx = facts.perPerson[0] && facts.perPerson[1]
    ? facts.perPerson[0].initiationShare >= facts.perPerson[1].initiationShare ? 0 : 1
    : 0
  const initLeader = facts.perPerson[initLeaderIdx]?.author ?? personA
  const initLeaderPct = Math.round((facts.perPerson[initLeaderIdx]?.initiationShare ?? 0) * 100)

  // Top emojis comparison
  const aEmojis = facts.perPerson[0]?.topEmojis ?? []
  const bEmojis = facts.perPerson[1]?.topEmojis ?? []

  // Group-awareness — header adapts when >2 people
  const isGroup = facts.perPerson.length > 2
  const peopleLabel = isGroup
    ? `${facts.perPerson.length} voices`
    : `${personA.toLowerCase()} & ${personB.toLowerCase()}`

  const rooms: RoomDef[] = [
    // ── ROOM 1: OPENER — the hardest-hitting asymmetry ──
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

          {/* The punch — biggest asymmetry front and center */}
          <div className="quote-box mt-6 max-w-2xl" style={{ transform: 'rotate(-0.3deg)' }}>
            <span className="exhibit-label">EXHIBIT 0</span>
            <p className="serif-body text-lg md:text-xl mt-2">
              <strong className="not-italic font-bold">{facts.totalMessages.toLocaleString('en-US')} messages</strong> in <strong className="not-italic font-bold">{facts.durationDays} days</strong>.{' '}
              {isGroup ? (
                <>
                  <span className="circled">{facts.perPerson.length} voices</span>.{' '}
                  <span className="circled">{shareLeader}</span> does <strong className="not-italic font-bold">{Math.round(shareLeaderPct)}%</strong> of the talking.
                </>
              ) : (
                <>
                  <span className="circled">{shareLeader}</span> writes <strong className="not-italic font-bold">{Math.round(shareLeaderPct)}%</strong> of them.
                </>
              )}
            </p>
          </div>

          {/* Three mini context tiles — not the main event, just orientation */}
          <section className="grid grid-cols-3 gap-3 mt-6">
            <Tile label="Messages" value={<CountUp value={facts.totalMessages} format={(n) => Math.round(n).toLocaleString('en-US')} />} />
            <Tile label="Active days" value={<CountUp value={facts.activeDays} format={(n) => Math.round(n).toLocaleString('en-US')} />} />
            <Tile label="Longest silence" value={`${facts.longestSilenceDays}d`} />
          </section>
        </>
      ),
    },

    // ── ROOM 2: WHO WRITES MORE — distribution + words ──
    {
      kind: 'content',
      id: 'distribution',
      render: () => (
        <Section kicker="01 · Distribution" title="Who writes more?" body={shareInterp?.body}>
          <SplitBar perPerson={facts.perPerson} metric="share" label="Share of messages" />
          <div className="mt-6 grid grid-cols-2 gap-3">
            {facts.perPerson.map((p, i) => (
              <div key={p.author} className="bg-bg-surface rounded-xl p-5">
                <div className={`label-mono mb-1 ${PERSON_COLORS[i % PERSON_COLORS.length]}`}>{p.author}</div>
                <div className="metric-num text-2xl">{p.avgWords.toFixed(0)} words/msg</div>
                {p.topEmojis.length > 0 && (
                  <div className="flex gap-2 text-xl mt-2">
                    {p.topEmojis.slice(0, 3).map((e) => (
                      <span key={e.emoji} title={`${e.count}x`}>{e.emoji}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      ),
    },

    // ── ROOM 3: SPEED — reply times side by side ──
    {
      kind: 'content',
      id: 'speed',
      render: () => (
        <Section kicker="02 · Speed" title="Who replies how fast?" body={interpretations.find((i) => i.metric.startsWith('reply:'))?.body}>
          <div className="grid grid-cols-2 gap-3 md:gap-4 mb-8">
            {facts.perPerson.map((p, i) => (
              <Tile
                key={p.author}
                label={p.author}
                accent={PERSON_COLORS[i % PERSON_COLORS.length]}
                value={formatDuration(p.medianReplyMs)}
              />
            ))}
          </div>
          <ReplyDistribution perPerson={facts.perPerson} />
        </Section>
      ),
    },

    // ── ROOM 4: INITIATIVE + SILENCE — who holds the contact ──
    {
      kind: 'content',
      id: 'initiative',
      render: () => (
        <Section kicker="03 · Initiative" title="Who starts the conversation?" body={interpretations.find((i) => i.metric.startsWith('init:'))?.body}>
          <SplitBar
            perPerson={facts.perPerson}
            metric="initiation"
            label={`After a pause of 4h+ · ${facts.perPerson.reduce((s, p) => s + p.initiations, 0)} times total`}
          />
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Tile label="Peak day" value={`${fmtDayKey(facts.peakDay.date)} · ${facts.peakDay.count} msgs`} />
            <Tile label="Longest silence" value={`${facts.longestSilenceDays} days`} />
          </div>
        </Section>
      ),
    },

    // ── ROOM 5: LATE NIGHT + BURSTS — the raw stuff ──
    {
      kind: 'content',
      id: 'latenight',
      render: () => (
        <Section kicker="04 · After hours" title="Who writes when nobody is watching?" body="Late night messages (11pm–5am) and burst sequences (3+ messages without reply). When masks slip.">
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {facts.perPerson.map((p, i) => (
              <div key={p.author} className="bg-bg-surface rounded-xl p-5">
                <div className={`label-mono mb-2 ${PERSON_COLORS[i % PERSON_COLORS.length]}`}>{p.author}</div>
                <div className="metric-num text-2xl mb-1">{p.lateNightCount} late</div>
                <div className="text-sm text-ink-muted mb-3">
                  {Math.round(p.lateNightRatio * 100)}% of their messages
                </div>
                <div className="border-t border-line/40 pt-3">
                  <div className="metric-num text-xl">{p.burstCount} bursts</div>
                  <div className="text-sm text-ink-muted">
                    longest: {p.longestBurst} in a row
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      ),
    },

    // ── ROOM 6: YOUR HOUR — peak texting hour per person ──
    {
      kind: 'content',
      id: 'yourhour',
      render: () => (
        <Section kicker="05 · Your hour" title="When do you think of each other?" body={
          facts.perPerson.length >= 2
            ? `${personA} texts most at ${fmtHour(facts.perPerson[0].peakHour)}. ${personB} at ${fmtHour(facts.perPerson[1].peakHour)}.${facts.perPerson[0].peakHour !== facts.perPerson[1].peakHour ? ' Different rhythms.' : ' Same rhythm.'}`
            : undefined
        }>
          <div className="grid grid-cols-2 gap-3">
            {facts.perPerson.map((p, i) => (
              <div key={p.author} className="bg-bg-surface rounded-xl p-5 text-center">
                <div className={`label-mono mb-2 ${PERSON_COLORS[i % PERSON_COLORS.length]}`}>{p.author}</div>
                <div className="metric-num text-4xl md:text-5xl">{fmtHour(p.peakHour)}</div>
                <div className="text-sm text-ink-muted mt-1">most active hour</div>
              </div>
            ))}
          </div>
        </Section>
      ),
    },

    // ── ROOM 7: SHORT REPLIES — who puts in effort ──
    {
      kind: 'content',
      id: 'effort',
      render: () => {
        const moreShortIdx = facts.perPerson[0] && facts.perPerson[1]
          ? facts.perPerson[0].shortReplyRatio >= facts.perPerson[1].shortReplyRatio ? 0 : 1
          : 0
        const shortLeader = facts.perPerson[moreShortIdx]?.author ?? personA
        const shortPct = Math.round((facts.perPerson[moreShortIdx]?.shortReplyRatio ?? 0) * 100)
        return (
          <Section kicker="06 · Effort" title="Who gives one-word answers?" body={`${shortPct}% of ${shortLeader}'s messages are 3 words or less. Short replies aren't always bad — but they add up.`}>
            <div className="grid grid-cols-2 gap-3">
              {facts.perPerson.map((p, i) => (
                <div key={p.author} className="bg-bg-surface rounded-xl p-5">
                  <div className={`label-mono mb-2 ${PERSON_COLORS[i % PERSON_COLORS.length]}`}>{p.author}</div>
                  <div className="metric-num text-3xl mb-1">{Math.round(p.shortReplyRatio * 100)}%</div>
                  <div className="text-sm text-ink-muted">messages with 1-3 words</div>
                  <div className="mt-3 border-t border-line/40 pt-3">
                    <div className="metric-num text-xl">{p.avgWords.toFixed(0)}</div>
                    <div className="text-sm text-ink-muted">avg words per message</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )
      },
    },

    // ── ROOM 8: FIRST & LAST — who starts and ends the day ──
    {
      kind: 'content',
      id: 'firstlast',
      render: () => {
        const totalDays = facts.activeDays || 1
        return (
          <Section kicker="07 · First & last" title="Who starts the day — who ends it?" body={`Out of ${totalDays} active days. The person who texts first in the morning is thinking of you before anything else.`}>
            <div className="space-y-4">
              <div className="card" style={{ transform: 'rotate(-0.2deg)' }}>
                <div className="label-mono mb-3">First message of the day</div>
                <div className="grid grid-cols-2 gap-4">
                  {facts.perPerson.map((p, i) => (
                    <div key={p.author}>
                      <div className={`metric-num text-3xl ${PERSON_COLORS[i % PERSON_COLORS.length]}`}>{p.firstOfDayCount}x</div>
                      <div className="text-sm text-ink-muted">{p.author} · {Math.round((p.firstOfDayCount / totalDays) * 100)}%</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card" style={{ transform: 'rotate(0.15deg)' }}>
                <div className="label-mono mb-3">Last message of the day</div>
                <div className="grid grid-cols-2 gap-4">
                  {facts.perPerson.map((p, i) => (
                    <div key={p.author}>
                      <div className={`metric-num text-3xl ${PERSON_COLORS[i % PERSON_COLORS.length]}`}>{p.lastOfDayCount}x</div>
                      <div className="text-sm text-ink-muted">{p.author} · {Math.round((p.lastOfDayCount / totalDays) * 100)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        )
      },
    },

    // ── ROOM 9: ARC + SHIFT — how it changed over time ──
    {
      kind: 'content',
      id: 'arc',
      render: () => {
        // Compute trend: compare first third vs last third of weekly data
        const w = facts.weekly
        const thirdLen = Math.max(1, Math.floor(w.length / 3))
        const firstThird = w.slice(0, thirdLen)
        const lastThird = w.slice(-thirdLen)
        const avgFirst = firstThird.reduce((s, b) => s + b.count, 0) / firstThird.length
        const avgLast = lastThird.reduce((s, b) => s + b.count, 0) / lastThird.length
        const changePct = avgFirst > 0 ? Math.round(((avgLast - avgFirst) / avgFirst) * 100) : 0
        const peakWeek = w.reduce((best, b) => b.count > best.count ? b : best, w[0])

        let trendBody: string
        if (changePct > 30) {
          trendBody = `This chat is heating up. The last weeks had ${Math.abs(changePct)}% more messages than the beginning. Peak week: ${fmtDayKey2(peakWeek.weekStart)} with ${peakWeek.count} messages.`
        } else if (changePct < -30) {
          trendBody = `This chat is cooling down. The last weeks had ${Math.abs(changePct)}% fewer messages than the beginning. Peak week: ${fmtDayKey2(peakWeek.weekStart)} with ${peakWeek.count} messages.`
        } else {
          trendBody = `Message volume stayed roughly stable. Peak week: ${fmtDayKey2(peakWeek.weekStart)} with ${peakWeek.count} messages.`
        }

        return (
          <Section kicker="05 · Over time" title="How this chat changed" body={trendBody}>
            <EngagementCurve facts={facts} />

            {/* Concrete before/after comparison */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Tile label="Start" value={`${Math.round(avgFirst)}/wk`} />
              <Tile label="Peak" value={`${peakWeek.count}/wk`} accent="text-a" />
              <Tile label="Now" value={`${Math.round(avgLast)}/wk`} accent={changePct < -20 ? 'text-b' : undefined} />
            </div>

            {drift.firstHalfLeader && drift.secondHalfLeader && (
              <div className="mt-6 card" style={{ transform: 'rotate(-0.2deg)' }}>
                <div className="label-mono mb-2">Who holds the contact</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50 mb-1">First half</div>
                    <div className="metric-num text-2xl">{drift.firstHalfLeader} · {Math.round(drift.firstHalfShare * 100)}%</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50 mb-1">Second half</div>
                    <div className={`metric-num text-2xl ${drift.swap ? 'text-b' : ''}`}>{drift.secondHalfLeader} · {Math.round(drift.secondHalfShare * 100)}%</div>
                  </div>
                </div>
                <p className="serif-body text-sm text-ink-muted mt-3">
                  {drift.swap
                    ? `Initiative flipped. First ${drift.firstHalfLeader} started most conversations. Now it's ${drift.secondHalfLeader}.`
                    : `${drift.firstHalfLeader} kept the initiative throughout — ${driftDirection} by ${Math.abs(driftDeltaPct)} points.`}
                </p>
              </div>
            )}
          </Section>
        )
      },
    },

    // ── ROOM 7: SPILL IT + PAYWALL ──
    { kind: 'gimmick', stamp: "SPILL IT.", sub: 'the numbers were the what. the analysis is the why.' },
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

function fmtDayKey2(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtHour(h: number): string {
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

