import type { Message, ParsedChat } from '../parser/types'

// Hard Facts — module 01. Everything in this file runs in the browser.
// No network. No persistence. Pure functions over Message[].

export interface PerPersonStats {
  author: string
  messages: number
  sharePct: number
  words: number
  chars: number
  avgWords: number
  avgChars: number
  questionCount: number
  questionRatio: number // share of this person's messages that contain a ?
  emojiCount: number
  emojiPerMsg: number
  topEmojis: { emoji: string; count: number }[]
  hedgeCount: number
  hedgeRatio: number // share of this person's messages containing a hedge word
  // Response times = time from PREVIOUS speaker's last message to this person's reply.
  medianReplyMs: number | null
  meanReplyMs: number | null
  replyBuckets: { under5m: number; under1h: number; under1d: number; over1d: number }
  // Conversation initiation: first message after a pause of 4h+.
  initiations: number
  initiationShare: number
  // Power score — composite 0..100 from message share, initiation share, speed.
  powerScore: number
  // Late-night messages (23:00–04:59) — when masks tend to slip.
  lateNightCount: number
  lateNightRatio: number
  // Bursts: sequences of 3+ messages from this person without other-side reply.
  burstCount: number
  longestBurst: number
  // Short replies: messages with 1-3 words.
  shortReplyCount: number
  shortReplyRatio: number
  // First/last message of the day
  firstOfDayCount: number
  lastOfDayCount: number
  // Peak hour (0-23) — the hour this person sends the most messages
  peakHour: number
  peakHourCount: number
}

export interface HardFacts {
  totalMessages: number
  totalWords: number
  totalChars: number
  totalEmojis: number
  firstTs: Date
  lastTs: Date
  durationDays: number
  activeDays: number
  silentDays: number
  longestSilenceDays: number
  peakDay: { date: string; count: number }
  perPerson: PerPersonStats[]
  // 7×24 heatmap: [dayOfWeek 0=Mo][hour 0..23] = count
  heatmap: number[][]
  // Weekly bucket engagement curve
  weekly: { weekStart: Date; count: number; perPerson: Record<string, number> }[]
  // Investment delta (difference in power scores, 0..100)
  investmentDelta: number
  // Initiation drift: how much initiation share shifted between first and
  // second half of the chat. Positive = leader-A grew, negative = leader-A shrank.
  initiationDrift: {
    firstHalfLeader: string | null
    secondHalfLeader: string | null
    firstHalfShare: number // share of leader in first half (0..1)
    secondHalfShare: number // share of same leader in second half (0..1)
    swap: boolean // true if the leader changed between halves
  }
}

const HEDGE_PATTERNS_DE = [
  /\bvielleicht\b/gi,
  /\beigentlich\b/gi,
  /\birgendwie\b/gi,
  /\bwei[ßs]\s+nicht\b/gi,
  /\bnur\s+so\b/gi,
  /\bglaub(?:e|')?\b/gi,
  /\bkönnte\b/gi,
  /\bhalt\b/gi,
  /\bsozusagen\b/gi,
  /\bfast\b/gi,
]
const HEDGE_PATTERNS_EN = [
  /\bmaybe\b/gi,
  /\bprobably\b/gi,
  /\bkinda\b/gi,
  /\bsort\s+of\b/gi,
  /\bkind\s+of\b/gi,
  /\bi\s+guess\b/gi,
  /\bi\s+think\b/gi,
  /\bjust\b/gi,
  /\bsomehow\b/gi,
  /\bperhaps\b/gi,
]

// Emoji detection: covers most pictographic emoji ranges.
// eslint-disable-next-line no-misleading-character-class
const EMOJI_RE =
  /(\p{Extended_Pictographic})(\uFE0F|\u200D\p{Extended_Pictographic})*/gu

function countWords(s: string): number {
  const trimmed = s.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

function countEmojis(s: string): { total: number; tokens: string[] } {
  const tokens = [...s.matchAll(EMOJI_RE)].map((m) => m[0])
  return { total: tokens.length, tokens }
}

function countHedges(s: string, locale: ParsedChat['locale']): number {
  const patterns =
    locale === 'en' ? HEDGE_PATTERNS_EN : locale === 'mixed' ? [...HEDGE_PATTERNS_DE, ...HEDGE_PATTERNS_EN] : HEDGE_PATTERNS_DE
  let total = 0
  for (const re of patterns) {
    re.lastIndex = 0
    const matches = s.match(re)
    if (matches) total += matches.length
  }
  return total
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function startOfISOWeek(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  // ISO: Monday = 1 … Sunday = 7. getDay(): Sun=0 … Sat=6.
  const day = c.getDay()
  const diff = day === 0 ? -6 : 1 - day
  c.setDate(c.getDate() + diff)
  return c
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function analyzeHardFacts(chat: ParsedChat): HardFacts {
  const { messages, participants, locale } = chat

  if (messages.length === 0) {
    throw new Error('No messages to analyze.')
  }

  const firstTs = messages[0].ts
  const lastTs = messages[messages.length - 1].ts
  const durationDays = Math.max(1, Math.ceil((+lastTs - +firstTs) / 86400000))

  // Per-person accumulators
  const perPersonAgg: Record<
    string,
    {
      messages: number
      words: number
      chars: number
      questions: number
      emojis: number
      emojiCounts: Map<string, number>
      hedges: number
      replies: number[] // ms from other-person's last msg to this person's reply
      initiations: number
    }
  > = {}

  for (const p of participants) {
    perPersonAgg[p] = {
      messages: 0,
      words: 0,
      chars: 0,
      questions: 0,
      emojis: 0,
      emojiCounts: new Map(),
      hedges: 0,
      replies: [],
      initiations: 0,
    }
  }

  // Side accumulators for the new metrics.
  const lateNightAgg: Record<string, number> = {}
  const burstStats: Record<string, { count: number; longest: number }> = {}
  const shortReplyAgg: Record<string, number> = {}
  const hourAgg: Record<string, number[]> = {} // per person, 24 buckets
  const firstOfDay: Record<string, number> = {}
  const lastOfDay: Record<string, number> = {}
  const dayLastAuthor: Map<string, string> = new Map() // dayKey -> last author seen
  const dayFirstAuthor: Map<string, string> = new Map() // dayKey -> first author seen
  for (const p of participants) {
    lateNightAgg[p] = 0
    burstStats[p] = { count: 0, longest: 0 }
    shortReplyAgg[p] = 0
    hourAgg[p] = Array(24).fill(0)
    firstOfDay[p] = 0
    lastOfDay[p] = 0
  }
  let currentRunAuthor: string | null = null
  let currentRunLen = 0
  const flushRun = () => {
    if (currentRunAuthor && currentRunLen >= 3) {
      const s = burstStats[currentRunAuthor]
      if (s) {
        s.count++
        if (currentRunLen > s.longest) s.longest = currentRunLen
      }
    }
  }
  // Per-half initiation tracking
  const halfMs = (+messages[messages.length - 1].ts - +messages[0].ts) / 2
  const halfThreshold = +messages[0].ts + halfMs
  const halfInitiations: Record<string, [number, number]> = {}
  for (const p of participants) halfInitiations[p] = [0, 0]

  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  const dayCounts = new Map<string, number>()
  const activeDaySet = new Set<string>()

  const INITIATION_GAP_MS = 4 * 60 * 60 * 1000 // 4h silence = new conversation

  let totalEmojis = 0
  let totalWords = 0
  let totalChars = 0

  let prev: Message | null = null
  let longestGap = 0

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const agg = perPersonAgg[msg.author]
    if (!agg) continue // safety

    agg.messages++
    agg.chars += msg.text.length
    const w = countWords(msg.text)
    agg.words += w
    totalChars += msg.text.length
    totalWords += w

    if (msg.text.includes('?')) agg.questions++

    const { total: emojiTotal, tokens } = countEmojis(msg.text)
    agg.emojis += emojiTotal
    totalEmojis += emojiTotal
    for (const t of tokens) agg.emojiCounts.set(t, (agg.emojiCounts.get(t) ?? 0) + 1)

    agg.hedges += countHedges(msg.text, locale)

    // Heatmap: getDay Sun=0..Sat=6 → Mon=0..Sun=6
    const jsDay = msg.ts.getDay()
    const dow = jsDay === 0 ? 6 : jsDay - 1
    heatmap[dow][msg.ts.getHours()]++

    const k = dayKey(msg.ts)
    dayCounts.set(k, (dayCounts.get(k) ?? 0) + 1)
    activeDaySet.add(k)

    if (prev) {
      const gap = +msg.ts - +prev.ts
      if (gap > longestGap) longestGap = gap
      if (msg.author !== prev.author) {
        // Reply from current author to previous author
        agg.replies.push(gap)
        if (gap >= INITIATION_GAP_MS) {
          agg.initiations++
          const halfIdx = +msg.ts < halfThreshold ? 0 : 1
          halfInitiations[msg.author][halfIdx]++
        }
        // Author changed → flush run from previous, start new run for current.
        flushRun()
        currentRunAuthor = msg.author
        currentRunLen = 1
      }
      // Very first message after 4h silence from same speaker also counts as initiation
      else if (gap >= INITIATION_GAP_MS) {
        agg.initiations++
        const halfIdx = +msg.ts < halfThreshold ? 0 : 1
        halfInitiations[msg.author][halfIdx]++
        // Treat as start of a new run.
        flushRun()
        currentRunAuthor = msg.author
        currentRunLen = 1
      } else {
        currentRunLen++
      }
    } else {
      // First message of the whole chat counts as initiation
      agg.initiations++
      const halfIdx = +msg.ts < halfThreshold ? 0 : 1
      halfInitiations[msg.author][halfIdx]++
      currentRunAuthor = msg.author
      currentRunLen = 1
    }

    // Late-night: 23:00–04:59 (local time)
    const hr = msg.ts.getHours()
    if (hr >= 23 || hr < 5) lateNightAgg[msg.author] = (lateNightAgg[msg.author] ?? 0) + 1

    // Short replies: 1-3 words
    if (w >= 1 && w <= 3) shortReplyAgg[msg.author] = (shortReplyAgg[msg.author] ?? 0) + 1

    // Per-hour tracking
    if (hourAgg[msg.author]) hourAgg[msg.author][hr]++

    // First/last of day tracking
    if (!dayFirstAuthor.has(k)) dayFirstAuthor.set(k, msg.author)
    dayLastAuthor.set(k, msg.author)

    prev = msg
  }
  // Flush the final run.
  flushRun()

  // Tally first/last of day
  for (const [, author] of dayFirstAuthor) firstOfDay[author] = (firstOfDay[author] ?? 0) + 1
  for (const [, author] of dayLastAuthor) lastOfDay[author] = (lastOfDay[author] ?? 0) + 1

  // Peak day
  let peakDay = { date: '', count: 0 }
  for (const [date, count] of dayCounts) {
    if (count > peakDay.count) peakDay = { date, count }
  }

  const totalInitiations = participants.reduce((s, p) => s + perPersonAgg[p].initiations, 0) || 1

  // Build per-person stats
  const perPerson: PerPersonStats[] = participants.map((author) => {
    const agg = perPersonAgg[author]
    const sharePct = (agg.messages / messages.length) * 100
    const replyBuckets = {
      under5m: 0,
      under1h: 0,
      under1d: 0,
      over1d: 0,
    }
    for (const r of agg.replies) {
      if (r < 5 * 60 * 1000) replyBuckets.under5m++
      else if (r < 60 * 60 * 1000) replyBuckets.under1h++
      else if (r < 24 * 60 * 60 * 1000) replyBuckets.under1d++
      else replyBuckets.over1d++
    }
    const topEmojis = [...agg.emojiCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([emoji, count]) => ({ emoji, count }))

    return {
      author,
      messages: agg.messages,
      sharePct,
      words: agg.words,
      chars: agg.chars,
      avgWords: agg.messages ? agg.words / agg.messages : 0,
      avgChars: agg.messages ? agg.chars / agg.messages : 0,
      questionCount: agg.questions,
      questionRatio: agg.messages ? agg.questions / agg.messages : 0,
      emojiCount: agg.emojis,
      emojiPerMsg: agg.messages ? agg.emojis / agg.messages : 0,
      topEmojis,
      hedgeCount: agg.hedges,
      hedgeRatio: agg.messages ? agg.hedges / agg.messages : 0,
      medianReplyMs: median(agg.replies),
      meanReplyMs: mean(agg.replies),
      replyBuckets,
      initiations: agg.initiations,
      initiationShare: agg.initiations / totalInitiations,
      powerScore: 0, // fill below
      lateNightCount: lateNightAgg[author] ?? 0,
      lateNightRatio: agg.messages ? (lateNightAgg[author] ?? 0) / agg.messages : 0,
      burstCount: burstStats[author]?.count ?? 0,
      longestBurst: burstStats[author]?.longest ?? 0,
      shortReplyCount: shortReplyAgg[author] ?? 0,
      shortReplyRatio: agg.messages ? (shortReplyAgg[author] ?? 0) / agg.messages : 0,
      firstOfDayCount: firstOfDay[author] ?? 0,
      lastOfDayCount: lastOfDay[author] ?? 0,
      peakHour: (hourAgg[author] ?? []).reduce((best, c, h, arr) => c > arr[best] ? h : best, 0),
      peakHourCount: Math.max(...(hourAgg[author] ?? [0])),
    }
  })

  // Power Score: composite 0..100. Higher = LESS relational investment.
  // Principle of Least Interest: the person who invests less has more power.
  // Signals (each normalized, then weighted):
  //   messageShare  (lower share → higher power)         weight 0.35
  //   initiationShare (lower share → higher power)       weight 0.35
  //   medianReplySpeed (slower reply → higher power)     weight 0.30
  const medianSpeeds = perPerson.map((p) => p.medianReplyMs ?? 0)
  const maxMedian = Math.max(1, ...medianSpeeds)
  perPerson.forEach((p) => {
    const shareInv = 1 - p.sharePct / 100
    const initInv = 1 - p.initiationShare
    const speedNorm = (p.medianReplyMs ?? 0) / maxMedian
    const raw = 0.35 * shareInv + 0.35 * initInv + 0.3 * speedNorm
    p.powerScore = Math.round(raw * 100)
  })

  // Investment delta between two strongest contributors
  let investmentDelta = 0
  if (perPerson.length >= 2) {
    const sorted = [...perPerson].sort((a, b) => b.powerScore - a.powerScore)
    investmentDelta = Math.abs(sorted[0].powerScore - sorted[1].powerScore)
  }

  // Weekly engagement curve
  const weeklyMap = new Map<number, { weekStart: Date; count: number; perPerson: Record<string, number> }>()
  for (const msg of messages) {
    const ws = startOfISOWeek(msg.ts)
    const key = +ws
    let bucket = weeklyMap.get(key)
    if (!bucket) {
      bucket = { weekStart: ws, count: 0, perPerson: {} }
      participants.forEach((p) => (bucket!.perPerson[p] = 0))
      weeklyMap.set(key, bucket)
    }
    bucket.count++
    bucket.perPerson[msg.author] = (bucket.perPerson[msg.author] ?? 0) + 1
  }
  const weekly = [...weeklyMap.values()].sort((a, b) => +a.weekStart - +b.weekStart)

  const activeDays = activeDaySet.size
  const silentDays = Math.max(0, durationDays - activeDays)
  const longestSilenceDays = Math.round(longestGap / 86400000)

  // Initiation drift between halves
  const firstHalfTotals: Record<string, number> = {}
  const secondHalfTotals: Record<string, number> = {}
  for (const p of participants) {
    firstHalfTotals[p] = halfInitiations[p][0]
    secondHalfTotals[p] = halfInitiations[p][1]
  }
  const sumFirst = Object.values(firstHalfTotals).reduce((s, n) => s + n, 0)
  const sumSecond = Object.values(secondHalfTotals).reduce((s, n) => s + n, 0)
  let firstHalfLeader: string | null = null
  let secondHalfLeader: string | null = null
  let firstMax = -1
  let secondMax = -1
  for (const p of participants) {
    if (firstHalfTotals[p] > firstMax) {
      firstMax = firstHalfTotals[p]
      firstHalfLeader = p
    }
    if (secondHalfTotals[p] > secondMax) {
      secondMax = secondHalfTotals[p]
      secondHalfLeader = p
    }
  }
  const firstHalfShare = sumFirst > 0 && firstHalfLeader ? firstHalfTotals[firstHalfLeader] / sumFirst : 0
  const secondHalfShare =
    sumSecond > 0 && firstHalfLeader ? (secondHalfTotals[firstHalfLeader] ?? 0) / sumSecond : 0

  return {
    totalMessages: messages.length,
    totalWords,
    totalChars,
    totalEmojis,
    firstTs,
    lastTs,
    durationDays,
    activeDays,
    silentDays,
    longestSilenceDays,
    peakDay,
    perPerson,
    heatmap,
    weekly,
    investmentDelta,
    initiationDrift: {
      firstHalfLeader,
      secondHalfLeader,
      firstHalfShare,
      secondHalfShare,
      swap: !!firstHalfLeader && !!secondHalfLeader && firstHalfLeader !== secondHalfLeader,
    },
  }
}

export function formatDuration(ms: number | null, locale: 'en' | 'de' = 'en'): string {
  if (ms == null) return '—'
  const de = locale === 'de'
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec} ${de ? (sec === 1 ? 'Sekunde' : 'Sekunden') : sec === 1 ? 'second' : 'seconds'}`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} ${de ? (min === 1 ? 'Minute' : 'Minuten') : min === 1 ? 'minute' : 'minutes'}`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} ${de ? (hr === 1 ? 'Stunde' : 'Stunden') : hr === 1 ? 'hour' : 'hours'}`
  const d = Math.round(hr / 24)
  return `${d} ${de ? (d === 1 ? 'Tag' : 'Tage') : d === 1 ? 'day' : 'days'}`
}
