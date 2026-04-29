import { useEffect, useState, type ReactNode } from 'react'
import { t, useLocale } from '../i18n'
import type { HardFacts } from '../analysis/hardFacts'
import { formatDuration } from '../analysis/hardFacts'
import { CountUp } from './CountUp'
import { SplitBar } from './charts/SplitBar'
import { EngagementCurve } from './charts/EngagementCurve'
import { ReplyDistribution } from './charts/ReplyDistribution'
import { ChatClock } from './charts/ChatClock'
import { ShareModal } from './ShareModal'
import { HardFactsShareCard } from './HardFactsShareCard'
import type { ModuleId } from '../store/chatLibrary'

interface Props {
  facts: HardFacts
  onStartAi?: () => void
  onStartModule?: (moduleId: ModuleId) => void
  /** Signed-in user's current credit balance. 0 → paywall nudges to buy. */
  creditsBalance?: number
  /** Navigate to the credits purchase page. */
  onBuyCredits?: () => void
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

export function HardFactsView({ facts, onStartAi, onStartModule, creditsBalance = 0, onBuyCredits, mode = 'exhibit', onExhibitComplete, chatId, completedModules = [], canAnalyzeRelationship = true }: Props) {
  const locale = useLocale()
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
  // "The other one" relative to the share leader. Find the first perPerson
  // entry whose author differs from the leader — handles ties on sharePct
  // and any edge case where two entries collapsed to the same name. If
  // nobody differs (single-author chat, parser hiccup), shareOther stays
  // undefined and the rendering guard below skips the second clause
  // entirely so we never print the same name twice.
  const shareOther = facts.perPerson.find((p) => p.author !== shareLeader)?.author
  const moreHedgeIdx = facts.perPerson.length > 0 ? argmax('hedgeRatio') : 0
  const hedgePct = Math.round((facts.perPerson[moreHedgeIdx]?.hedgeRatio ?? 0) * 100)
  const hedgeLeader = facts.perPerson[moreHedgeIdx]?.author ?? personA
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
  const lateLeaderPct = Math.round((facts.perPerson[lateLeaderIdx]?.lateNightRatio ?? 0) * 100)
  const lateLeaderCount = facts.perPerson[lateLeaderIdx]?.lateNightCount ?? 0

  // Burst leader (most consecutive un-answered messages)
  const burstLeaderIdx = facts.perPerson.length > 0 ? argmax('longestBurst') : 0
  const burstLeader = facts.perPerson[burstLeaderIdx]?.author ?? personA
  const burstLongest = facts.perPerson[burstLeaderIdx]?.longestBurst ?? 0

  // Initiation leader (who is first back in after a silence)
  const initLeaderIdx = facts.perPerson.length > 0 ? argmax('initiationShare') : 0
  const initLeader = facts.perPerson[initLeaderIdx]?.author ?? personA

  // Initiation drift (first half vs second half)
  const drift = facts.initiationDrift

  type RoomDef =
    | { kind: 'content'; id: string; render: () => ReactNode }
    | { kind: 'gimmick'; stamp: string; sub?: string }

  // Group-awareness — header adapts when >2 people
  const isGroup = facts.perPerson.length > 2
  const peopleLabel = isGroup
    ? `${facts.perPerson.length} voices`
    : `${personA.toLowerCase()} & ${personB.toLowerCase()}`

  // Share-as-image modal — opens from the opener room.
  const [shareOpen, setShareOpen] = useState(false)

  const rooms: RoomDef[] = [
    // ── ROOM 1: OPENER — the hardest-hitting asymmetry ──
    {
      kind: 'content',
      id: 'opener',
      render: () => (
        <section className="space-y-8 md:space-y-10">
          <header className="space-y-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">
              {t('hf.opener.intel', locale, { people: peopleLabel })}
            </div>
            <h2 className="font-serif text-[22vw] md:text-[200px] leading-[0.82] tracking-[-0.02em] text-ink overflow-hidden">
              {t('hf.opener.hero', locale)}
            </h2>
          </header>

          {/* Hero premise — bigger, more personalized lede */}
          <div
            className="bg-pop-yellow border-2 border-ink p-5 md:p-7 max-w-2xl"
            style={{ boxShadow: '6px 6px 0 #0A0A0A', transform: 'rotate(-0.3deg)' }}
          >
            <div
              className="text-xs uppercase tracking-[0.2em] text-ink mb-3"
              style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.16em' }}
            >
              {locale === 'de' ? '✦ EXHIBIT 0 · DIE AUSGANGSLAGE' : '✦ EXHIBIT 0 · THE PREMISE'}
            </div>
            <p className="serif-body text-xl md:text-2xl text-ink leading-snug">
              <strong className="not-italic font-bold">
                {facts.totalMessages.toLocaleString(locale === 'de' ? 'de-DE' : 'en-US')}
              </strong>{' '}
              {locale === 'de' ? 'nachrichten' : 'messages'} ·{' '}
              <strong className="not-italic font-bold">{facts.durationDays}</strong>{' '}
              {locale === 'de' ? 'tage' : 'days'}.{' '}
              {isGroup ? (
                <>
                  <span className="circled">{facts.perPerson.length}</span>{' '}
                  {locale === 'de' ? 'stimmen. ' : 'voices. '}
                  <span className="circled">{shareLeader}</span>{' '}
                  {locale === 'de' ? (
                    <>hält die Bühne — <strong className="not-italic font-bold">{Math.round(shareLeaderPct)}%</strong> aller Nachrichten.</>
                  ) : (
                    <>runs the show — <strong className="not-italic font-bold">{Math.round(shareLeaderPct)}%</strong> of the talking.</>
                  )}
                </>
              ) : (
                <>
                  <span className="circled">{shareLeader}</span>{' '}
                  {locale === 'de' ? (
                    <>
                      schreibt <strong className="not-italic font-bold">{Math.round(shareLeaderPct)}%</strong>. {shareOther && <><span className="circled">{shareOther}</span> den Rest.</>}
                    </>
                  ) : (
                    <>
                      writes <strong className="not-italic font-bold">{Math.round(shareLeaderPct)}%</strong>. {shareOther && <><span className="circled">{shareOther}</span> takes the rest.</>}
                    </>
                  )}
                </>
              )}
            </p>
          </div>

          {/* Four stat tiles — messages, words, active days, longest silence.
              Each with big Bebas display, uniform ink-sticker styling. */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <OpenerStat
              value={<CountUp value={facts.totalMessages} format={(n) => Math.round(n).toLocaleString(locale === 'de' ? 'de-DE' : 'en-US')} />}
              label={locale === 'de' ? 'messages' : 'messages'}
            />
            <OpenerStat
              value={<CountUp value={facts.totalWords} format={(n) => Math.round(n).toLocaleString(locale === 'de' ? 'de-DE' : 'en-US')} />}
              label={locale === 'de' ? 'wörter' : 'words'}
            />
            <OpenerStat
              value={<CountUp value={facts.activeDays} format={(n) => Math.round(n).toLocaleString(locale === 'de' ? 'de-DE' : 'en-US')} />}
              label={locale === 'de' ? 'aktive tage' : 'active days'}
            />
            <OpenerStat
              value={`${facts.longestSilenceDays} ${t('hf.tile.days', locale)}`}
              label={locale === 'de' ? 'längste stille' : 'longest silence'}
              accent={facts.longestSilenceDays >= 7}
            />
          </section>
        </section>
      ),
    },

    // ── ROOM 2: THE SPLIT — who talks more. The hero IS the winner's name ──
    {
      kind: 'content',
      id: 'split',
      render: () => {
        const leader = facts.perPerson[moreShareIdx]
        // For group chats, "the other" isn't a single person — take the
        // runner-up by share so the dual-block hero still reads as a duel.
        const other = facts.perPerson
          .slice()
          .filter((_, i) => i !== moreShareIdx)
          .sort((a, b) => b.sharePct - a.sharePct)[0]
        const leaderShare = Math.round(leader?.sharePct ?? 50)
        const otherShare = other
          ? Math.round(other.sharePct)
          : Math.max(0, 100 - leaderShare)
        return (
          <WrappedSlide
            track={locale === 'de' ? "02 · DIE SHOW" : '02 · THE SHOW'}
            titlePre={
              <span className="block text-ink/40 text-[12vw] md:text-[72px]" style={{ letterSpacing: '-0.01em' }}>
                {locale === 'de' ? 'es ist ' : "it's "}
              </span>
            }
            titleHighlight={`${leader?.author ?? personA}'S`}
            titlePost={locale === 'de' ? ' SHOW.' : ' SHOW.'}
            lede={
              locale === 'de' ? (
                <>
                  <span className="font-bold not-italic">{leader?.author}</span> schreibt{' '}
                  <span className="font-bold not-italic">{leaderShare}%</span> der messages —{' '}
                  mit <span className="font-bold not-italic">{leader?.avgWords.toFixed(0)} wörtern</span> pro
                  zeile.{' '}
                  {other && (
                    <>
                      <span className="font-bold not-italic">{other.author}</span> kriegt{' '}
                      <span className="font-bold not-italic">{otherShare}%</span>, bei{' '}
                      {other.avgWords.toFixed(0)} wörtern.
                    </>
                  )}
                </>
              ) : (
                <>
                  <span className="font-bold not-italic">{leader?.author}</span> writes{' '}
                  <span className="font-bold not-italic">{leaderShare}%</span> of the messages —{' '}
                  at <span className="font-bold not-italic">{leader?.avgWords.toFixed(0)} words</span> a pop.{' '}
                  {other && (
                    <>
                      <span className="font-bold not-italic">{other.author}</span> gets{' '}
                      <span className="font-bold not-italic">{otherShare}%</span>, averaging{' '}
                      {other.avgWords.toFixed(0)}.
                    </>
                  )}
                </>
              )
            }
          >
            {/* Giant dual-block: each person's share as a proportionally-shaded
                ink-yellow split. The winning side is filled, the other outlined. */}
            <div
              className="border-2 border-ink overflow-hidden"
              style={{ boxShadow: '6px 6px 0 #0A0A0A' }}
            >
              <div className="grid grid-cols-[auto_auto]" style={{ gridTemplateColumns: `${leaderShare}fr ${otherShare}fr` }}>
                <div className="bg-pop-yellow border-r-2 border-ink p-6 md:p-8 flex flex-col justify-between gap-4 min-h-[200px]">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/80">
                    {locale === 'de' ? 'der/die lauter' : 'the louder one'}
                  </div>
                  <div>
                    <div
                      className="text-6xl md:text-8xl leading-[0.85] text-ink tabular-nums"
                      style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                    >
                      {leaderShare}%
                    </div>
                    <div
                      className="text-2xl md:text-3xl mt-2 text-ink leading-tight"
                      style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}
                    >
                      {leader?.author.toUpperCase()}
                    </div>
                  </div>
                </div>
                <div className="bg-bg p-4 md:p-6 flex flex-col justify-between gap-2 min-h-[200px]">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60">
                    {locale === 'de' ? 'rest' : 'rest'}
                  </div>
                  <div>
                    <div
                      className="text-3xl md:text-5xl leading-[0.85] text-ink tabular-nums"
                      style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                    >
                      {otherShare}%
                    </div>
                    <div
                      className="text-lg md:text-2xl mt-2 text-ink leading-tight"
                      style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}
                    >
                      {other?.author.toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Words + emojis per person — supporting detail */}
            <div className="grid grid-cols-2 gap-3">
              {facts.perPerson.map((p, i) => (
                <div
                  key={p.author}
                  className="bg-bg border-2 border-ink p-5"
                  style={{ boxShadow: '4px 4px 0 #0A0A0A' }}
                >
                  <div className={`label-mono mb-3 ${PERSON_COLORS[i % PERSON_COLORS.length]}`}>
                    {p.author.toUpperCase()}
                  </div>
                  <div className="flex items-baseline gap-3">
                    <div
                      className="text-4xl leading-none text-ink tabular-nums"
                      style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                    >
                      {p.avgWords.toFixed(0)}
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/60 leading-snug">
                      {locale === 'de' ? 'Ø Wörter pro Message' : 'average words per message'}
                    </div>
                  </div>
                  {p.topEmojis.length > 0 && (
                    <div className="border-t-2 border-ink border-dashed mt-3 pt-3">
                      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink/50 mb-2">
                        {locale === 'de' ? 'top 3' : 'top 3'}
                      </div>
                      <div className="flex gap-2 text-2xl">
                        {p.topEmojis.slice(0, 3).map((e) => (
                          <span key={e.emoji} title={`${e.count}×`}>
                            {e.emoji}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </WrappedSlide>
        )
      },
    },

    // ── ROOM 3: THE PACE — reply speed as the HERO number itself ──
    {
      kind: 'content',
      id: 'pace',
      render: () => {
        const moreShortIdx =
          facts.perPerson[0] && facts.perPerson[1]
            ? facts.perPerson[0].shortReplyRatio >= facts.perPerson[1].shortReplyRatio
              ? 0
              : 1
            : 0
        const shortLeader = facts.perPerson[moreShortIdx]?.author ?? personA
        const shortPct = Math.round((facts.perPerson[moreShortIdx]?.shortReplyRatio ?? 0) * 100)
        const fasterDur = formatDuration(facts.perPerson[fasterIdx]?.medianReplyMs ?? null, locale)
        const slowerDur = formatDuration(facts.perPerson[slowerIdx]?.medianReplyMs ?? null, locale)
        return (
          <WrappedSlide
            track={locale === 'de' ? '03 · DAS TEMPO' : '03 · THE PACE'}
            titlePre={locale === 'de' ? 'WIE ' : 'HOW '}
            titleHighlight={locale === 'de' ? 'SCHNELL?' : 'FAST?'}
            lede={
              locale === 'de' ? (
                <>
                  <span className="font-bold not-italic">{fasterPerson}</span> ist der:die blitz.{' '}
                  <span className="font-bold not-italic">{slowerPerson}</span> lässt es reifen.{' '}
                  <span className="font-bold not-italic">{shortLeader}</span> antwortet zu{' '}
                  <span className="font-bold not-italic">{shortPct}%</span> in 1–3 wörtern — die kunst des
                  one-liners.
                </>
              ) : (
                <>
                  <span className="font-bold not-italic">{fasterPerson}</span> is the lightning.{' '}
                  <span className="font-bold not-italic">{slowerPerson}</span> lets it cook.{' '}
                  <span className="font-bold not-italic">{shortLeader}</span> replies in 1–3 words{' '}
                  <span className="font-bold not-italic">{shortPct}%</span> of the time — fine art of the
                  one-liner.
                </>
              )
            }
          >
            {/* Fast/slow hero: two halves, one yellow one white, names + durations */}
            <div
              className="border-2 border-ink grid grid-cols-1 md:grid-cols-2"
              style={{ boxShadow: '6px 6px 0 #0A0A0A' }}
            >
              <div className="bg-pop-yellow border-b-2 md:border-b-0 md:border-r-2 border-ink p-5 md:p-7">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/80 mb-2">
                  {locale === 'de' ? '⚡ der:die blitz' : '⚡ the lightning'}
                </div>
                <div
                  className="text-6xl md:text-8xl leading-[0.85] text-ink tabular-nums"
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                >
                  {fasterDur}
                </div>
                <div
                  className="text-2xl md:text-3xl mt-2 text-ink"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}
                >
                  {fasterPerson?.toUpperCase()}
                </div>
              </div>
              <div className="bg-white p-5 md:p-7">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60 mb-2">
                  {locale === 'de' ? '⏳ lässt es reifen' : '⏳ lets it cook'}
                </div>
                <div
                  className="text-6xl md:text-8xl leading-[0.85] text-ink tabular-nums"
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                >
                  {slowerDur}
                </div>
                <div
                  className="text-2xl md:text-3xl mt-2 text-ink"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}
                >
                  {slowerPerson?.toUpperCase()}
                </div>
              </div>
            </div>

            {/* Short-reply tiles */}
            <div className="grid grid-cols-2 gap-3">
              {facts.perPerson.map((p, i) => {
                const isKing = i === moreShortIdx
                return (
                  <div
                    key={p.author}
                    className={`border-2 border-ink p-5 ${isKing ? 'bg-ink text-pop-yellow' : 'bg-bg'}`}
                    style={{ boxShadow: '4px 4px 0 #0A0A0A' }}
                  >
                    <div
                      className={`font-mono text-[10px] uppercase tracking-[0.18em] mb-2 ${isKing ? 'opacity-80' : PERSON_COLORS[i % PERSON_COLORS.length]}`}
                    >
                      {p.author.toUpperCase()} {isKing && (locale === 'de' ? '· one-liner-king' : '· one-liner king')}
                    </div>
                    <div className="flex items-baseline gap-3">
                      <div
                        className="text-4xl md:text-5xl leading-none tabular-nums"
                        style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                      >
                        {Math.round(p.shortReplyRatio * 100)}%
                      </div>
                      <div className={`font-mono text-[10px] uppercase tracking-[0.14em] leading-snug ${isKing ? 'opacity-70' : 'text-ink/60'}`}>
                        {locale === 'de' ? '1–3 wörter' : '1–3 words'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div
              className="bg-white border-2 border-ink p-5 md:p-7"
              style={{ boxShadow: '6px 6px 0 #0A0A0A', transform: 'rotate(0.2deg)' }}
            >
              <ReplyDistribution perPerson={facts.perPerson} />
            </div>
          </WrappedSlide>
        )
      },
    },

    // ── ROOM 4: WHO STARTS IT — initiation + first/last of day ──
    {
      kind: 'content',
      id: 'opens',
      render: () => {
        const totalDays = facts.activeDays || 1
        const initLeaderPct = Math.round((facts.perPerson[initLeaderIdx]?.initiationShare ?? 0) * 100)
        const totalInits = facts.perPerson.reduce((s, p) => s + p.initiations, 0)
        return (
          <WrappedSlide
            track={locale === 'de' ? '04 · WER FÄNGT AN' : '04 · WHO STARTS'}
            titlePre={locale === 'de' ? 'WER BRICHT DIE ' : 'WHO BREAKS THE '}
            titleHighlight={locale === 'de' ? 'STILLE?' : 'SILENCE?'}
            lede={
              locale === 'de' ? (
                <>
                  Nach einer Pause schreibt <span className="font-bold not-italic">{initLeader}</span>{' '}
                  als erste:r zurück —{' '}
                  <span className="font-bold not-italic">{initLeaderPct}%</span> von{' '}
                  <span className="font-bold not-italic">{totalInits}</span> mal.
                </>
              ) : (
                <>
                  After a pause, <span className="font-bold not-italic">{initLeader}</span> is first back
                  in —{' '}
                  <span className="font-bold not-italic">{initLeaderPct}%</span> of{' '}
                  <span className="font-bold not-italic">{totalInits}</span> times.
                </>
              )
            }
          >
            <div
              className="bg-white border-2 border-ink p-5 md:p-7"
              style={{ boxShadow: '6px 6px 0 #0A0A0A', transform: 'rotate(-0.3deg)' }}
            >
              <SplitBar
                perPerson={facts.perPerson}
                metric="initiation"
                label={t('hf.firstPause', locale, { n: totalInits })}
              />
            </div>

            {/* First-of-day + last-of-day in one compact grid per person */}
            <div className="grid grid-cols-2 gap-3">
              {facts.perPerson.map((p, i) => (
                <div
                  key={p.author}
                  className="bg-bg border-2 border-ink p-5"
                  style={{ boxShadow: '4px 4px 0 #0A0A0A' }}
                >
                  <div className={`label-mono mb-3 ${PERSON_COLORS[i % PERSON_COLORS.length]}`}>
                    {p.author.toUpperCase()}
                  </div>
                  <div className="flex gap-6">
                    <div>
                      <div
                        className="text-3xl md:text-4xl leading-none text-ink tabular-nums"
                        style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                      >
                        {p.firstOfDayCount}
                      </div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink/60 mt-1">
                        {locale === 'de' ? 'erste message' : 'first message'}
                      </div>
                      <div className="font-mono text-[9px] text-ink/50 mt-0.5">
                        {Math.round((p.firstOfDayCount / totalDays) * 100)}%
                      </div>
                    </div>
                    <div>
                      <div
                        className="text-3xl md:text-4xl leading-none text-ink tabular-nums"
                        style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                      >
                        {p.lastOfDayCount}
                      </div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink/60 mt-1">
                        {locale === 'de' ? 'letzte message' : 'last message'}
                      </div>
                      <div className="font-mono text-[9px] text-ink/50 mt-0.5">
                        {Math.round((p.lastOfDayCount / totalDays) * 100)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </WrappedSlide>
        )
      },
    },

    // ── ROOM 5: THE NIGHTS — after dark + witching hour + bursts ──
    {
      kind: 'content',
      id: 'nights',
      render: () => {
        const lateLeaderRatio = Math.round(
          (facts.perPerson[lateLeaderIdx]?.lateNightRatio ?? 0) * 100,
        )
        // Witching hour: 00:00–03:59 across the whole chat. The spicy slice of
        // "late" — after-midnight rather than just after-22:00.
        let witching = 0
        for (let d = 0; d < 7; d++) {
          for (let h = 0; h <= 3; h++) witching += facts.heatmap[d]?.[h] ?? 0
        }
        const witchingPct = Math.round((witching / (facts.totalMessages || 1)) * 100)
        return (
          <WrappedSlide
            track={locale === 'de' ? '05 · DIE NÄCHTE' : '05 · THE NIGHTS'}
            titlePre={locale === 'de' ? 'NACH ' : 'AFTER '}
            titleHighlight={locale === 'de' ? 'MITTERNACHT' : 'DARK'}
            titlePost="."
            lede={
              locale === 'de' ? (
                <>
                  <span className="font-bold not-italic">{lateLeader}</span> textet{' '}
                  <span className="font-bold not-italic">{lateLeaderPct}%</span> nach 22 uhr —{' '}
                  <span className="font-bold not-italic">{lateLeaderCount}</span> späte messages.
                  {witching > 0 && (
                    <>
                      {' '}<span className="font-bold not-italic">{witching}</span> davon landeten in der
                      witching hour (00–04).
                    </>
                  )}{' '}
                  Wenn's dann richtig flutet, feuert{' '}
                  <span className="font-bold not-italic">{burstLeader}</span>{' '}
                  <span className="font-bold not-italic">{burstLongest}</span> am stück.
                </>
              ) : (
                <>
                  <span className="font-bold not-italic">{lateLeader}</span> sends{' '}
                  <span className="font-bold not-italic">{lateLeaderRatio}%</span> after 22:00 —{' '}
                  <span className="font-bold not-italic">{lateLeaderCount}</span> late texts.
                  {witching > 0 && (
                    <>
                      {' '}<span className="font-bold not-italic">{witching}</span> of them landed in the
                      witching hour (00–04).
                    </>
                  )}{' '}
                  When the floods hit, <span className="font-bold not-italic">{burstLeader}</span> fires{' '}
                  <span className="font-bold not-italic">{burstLongest}</span> in a row.
                </>
              )
            }
          >
            {/* The witching hour as a dramatic, full-bleed ink panel. */}
            {witching > 0 && (
              <div
                className="bg-ink text-pop-yellow border-2 border-ink p-6 md:p-8 relative"
                style={{ boxShadow: '6px 6px 0 #0A0A0A', transform: 'rotate(-0.3deg)' }}
              >
                <div
                  className="absolute -top-3 -right-3 px-3 py-1 bg-pop-yellow text-ink border-2 border-ink pointer-events-none"
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: '14px',
                    letterSpacing: '0.06em',
                    transform: 'rotate(6deg)',
                    boxShadow: '2px 2px 0 #0A0A0A',
                  }}
                >
                  🌒 WITCHING HOUR
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-70 mb-3">
                  {locale === 'de' ? '00:00 bis 04:00 · irgendwas war los' : '00:00 — 04:00 · something was up'}
                </div>
                <div
                  className="text-6xl md:text-8xl leading-[0.85] tabular-nums"
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                >
                  {witching}
                </div>
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] opacity-70 mt-2">
                  {locale === 'de' ? `messages im tiefschwarz · ${witchingPct}% aller` : `messages in the dead of night · ${witchingPct}% of all`}
                </div>
              </div>
            )}

            {/* Per-person late + burst */}
            <div className="grid grid-cols-2 gap-3">
              {facts.perPerson.map((p) => (
                <div
                  key={p.author}
                  className="bg-ink text-pop-yellow border-2 border-ink p-5"
                  style={{ boxShadow: '4px 4px 0 #0A0A0A' }}
                >
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-80 mb-2">
                    {p.author.toUpperCase()}
                  </div>
                  <div
                    className="text-5xl md:text-6xl leading-none mb-1"
                    style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                  >
                    {p.lateNightCount}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-70 mb-3">
                    {locale === 'de' ? `nach 22:00 · ${Math.round(p.lateNightRatio * 100)}%` : `after 22:00 · ${Math.round(p.lateNightRatio * 100)}%`}
                  </div>
                  <div className="border-t-2 border-pop-yellow border-dashed pt-3 flex items-baseline gap-3">
                    <div
                      className="text-3xl tabular-nums"
                      style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                    >
                      {p.longestBurst}
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-70 leading-snug">
                      {locale === 'de' ? 'längste serie' : 'longest streak'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </WrappedSlide>
        )
      },
    },

    // ── ROOM 6: THE CLOCK — full-drama wrapped-style 24h dial ──
    {
      kind: 'content',
      id: 'clock',
      render: () => {
        // Aggregate per-hour totals so the headline above the clock can point
        // at the exact peak hour in words, not just visually on the dial.
        const hourly: number[] = Array(24).fill(0)
        for (let d = 0; d < 7; d++) {
          for (let h = 0; h < 24; h++) hourly[h] += facts.heatmap[d]?.[h] ?? 0
        }
        const peakHour = hourly.reduce((b, c, i, a) => (c > a[b] ? i : b), 0)
        // Who owns that peak hour?
        let peakPerson = ''
        let peakPersonCount = 0
        for (const p of facts.perPerson) {
          const c = p.peakHour === peakHour ? p.peakHourCount : 0
          if (c > peakPersonCount) {
            peakPerson = p.author
            peakPersonCount = c
          }
        }
        return (
          <WrappedSlide
            track={locale === 'de' ? '06 · DIE UHR' : '06 · THE CLOCK'}
            titlePre={locale === 'de' ? 'WANN TEXTET ' : 'WHEN DO YOU '}
            titleHighlight={locale === 'de' ? 'IHR?' : 'TEXT?'}
            lede={
              locale === 'de' ? (
                <>
                  24 stunden, übereinandergelegt. die hot hour ist{' '}
                  <span className="font-bold not-italic">
                    {String(peakHour).padStart(2, '0')}:00
                  </span>
                  {peakPerson && (
                    <>
                      {' '}— da gehört die bühne{' '}
                      <span className="font-bold not-italic">{peakPerson}</span>.
                    </>
                  )}
                </>
              ) : (
                <>
                  24 hours, stacked. the hot hour is{' '}
                  <span className="font-bold not-italic">
                    {String(peakHour).padStart(2, '0')}:00
                  </span>
                  {peakPerson && (
                    <>
                      {' '}— that's <span className="font-bold not-italic">{peakPerson}</span>'s stage.
                    </>
                  )}
                </>
              )
            }
          >
            <div
              className="bg-white border-2 border-ink p-6 md:p-10"
              style={{ boxShadow: '6px 6px 0 #0A0A0A', transform: 'rotate(-0.3deg)' }}
            >
              <ChatClock heatmap={facts.heatmap} perPerson={facts.perPerson} locale={locale} />
            </div>
          </WrappedSlide>
        )
      },
    },

    // ── ROOM 7: THE ARC — time trajectory, peak week, drift ──
    {
      kind: 'content',
      id: 'arc',
      render: () => {
        const w = facts.weekly
        // Guard against zero-week chats (single-day exports): reduce with an
        // empty initial value crashes, and averages divide by zero.
        if (w.length === 0) {
          return (
            <WrappedSlide
              track={locale === 'de' ? '07 · DER BOGEN' : '07 · THE ARC'}
              titlePre={locale === 'de' ? 'ZU ' : 'TOO '}
              titleHighlight={locale === 'de' ? 'KURZ.' : 'SHORT.'}
              lede={
                locale === 'de'
                  ? 'Der chat hat noch keine woche voll — keine kurve zum lesen.'
                  : "The chat hasn't run a full week yet — no curve to draw."
              }
            >
              <div className="text-center font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50 py-10">
                ···
              </div>
            </WrappedSlide>
          )
        }
        const thirdLen = Math.max(1, Math.floor(w.length / 3))
        const firstThird = w.slice(0, thirdLen)
        const lastThird = w.slice(-thirdLen)
        const avgFirst = firstThird.length > 0
          ? firstThird.reduce((s, b) => s + b.count, 0) / firstThird.length
          : 0
        const avgLast = lastThird.length > 0
          ? lastThird.reduce((s, b) => s + b.count, 0) / lastThird.length
          : 0
        const changePct = avgFirst > 0 ? Math.round(((avgLast - avgFirst) / avgFirst) * 100) : 0
        const peakWeek = w.reduce((best, b) => (b.count > best.count ? b : best), w[0])
        const peakWeekLabel = fmtDayKey2(peakWeek.weekStart, locale)

        const trendWord =
          locale === 'de'
            ? changePct > 30
              ? 'HOCH'
              : changePct < -30
                ? 'RUNTER'
                : 'FLACH'
            : changePct > 30
              ? 'UP'
              : changePct < -30
                ? 'DOWN'
                : 'FLAT'

        return (
          <WrappedSlide
            track={locale === 'de' ? '07 · DER BOGEN' : '07 · THE ARC'}
            titlePre={locale === 'de' ? 'ES GING ' : 'IT WENT '}
            titleHighlight={trendWord}
            titlePost={locale === 'de' ? '.' : '.'}
            lede={
              locale === 'de' ? (
                <>
                  Peak-woche: <span className="font-bold not-italic">{peakWeekLabel}</span> mit{' '}
                  <span className="font-bold not-italic">{peakWeek.count}</span> messages.{' '}
                  {changePct !== 0 && (
                    <>
                      Zwischen anfang und jetzt:{' '}
                      <span className="font-bold not-italic">
                        {changePct > 0 ? '+' : ''}
                        {changePct}%
                      </span>
                      .
                    </>
                  )}
                  {facts.longestSilenceDays > 0 && (
                    <>
                      {' '}Längste stille:{' '}
                      <span className="font-bold not-italic">{facts.longestSilenceDays}</span>{' '}
                      {facts.longestSilenceDays === 1 ? 'tag' : 'tage'}.
                    </>
                  )}
                </>
              ) : (
                <>
                  Peak week: <span className="font-bold not-italic">{peakWeekLabel}</span> with{' '}
                  <span className="font-bold not-italic">{peakWeek.count}</span> messages.{' '}
                  {changePct !== 0 && (
                    <>
                      Start to now:{' '}
                      <span className="font-bold not-italic">
                        {changePct > 0 ? '+' : ''}
                        {changePct}%
                      </span>
                      .
                    </>
                  )}
                  {facts.longestSilenceDays > 0 && (
                    <>
                      {' '}Longest silence:{' '}
                      <span className="font-bold not-italic">{facts.longestSilenceDays}</span>{' '}
                      {facts.longestSilenceDays === 1 ? 'day' : 'days'}.
                    </>
                  )}
                </>
              )
            }
          >
            <div
              className="bg-white border-2 border-ink p-5 md:p-7"
              style={{ boxShadow: '6px 6px 0 #0A0A0A' }}
            >
              <EngagementCurve facts={facts} />
            </div>

            {/* Start / Peak / Now tiles — arc snapshot */}
            <div className="grid grid-cols-3 gap-3">
              <div
                className="bg-bg border-2 border-ink p-4 text-center"
                style={{ boxShadow: '3px 3px 0 #0A0A0A' }}
              >
                <div
                  className="text-3xl md:text-4xl leading-none text-ink tabular-nums"
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                >
                  {Math.round(avgFirst)}
                </div>
                <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink/60 mt-1.5">
                  {locale === 'de' ? 'start · /woche' : 'start · /week'}
                </div>
              </div>
              <div
                className="bg-pop-yellow border-2 border-ink p-4 text-center"
                style={{ boxShadow: '3px 3px 0 #0A0A0A' }}
              >
                <div
                  className="text-3xl md:text-4xl leading-none text-ink tabular-nums"
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                >
                  {peakWeek.count}
                </div>
                <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink/60 mt-1.5">
                  {locale === 'de' ? 'peak · /woche' : 'peak · /week'}
                </div>
              </div>
              <div
                className={`border-2 border-ink p-4 text-center ${changePct < -20 ? 'bg-ink text-pop-yellow' : 'bg-bg'}`}
                style={{ boxShadow: '3px 3px 0 #0A0A0A' }}
              >
                <div
                  className="text-3xl md:text-4xl leading-none tabular-nums"
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                >
                  {Math.round(avgLast)}
                </div>
                <div className="font-mono text-[9px] uppercase tracking-[0.16em] opacity-70 mt-1.5">
                  {locale === 'de' ? 'jetzt · /woche' : 'now · /week'}
                </div>
              </div>
            </div>

            {/* Power-shift callout — only render if we have both halves + a real change */}
            {drift.firstHalfLeader && drift.secondHalfLeader && (
              <div
                className="bg-white border-2 border-ink p-5 md:p-6"
                style={{ boxShadow: '4px 4px 0 #0A0A0A', transform: 'rotate(-0.2deg)' }}
              >
                <div className="label-mono mb-3">
                  {locale === 'de' ? 'Die Machtverschiebung' : 'The power shift'}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50 mb-1">
                      {locale === 'de' ? 'erste hälfte' : 'first half'}
                    </div>
                    <div
                      className="text-2xl md:text-3xl leading-none text-ink tabular-nums"
                      style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                    >
                      {drift.firstHalfLeader} · {Math.round(drift.firstHalfShare * 100)}%
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50 mb-1">
                      {locale === 'de' ? 'zweite hälfte' : 'second half'}
                    </div>
                    <div
                      className={`text-2xl md:text-3xl leading-none tabular-nums ${drift.swap ? 'text-b' : 'text-ink'}`}
                      style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                    >
                      {drift.secondHalfLeader} · {Math.round(drift.secondHalfShare * 100)}%
                    </div>
                  </div>
                </div>
                {drift.swap && (
                  <p className="serif-body text-sm text-ink-muted mt-4">
                    {locale === 'de' ? (
                      <>Das Zepter ist gekippt — von {drift.firstHalfLeader} zu {drift.secondHalfLeader}.</>
                    ) : (
                      <>The lead flipped — from {drift.firstHalfLeader} to {drift.secondHalfLeader}.</>
                    )}
                  </p>
                )}
              </div>
            )}
          </WrappedSlide>
        )
      },
    },

    // ── ROOM 8: THE EMOJI CHAMPIONS — top emoji per person, giant ──
    {
      kind: 'content',
      id: 'emojis',
      render: () => {
        // The person with the most emoji usage per message "wins" the crown.
        const emojiIdx =
          facts.perPerson.length > 0
            ? facts.perPerson.reduce(
                (best, p, i, arr) =>
                  (p.topEmojis[0]?.count ?? 0) > (arr[best].topEmojis[0]?.count ?? 0) ? i : best,
                0,
              )
            : 0
        const champ = facts.perPerson[emojiIdx]
        const topEmoji = champ?.topEmojis[0]
        const totalEmojis = facts.perPerson.reduce(
          (s, p) => s + (p.topEmojis.reduce((t, e) => t + e.count, 0) ?? 0),
          0,
        )
        // If nobody actually used emoji, skip the drama, show a placeholder.
        const hasEmoji = (topEmoji?.count ?? 0) > 0
        return (
          <WrappedSlide
            track={locale === 'de' ? '08 · DIE EMOJI-CHAMPIONS' : '08 · THE EMOJI CHAMPS'}
            titlePre={locale === 'de' ? 'IN ' : 'IN '}
            titleHighlight={locale === 'de' ? 'EMOJI.' : 'EMOJI.'}
            lede={
              !hasEmoji ? (
                locale === 'de' ? (
                  <>Kein:e von euch nutzt emojis ernsthaft. Minimalisten, respekt.</>
                ) : (
                  <>Neither of you reaches for emoji. minimalists. respect.</>
                )
              ) : locale === 'de' ? (
                <>
                  <span className="font-bold not-italic">{champ?.author}</span> hält{' '}
                  <span className="text-3xl md:text-4xl align-middle">{topEmoji?.emoji}</span>{' '}
                  <span className="font-bold not-italic">{topEmoji?.count}</span>× in der hand. Insgesamt sind{' '}
                  <span className="font-bold not-italic">{totalEmojis}</span> emojis geflogen.
                </>
              ) : (
                <>
                  <span className="font-bold not-italic">{champ?.author}</span> holds{' '}
                  <span className="text-3xl md:text-4xl align-middle">{topEmoji?.emoji}</span>{' '}
                  <span className="font-bold not-italic">{topEmoji?.count}</span>× in hand. Across the chat,{' '}
                  <span className="font-bold not-italic">{totalEmojis}</span> emojis flew.
                </>
              )
            }
          >
            {hasEmoji && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {facts.perPerson.map((p, i) => {
                  const e = p.topEmojis[0]
                  const isChamp = i === emojiIdx
                  return (
                    <div
                      key={p.author}
                      className={`border-2 border-ink p-6 md:p-8 relative ${isChamp ? 'bg-pop-yellow' : 'bg-white'}`}
                      style={{
                        boxShadow: isChamp ? '6px 6px 0 #0A0A0A' : '4px 4px 0 #0A0A0A',
                        transform: isChamp ? 'rotate(-0.5deg)' : 'rotate(0.3deg)',
                      }}
                    >
                      {isChamp && (
                        <div
                          className="absolute -top-3 -right-3 px-3 py-1 bg-ink text-pop-yellow border-2 border-ink pointer-events-none"
                          style={{
                            fontFamily: "'Bebas Neue', sans-serif",
                            fontSize: '14px',
                            letterSpacing: '0.06em',
                            transform: 'rotate(6deg)',
                            boxShadow: '2px 2px 0 #0A0A0A',
                          }}
                        >
                          👑 CHAMP
                        </div>
                      )}
                      <div className={`font-mono text-[10px] uppercase tracking-[0.18em] mb-3 ${PERSON_COLORS[i % PERSON_COLORS.length]}`}>
                        {p.author.toUpperCase()}
                      </div>
                      <div className="text-[80px] md:text-[120px] leading-none">
                        {e?.emoji ?? '—'}
                      </div>
                      <div className="mt-3 flex items-baseline gap-3">
                        <div
                          className="text-3xl md:text-4xl leading-none text-ink tabular-nums"
                          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                        >
                          {e?.count ?? 0}×
                        </div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/60 leading-snug">
                          {locale === 'de' ? 'meistgenutzt' : 'most-used'}
                        </div>
                      </div>

                      {/* Runner-ups */}
                      {p.topEmojis.slice(1, 4).length > 0 && (
                        <div className="border-t-2 border-ink border-dashed mt-4 pt-3">
                          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink/50 mb-2">
                            {locale === 'de' ? 'runners-up' : 'runners-up'}
                          </div>
                          <div className="flex gap-3 text-2xl">
                            {p.topEmojis.slice(1, 4).map((r) => (
                              <span key={r.emoji} title={`${r.count}×`}>
                                {r.emoji}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </WrappedSlide>
        )
      },
    },

    // ── ROOM 9: THE OFFER — hero + buyable cards + share ──
    {
      kind: 'content',
      id: 'paywall',
      render: () => (
        <PaywallRoom
          personA={personA}
          personB={personB}
          shareLeader={shareLeader}
          shareLeaderPct={shareLeaderPct}
          shareOther={shareOther}
          hedgePct={hedgePct}
          hedgeLeader={hedgeLeader}
          chatId={chatId ?? null}
          onStart={handleModule}
          creditsBalance={creditsBalance}
          onBuyCredits={onBuyCredits}
          completedModules={completedModules}
          canAnalyzeRelationship={canAnalyzeRelationship}
          onShareImage={() => setShareOpen(true)}
        />
      ),
    },

    // ── ROOM 9: CLOSING — end of the exhibit, after the sell ──
    {
      kind: 'content',
      id: 'closing',
      render: () => (
        <ClosingRoom total={facts.totalMessages} />
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
    // Index of the opener room — we inject an early unlock upsell right after
    // it so the buy CTA is visible without scrolling all the way down to the
    // PaywallRoom at the end.
    const openerIdx = sections.findIndex((r) => r.kind === 'content' && r.id === 'opener')

    // Build the children flat — EarlyUnlock has to be a real sibling of the
    // rendered rooms, not a `display:contents` child, otherwise the parent's
    // space-y-* rule short-circuits and the unlock sticker hugs the opener.
    const children: ReactNode[] = []
    sections.forEach((r, i) => {
      if (r.kind === 'content') {
        children.push(
          <div key={`${r.id}-${i}`} className="space-y-8">
            {r.render()}
          </div>,
        )
      } else {
        children.push(
          <div key={`gimmick-${i}`} className="flex justify-center py-4">
            <div
              className="inline-block font-serif text-ink border-2 border-ink px-4 py-1.5 text-xl md:text-2xl tracking-[0.04em] bg-pop-yellow"
              style={{ transform: `rotate(${i % 2 === 0 ? -2 : 2}deg)`, boxShadow: '4px 4px 0 #0A0A0A' }}
            >
              {r.stamp}
            </div>
          </div>,
        )
      }
      // Inject the early unlock sticker right after the opener — only when
      // the user has zero credits, otherwise it's noise.
      if (i === openerIdx && (creditsBalance ?? 0) === 0) {
        children.push(
          <EarlyUnlock
            key="early-unlock"
            locale={locale}
            canAnalyzeRelationship={canAnalyzeRelationship}
            onBuyCredits={onBuyCredits}
          />,
        )
      }
    })

    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 pb-32 pt-8 space-y-8 md:space-y-10">
        {children}
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

      {shareOpen && (
        <ShareModal
          card={<HardFactsShareCard facts={facts} locale={locale} />}
          filename={`spillteato-hardfacts-${(personA + '-' + personB).toLowerCase().replace(/[^a-z0-9-]+/g, '')}.png`}
          shareTitle={locale === 'de' ? 'Hard Facts' : 'Hard Facts'}
          shareText={locale === 'de' ? 'die zahlen sprechen.' : 'the numbers don’t lie.'}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  )
}

// Early unlock — compact upsell sticker, only shown in scroll mode right
// after the opener. The full PaywallRoom still lives at the bottom of the
// scroll, but a chat with a noticeable asymmetry should not require a long
// scroll before the buy CTA shows up. Hidden once the user already has
// credits — the bottom paywall room handles the "spend them" action.
function EarlyUnlock({
  locale,
  canAnalyzeRelationship,
  onBuyCredits,
}: {
  locale: ReturnType<typeof useLocale>
  canAnalyzeRelationship: boolean
  onBuyCredits?: () => void
}) {
  if (!onBuyCredits) return null
  const lede =
    locale === 'de'
      ? canAnalyzeRelationship
        ? 'Wer den Chat trägt. Wer sich rausnimmt. Welcher Move sich seit Monaten wiederholt. Die KI hat\'s gesehen — sie schreibt\'s nur auf, wenn du klickst.'
        : 'Wie du schreibst, wenn du nervös wirst. Was du wiederholst, ohne es zu merken. Welche Tells dich verraten. Die KI hat\'s gesehen — sie schreibt\'s nur auf, wenn du klickst.'
      : canAnalyzeRelationship
        ? 'Who carries the chat. Who pulls back. The move that keeps repeating. The AI has seen it — it only writes it out when you click.'
        : 'How you write when you\'re nervous. What you repeat without noticing. The tells that give you away. The AI has seen it — it only writes it out when you click.'
  const cta =
    locale === 'de'
      ? canAnalyzeRelationship
        ? 'Beide Analysen · €5 →'
        : 'Persönliches Profil · €3 →'
      : canAnalyzeRelationship
        ? 'Both analyses · €5 →'
        : 'Personal profile · €3 →'
  return (
    <section
      className="bg-pop-yellow border-2 border-ink p-5 md:p-7 max-w-2xl"
      style={{ boxShadow: '6px 6px 0 #0A0A0A', transform: 'rotate(-0.4deg)' }}
    >
      <div
        className="text-xs uppercase tracking-[0.2em] text-ink mb-3"
        style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.16em' }}
      >
        ✦ {locale === 'de' ? 'das was darunter liegt' : 'what\'s underneath'}
      </div>
      <p className="serif-body text-xl md:text-2xl text-ink leading-snug mb-5">{lede}</p>
      <button
        onClick={onBuyCredits}
        className="inline-flex items-center gap-2 bg-ink text-pop-yellow border-2 border-ink px-5 py-3 font-mono text-[12px] uppercase tracking-[0.18em] hover:bg-white hover:text-ink transition-colors"
        style={{ boxShadow: '4px 4px 0 #0A0A0A' }}
      >
        {cta} <span aria-hidden>→</span>
      </button>
    </section>
  )
}

function ClosingRoom({ total }: { total: number }) {
  const locale = useLocale()
  return (
    <section className="min-h-[60vh] flex flex-col justify-center space-y-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">
        {t('closing.kicker', locale, { n: total.toLocaleString(locale === 'de' ? 'de-DE' : 'en-US') })}
      </div>
      <h3 className="font-serif text-[20vw] md:text-[180px] leading-[0.82] tracking-[-0.02em] text-ink">
        {t('closing.hero.prefix', locale)}
        <span className="bg-pop-yellow px-1">{t('closing.hero.highlight', locale)}</span>
      </h3>
      <p className="serif-body text-lg md:text-2xl text-ink max-w-3xl leading-snug">
        {t('closing.body.top', locale)}
        <br />
        <span className="text-ink-muted">{t('closing.body.bottom', locale)}</span>
      </p>
      <div className="pt-3 font-mono text-[10px] uppercase tracking-[0.24em] text-ink/40">
        · {t('paywall.endOfTape', locale).replace(/·/g, '').trim()} ·
      </div>
    </section>
  )
}

function PaywallRoom({
  personA,
  personB,
  shareLeader,
  shareLeaderPct,
  shareOther,
  hedgePct,
  hedgeLeader,
  chatId,
  onStart,
  creditsBalance,
  onBuyCredits,
  completedModules,
  canAnalyzeRelationship,
  onShareImage,
}: {
  personA: string
  personB: string
  shareLeader: string
  shareLeaderPct: number
  shareOther?: string
  hedgePct: number
  hedgeLeader: string
  chatId: string | null
  onStart: (m: ModuleId) => void
  creditsBalance: number
  onBuyCredits?: () => void
  completedModules: ModuleId[]
  canAnalyzeRelationship: boolean
  onShareImage?: () => void
}) {
  const locale = useLocale()
  const profilesDone = completedModules.includes('profiles')
  const relationshipDone = completedModules.includes('relationship')
  const hasCredit = creditsBalance > 0

  const youBullets = locale === 'de' ? [
    `wie du schreibst, wenn ${personB.toLowerCase()} ghostet`,
    `die softeren Wörter, die du in ${hedgePct}% deiner Messages nutzt — was sie verbergen`,
    `der Move den du nach jedem Streit wiederholst`,
  ] : [
    `how you write when ${personB.toLowerCase()} goes quiet`,
    `the soft words you use ${hedgePct}% of the time — what they cover`,
    `the move you keep making after every fight`,
  ]
  const usBullets = locale === 'de' ? [
    `warum ${shareLeader.toLowerCase()} ${Math.round(shareLeaderPct)}% der Convo übernimmt`,
    `die Regel die ihr beide nie ausgesprochen habt`,
    `wer führt, wer folgt, und wann es gekippt ist`,
  ] : [
    `why ${shareLeader.toLowerCase()} does ${Math.round(shareLeaderPct)}% of the talking`,
    `the rule neither of you said out loud`,
    `who leads, who follows, and when it flipped`,
  ]

  // Blur-preview teasers — one real fact computed from the chat (the user CAN
  // read this) plus a plausible-shaped interpretation we render under a CSS
  // blur. Goal is to lift the FileCards out of "we promise you bullets" into
  // "we already read your chat — here is one observation, the rest is one
  // click away".
  const file01Preview = {
    headline:
      locale === 'de'
        ? `${hedgeLeader} weicht in ${hedgePct}% der Nachrichten aus`
        : `${hedgeLeader} hedges ${hedgePct}% of the time`,
    blurred:
      locale === 'de'
        ? `Das ist die Stimme von jemandem, der lieber ein Vielleicht hinschickt als ein Nein. Eine kleine Versicherung gegen den Konflikt — die irgendwann zur Haltung wird. Du wartest nicht auf eine Antwort; du wartest auf die Erlaubnis, eine zu wollen.`
        : `That's the voice of someone who tucks a no into a maybe by reflex — a tiny social insurance against conflict that hardens into identity over time. You are not waiting for an answer, you are waiting for permission to want one.`,
  }
  const file02Preview = {
    headline:
      locale === 'de'
        ? `${shareLeader} schreibt ${Math.round(shareLeaderPct)}% — ${shareOther ?? personB} den Rest`
        : `${shareLeader} writes ${Math.round(shareLeaderPct)}% — ${shareOther ?? personB} takes the rest`,
    blurred:
      locale === 'de'
        ? `Die Schieflage ist nicht das Problem — das Muster dahinter schon. Wer mehr schreibt, hält die Leitung offen. Wer wenig sagt, lässt sich umwerben. Über Monate verschiebt das, wer wem gehört.`
        : `The asymmetry isn't the problem; the pattern is. Whoever writes more keeps the line open — whoever says less is the one being courted. Over months, that shifts who belongs to whom.`,
  }

  return (
    <section className="space-y-6 md:space-y-8 relative">
      {/* Final-slide marker */}
      <div
        className="inline-flex items-center gap-2 px-3 py-1 bg-ink text-pop-yellow"
        style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '14px',
          letterSpacing: '0.06em',
          transform: 'rotate(-1.5deg)',
          boxShadow: '3px 3px 0 #0A0A0A',
        }}
      >
        {t('paywall.marker', locale)}
      </div>

      <header>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 mb-1">
          {canAnalyzeRelationship ? t('paywall.kicker.two', locale) : t('paywall.kicker.one', locale)}
        </div>
        <h3 className="font-serif text-[20vw] md:text-[180px] leading-[0.82] tracking-[-0.02em] text-ink">
          {t('paywall.hero.prefix', locale)}<span className="bg-pop-yellow px-1">{t('paywall.hero.highlight', locale)}</span>
        </h3>
        <p className="serif-body text-lg md:text-xl text-ink mt-2 max-w-2xl">
          {t('paywall.sub.prefix', locale)}<span className="italic">{t('paywall.sub.what', locale)}</span>.
          <br />
          {canAnalyzeRelationship ? (
            <>{t('paywall.sub.two', locale)}<span className="italic">{t('paywall.sub.why', locale)}</span>.</>
          ) : (
            <>{t('paywall.sub.one', locale)}<span className="italic">{t('paywall.sub.why', locale)}</span>.</>
          )}
        </p>
      </header>

      {/* Balance callout — what the user has right now. If 0: buy-nudge. */}
      <div
        className={`border-2 border-ink p-4 md:p-5 flex items-center justify-between gap-4 ${hasCredit ? 'bg-pop-yellow' : 'bg-white'}`}
        style={{
          boxShadow: '4px 4px 0 #0A0A0A',
          transform: 'rotate(-0.3deg)',
        }}
      >
        <div className="flex items-baseline gap-3">
          <div
            className="text-4xl md:text-5xl leading-none text-ink tabular-nums"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            {creditsBalance}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/70 leading-snug">
            {locale === 'de'
              ? creditsBalance === 1 ? 'credit · 1 analyse' : 'credits · je 1 analyse'
              : creditsBalance === 1 ? 'credit · 1 analysis' : 'credits · 1 analysis each'}
          </div>
        </div>
        {!hasCredit && onBuyCredits && (
          <button
            onClick={onBuyCredits}
            className="bg-ink text-pop-yellow border-2 border-ink px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] hover:bg-pop-yellow hover:text-ink transition-colors"
            style={{ boxShadow: '3px 3px 0 #0A0A0A' }}
          >
            {locale === 'de' ? 'credits kaufen →' : 'buy credits →'}
          </button>
        )}
      </div>

      <div className={`grid gap-3 md:gap-5 ${canAnalyzeRelationship ? 'md:grid-cols-2' : ''}`}>
        <FileCard
          num="01"
          title={t('paywall.file01.title', locale)}
          tag={`${t('paywall.file.about', locale)} ${personA.toLowerCase()}`}
          lede={t('paywall.file01.lede', locale, { name: personA.toLowerCase() })}
          bullets={youBullets}
          preview={file01Preview}
          tilt={-0.4}
          done={profilesDone}
          onPick={() => onStart('profiles')}
          locale={locale}
        />
        {canAnalyzeRelationship && (
          <FileCard
            num="02"
            title={t('paywall.file02.title', locale)}
            tag={`${personA.toLowerCase()} × ${personB.toLowerCase()}`}
            lede={t('paywall.file02.lede', locale, { a: personA.toLowerCase(), b: personB.toLowerCase() })}
            bullets={usBullets}
            preview={file02Preview}
            tilt={0.5}
            done={relationshipDone}
            onPick={() => onStart('relationship')}
            locale={locale}
          />
        )}
      </div>

      <MiniShare
        chatId={chatId}
        personA={personA}
        personB={personB}
        isGroup={!canAnalyzeRelationship}
        onShareImage={onShareImage}
      />

      <div className="pt-6 text-center">
        <div className="inline-block font-mono text-[10px] uppercase tracking-[0.24em] text-ink/40 border-t-2 border-dotted border-ink/30 pt-3 px-6">
          {t('paywall.endOfTape', locale)}
        </div>
      </div>
    </section>
  )
}


function FileCard({
  num,
  title,
  tag,
  lede,
  bullets,
  preview,
  tilt,
  done,
  loading,
  onPick,
}: {
  num: string
  title: string
  tag: string
  lede: string
  bullets: string[]
  /** Optional teaser block: a real, readable headline derived from the user's
   *  Hard Facts plus a blurred plausible interpretation. The point is to lift
   *  the FileCard from "we promise you bullets" to "we already read your chat
   *  — here's one observation, the rest is one click away." Hidden once the
   *  user has unlocked this file (the real analysis is now available). */
  preview?: { headline: string; blurred: string }
  tilt: number
  done?: boolean
  loading?: boolean
  onPick: () => void
  locale: 'en' | 'de'
}) {
  const locale = useLocale()
  return (
    <button
      onClick={onPick}
      disabled={loading}
      className={`relative p-5 md:p-6 text-left flex flex-col border-2 border-ink transition-colors disabled:cursor-wait ${done ? 'bg-pop-yellow hover:bg-white' : 'bg-white hover:bg-pop-yellow'}`}
      style={{ boxShadow: '6px 6px 0 #0A0A0A', transform: `rotate(${tilt}deg)`, opacity: loading ? 0.6 : 1 }}
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
          {t('paywall.yours', locale)}
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

      {preview && !done && (
        <div className="mt-4 border-2 border-ink/20 border-dashed p-3 bg-ink/[0.02] relative">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/60 mb-1.5">
            {locale === 'de' ? 'eine beobachtung' : 'one observation'}
          </div>
          <div className="serif-body text-sm md:text-base text-ink leading-snug mb-2">
            {preview.headline}
          </div>
          <div
            className="serif-body italic text-sm md:text-base text-ink/90 leading-snug select-none"
            style={{ filter: 'blur(5px)', userSelect: 'none' }}
            aria-hidden="true"
          >
            {preview.blurred}
          </div>
          <span
            className="absolute right-2 bottom-2 inline-flex items-center gap-1 px-1.5 py-0.5 bg-ink text-pop-yellow"
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '11px',
              letterSpacing: '0.06em',
              boxShadow: '2px 2px 0 #0A0A0A',
            }}
          >
            ✦ {locale === 'de' ? 'freischalten' : 'unlock'}
          </span>
        </div>
      )}

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
            {t('paywall.open', locale)}
          </span>
        ) : (
          <>
            <span
              className="font-serif text-xl md:text-2xl tracking-[0.04em] bg-pop-yellow text-ink border-2 border-ink px-3 py-1.5 leading-none"
              style={{ boxShadow: '3px 3px 0 #0A0A0A' }}
            >
              {t('paywall.unlock', locale)}
            </span>
            <span
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/70"
            >
              {locale === 'de' ? '1 credit ✦' : '1 credit ✦'}
            </span>
          </>
        )}
      </div>
    </button>
  )
}

function MiniShare({
  personA,
  personB,
  isGroup = false,
  onShareImage,
}: {
  chatId: string | null
  personA: string
  personB: string
  isGroup?: boolean
  onShareImage?: () => void
}) {
  const locale = useLocale()
  void personA
  const sendLabel = isGroup
    ? (locale === 'de' ? 'AN DIE GRUPPE.' : 'SEND TO THE GROUP.')
    : `${t('share.sendTo', locale)} ${personB.toUpperCase()}.`
  return (
    <div
      className="w-full bg-white border-2 border-ink p-4 md:p-5 flex items-center justify-between gap-4"
      style={{ boxShadow: '4px 4px 0 #0A0A0A', transform: 'rotate(-0.2deg)' }}
    >
      <div className="min-w-0 flex flex-col gap-0.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">{t('share.label', locale)}</span>
        <span className="font-serif text-2xl md:text-3xl leading-[0.95] text-ink truncate">
          {sendLabel}
        </span>
      </div>
      <button
        onClick={onShareImage}
        disabled={!onShareImage}
        className="btn-pop shrink-0 disabled:opacity-40"
      >
        {locale === 'de' ? 'spill’s' : 'spill it'}
        <span aria-hidden className="ml-1">↗</span>
      </button>
    </div>
  )
}

// Spotify-Wrapped-style slide shell. Used for all Hard Facts content rooms so
// the flow feels like episodic tracks: rotated ink sticker marks the track,
// giant Bebas hero, one-line lede with a yellow-highlighted pull-phrase, then
// the visualization. The ink sticker uses an `✦ TRACK NN` pattern shared with
// the rest of the app's Wrapped rhythm.
function WrappedSlide({
  track,
  titlePre,
  titleHighlight,
  titlePost,
  lede,
  children,
}: {
  track: string
  titlePre: React.ReactNode
  titleHighlight?: React.ReactNode
  titlePost?: React.ReactNode
  lede?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-8 md:space-y-12">
      <div className="space-y-5 md:space-y-6">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 bg-ink text-pop-yellow"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '14px',
            letterSpacing: '0.06em',
            transform: 'rotate(-1.5deg)',
            boxShadow: '3px 3px 0 #0A0A0A',
          }}
        >
          ✦ TRACK {track}
        </div>
        <h3 className="font-serif text-[14vw] md:text-[96px] leading-[0.9] tracking-[-0.02em] text-ink max-w-full break-words">
          {titlePre}
          {titleHighlight && <span className="bg-pop-yellow px-1">{titleHighlight}</span>}
          {titlePost}
        </h3>
        {lede && (
          <p className="serif-body text-lg md:text-xl text-ink max-w-2xl leading-relaxed pt-2">
            {lede}
          </p>
        )}
      </div>
      {children}
    </section>
  )
}


// Opener-specific stat tile — matches the Wrapped-card brutalist vibe
// (ink border, drop shadow, Bebas display number, mono caption). Used on the
// first slide so the four headline numbers all rhyme.
function OpenerStat({
  value,
  label,
  accent,
}: {
  value: React.ReactNode
  label: string
  accent?: boolean
}) {
  return (
    <div
      className={`border-2 border-ink p-4 ${accent ? 'bg-ink text-pop-yellow' : 'bg-white'}`}
      style={{ boxShadow: '4px 4px 0 #0A0A0A' }}
    >
      <div
        className="text-4xl md:text-5xl leading-none tabular-nums"
        style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.01em' }}
      >
        {value}
      </div>
      <div className={`font-mono text-[10px] uppercase tracking-[0.18em] mt-2 ${accent ? 'opacity-80' : 'text-ink/60'}`}>
        {label}
      </div>
    </div>
  )
}

function fmtDayKey2(d: Date, locale: 'en' | 'de'): string {
  // Long month name feels less clipped in the Wrapped headlines ("March 14"
  // beats "Mar 14"). Uses the locale's own names so German reads "14. März".
  return d.toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-US', {
    month: 'long',
    day: 'numeric',
  })
}

