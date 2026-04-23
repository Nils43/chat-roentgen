import type { HardFacts, PerPersonStats } from '../analysis/hardFacts'
import type { ParsedChat, Message } from '../parser/types'
import { sampleForAI } from './sampling'
import { scrubPii } from './pseudonymize'

// Evidence Packet v2 — the slimmest surface the model needs to interpret well.
// Adds signature language + tone hints + flags; strips redundant counts and
// over-precise decimals. ~500 tokens instead of ~1200.

export interface EvidencePacket {
  participants: string[]
  self: string | null

  span: {
    firstDate: string // YYYY-MM-DD
    lastDate: string
    activeDays: number
    silentDays: number
    longestSilenceDays: number
    peakDay: { date: string; count: number }
  }

  // Per-person compact profile keyed by real name (pseudonymized later)
  people: Record<string, PersonEvidence>

  // One-line precomputed interpretation — model can echo or expand
  asymmetryNote: string

  asymmetry: {
    messageShareDelta: number // 0..1, abs gap
    replySpeedRatio: number | null // slower / faster, how unequal
    initiationLeader: string | null
    initiationLeaderShare: number // 0..1
    initiationDriftSwap: boolean
    firstHalfLeader: string | null
    secondHalfLeader: string | null
  }

  rhythm: {
    mostActiveHourLabel: string // "late evening (22-23)" rather than 22
    mostActiveWeekday: string // "Sunday"
    lateNightShare: number // 0..1 overall
    burstiest: string | null
    longestBurst: number
  }

  // 3-bucket shape of engagement over the whole period
  arc: { phase: 'start' | 'middle' | 'end'; messagesPerWeek: number }[]

  // Locally detected red-flag triggers (heuristic; the model makes the final call)
  flags: Flag[]

  // Curated moments with reason tag. Model cites by index.
  notableMoments: NotableMoment[]

  // Raw dialogue excerpts — sampled by `sampleForAI` to preserve dialogue flow.
  // Without these the model only sees statistics and can't read rhythm, tone, or
  // how the two voices actually talk to each other. Shape: compact {a, t, x}
  // tuples so the JSON stays small.
  conversation: ConversationLine[]
}

/**
 * Compact shape for raw dialogue in the evidence packet. We drop the seconds
 * from the timestamp and use short keys to keep the token footprint down.
 *   a = author   t = "YYYY-MM-DD HH:MM"   x = text
 */
export interface ConversationLine {
  a: string
  t: string
  x: string
}

export interface PersonEvidence {
  name: string
  messagesPct: number // 0..1, 2 decimals
  avgWords: number // 1 decimal
  medianReplyMinutes: number | null
  initiationShare: number // 0..1, 2 decimals
  questionsRatio: number // 0..1, 2 decimals
  hedgesRatio: number // 0..1, 2 decimals
  emojiPerMsg: number // 2 decimals
  topEmojis: string[] // up to 4
  lateNightShare: number // 0..1
  longestBurst: number
  signatureWords: string[] // up to 5 most-distinctive non-stopwords
  signatureOpeners: string[] // up to 3 recurring sentence starts
  toneHint: ToneHint
}

export type ToneHint =
  | 'questioning'
  | 'declarative'
  | 'hedging'
  | 'playful'
  | 'terse'
  | 'verbose'
  | 'mixed'

export type Flag =
  | 'one_sided_apologies'
  | 'night_only_contact'
  | 'silent_phases_grow'
  | 'burst_asymmetry'
  | 'one_sided_hedging'
  | 'none'

export type NotableReason =
  | 'burst_start'
  | 'late_night'
  | 'post_silence'
  | 'pre_silence'
  | 'apology'
  | 'hedge_cluster'
  | 'peak_day'
  | 'drift_window'
  | 'long_message'
  | 'affection'
  | 'laughter'
  | 'appreciation'
  | 'excitement'
  // Neutral everyday exchange. Without this the sampler is all peaks — only
  // friction or warmth — and the AI never sees the texture of the 70% of
  // messages that are just "wie war dein tag" / "soll ich bier mitbringen".
  | 'ordinary'

export interface NotableMoment {
  index: number
  ts: string // HH:MM
  date: string // YYYY-MM-DD
  author: string
  text: string // ≤140 chars except long_message (≤180)
  reason: NotableReason
}

const MAX_NOTABLE = 30
const TEXT_CAP = 140
const LONG_TEXT_CAP = 200

// Per-reason caps enforce diversity — no tunnel-vision on one type.
const REASON_CAPS: Record<NotableReason, number> = {
  apology: 3,
  hedge_cluster: 3,
  late_night: 3,
  burst_start: 4,
  post_silence: 2,
  pre_silence: 2,
  drift_window: 3,
  long_message: 3,
  peak_day: 2,
  affection: 4,
  laughter: 4,
  appreciation: 3,
  excitement: 3,
  ordinary: 14,
}

// Three-way valence split of the 30 sample slots. Roughly even so the AI
// sees the full texture of the chat, not just the peaks. Each category
// gets its share of slots reserved before the others can compete.
const CATEGORY_TARGETS = { ordinary: 12, warmth: 9, friction: 9 } as const
const FRICTION_REASONS = new Set<NotableReason>([
  'apology', 'hedge_cluster', 'late_night', 'post_silence', 'pre_silence', 'drift_window',
])
const WARMTH_REASONS = new Set<NotableReason>([
  'affection', 'laughter', 'appreciation', 'excitement',
])
// Anti-clustering: don't pick two moments within this gap — avoids the sample
// being three consecutive messages of the same exchange.
const MIN_PICK_GAP_MS = 10 * 60 * 1000
// Temporal stratification — divide the chat into segments, try to cover each.
const TIME_SEGMENTS = 5

function categoryOf(r: NotableReason): 'warmth' | 'friction' | 'ordinary' | 'neutral' {
  if (WARMTH_REASONS.has(r)) return 'warmth'
  if (FRICTION_REASONS.has(r)) return 'friction'
  if (r === 'ordinary') return 'ordinary'
  return 'neutral'
}

const LONG_SILENCE_MS = 24 * 60 * 60 * 1000
const BURST_GAP_MS = 5 * 60 * 1000

const APOLOGY_RE =
  /\b(sorry|sry|entschuldigung|es tut mir leid|verzeih|my bad|my fault)\b/i

const HEDGES_ANY_RE =
  /\b(vielleicht|eigentlich|irgendwie|halt|fast|sozusagen|maybe|kinda|just|i\s+think|i\s+guess|glaub(?:e)?|evtl\.?)\b/gi

// Positive signal regexes — tuned for both DE and EN, loose enough to catch
// the common casual forms but tight enough to avoid false positives on, say,
// "thanks anyway" following a fight.
const AFFECTION_RE =
  /\b(love\s*(?:you|u|ya)|i\s+love\s+you|ily|liebe\s+dich|hab\s+dich\s+lieb|hdl|miss\s+(?:you|u|ya)|vermiss(?:e)?\s+dich|du\s+fehlst|ich\s+mag\s+dich|thinking\s+of\s+(?:you|u)|denke\s+an\s+dich)\b|❤️|🥰|😘|💕|💖|💗|💘|💝|💞/i

const LAUGHTER_RE =
  /\b(hahah+a*|lmao|rofl|lol+|lolol+|xd)\b|😂{1,}|🤣{1,}|😆|😹/i

const APPRECIATION_RE =
  /\b(thanks?(?:\s+(?:a\s+lot|so\s+much))?|thx|ty|thank\s+you|thanks?\s*a\s*lot|danke(?:\s+dir|\s+schön|\s+sehr)?|du\s+bist\s+(?:toll|die\s+beste|der\s+beste|süß|ein\s+schatz)|you(?:'re|\s+are)\s+(?:the\s+best|amazing|awesome|incredible))\b/i

const EXCITEMENT_RE =
  /!{2,}|\b(yess+|yay+|omg|omfg|wohoo+|juhuu+|geil(?:er|es|e)?|super\s+geil|nice{2,}|amazing|awesome|can't\s+wait|kann's?\s+kaum\s+erwarten|freue?\s+mich\s+(?:sehr|richtig|so))\b|🎉|🥳|🤩|💃|🕺/i

// Stopwords for signature-word extraction (rough DE + EN)
const STOPWORDS = new Set<string>([
  // DE
  'der', 'die', 'das', 'und', 'oder', 'aber', 'ist', 'war', 'bin', 'sind', 'waren',
  'ein', 'eine', 'einen', 'einem', 'einer', 'nicht', 'nein', 'ja', 'doch', 'mal',
  'so', 'noch', 'nur', 'auch', 'mir', 'mich', 'dich', 'dir', 'er', 'sie', 'es',
  'wir', 'ihr', 'ihn', 'uns', 'euch', 'du', 'ich', 'man', 'sich', 'mein', 'dein',
  'mit', 'von', 'zu', 'in', 'an', 'auf', 'aus', 'bei', 'nach', 'vor', 'für',
  'was', 'wie', 'wo', 'wann', 'wer', 'warum', 'dass', 'denn', 'wenn', 'weil',
  'also', 'ok', 'okay', 'hm', 'äh', 'haha', 'hahaha', 'hi', 'hey', 'hallo', 'tschüss',
  'schon', 'ganz', 'gut', 'weiß', 'weil', 'vom', 'zum', 'zur', 'ne', 'nem',
  'hab', 'habe', 'hast', 'hat', 'haben', 'hätte', 'würde', 'werde', 'will', 'soll',
  'kann', 'könnte', 'muss', 'machen', 'macht', 'gemacht', 'tun', 'tust', 'tue',
  'denn', 'dann', 'heute', 'gestern', 'morgen',
  // EN
  'the', 'and', 'or', 'but', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
  'a', 'an', 'that', 'this', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
  'we', 'they', 'me', 'him', 'her', 'them', 'my', 'your', 'his', 'its', 'our',
  'of', 'to', 'in', 'on', 'at', 'for', 'with', 'by', 'from', 'about',
  'not', 'no', 'yes', 'so', 'too', 'also', 'just', 'only', 'still', 'ok', 'okay',
  'lol', 'haha', 'hi', 'hey', 'hello', 'bye',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could',
  'can', 'may', 'might', 'must', 'gonna', 'wanna', 'got', 'get', 'gets',
  'like', 'all', 'any', 'some', 'if', 'then', 'now', 'today', 'yesterday', 'tomorrow',
])

export function buildEvidence(
  facts: HardFacts,
  chat: ParsedChat,
  selfPerson: string | null,
): EvidencePacket {
  const [pA, pB] = facts.perPerson
  const asymmetry = computeAsymmetry(facts, pA, pB)
  const rhythm = computeRhythm(facts, pA, pB)
  const arc = computeArc(facts)
  const notableMoments = pickNotableMoments(chat.messages, facts)

  const people: Record<string, PersonEvidence> = {}
  const messagesByAuthor = groupByAuthor(chat.messages)
  for (const p of facts.perPerson) {
    const ownMsgs = messagesByAuthor[p.author] ?? []
    people[p.author] = compressPerson(p, ownMsgs)
  }

  const flags = detectFlags(facts, people, notableMoments)
  const asymmetryNote = buildAsymmetryNote(pA, pB, asymmetry, rhythm)

  // Raw dialogue so the model can read tone, rhythm, escalation, repair, flow —
  // stuff that statistics alone can't capture. `sampleForAI` targets ~20k
  // tokens and preserves whole conversations (gaps < 4h) ranked by signal.
  const sample = sampleForAI(chat)
  const conversation: ConversationLine[] = sample.messages.map((m) => ({
    a: m.author,
    t: compactTs(m.ts),
    // Strip obvious PII (phones, emails, raw URLs) before the text leaves the
    // browser. Names are pseudonymized later by `pseudonymizeDeep`.
    x: scrubPii(m.text),
  }))

  return {
    participants: chat.participants,
    self: selfPerson,
    span: {
      firstDate: isoDate(facts.firstTs),
      lastDate: isoDate(facts.lastTs),
      activeDays: facts.activeDays,
      silentDays: facts.silentDays,
      longestSilenceDays: facts.longestSilenceDays,
      peakDay: facts.peakDay,
    },
    people,
    asymmetryNote,
    asymmetry,
    rhythm,
    arc,
    flags,
    notableMoments,
    conversation,
  }
}

function compactTs(ts: Date): string {
  // YYYY-MM-DD HH:MM — dropping seconds, plenty precise for a chat readout.
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())} ${pad(ts.getHours())}:${pad(ts.getMinutes())}`
}

function groupByAuthor(messages: Message[]): Record<string, Message[]> {
  const out: Record<string, Message[]> = {}
  for (const m of messages) {
    if (!out[m.author]) out[m.author] = []
    out[m.author].push(m)
  }
  return out
}

function compressPerson(p: PerPersonStats, ownMsgs: Message[]): PersonEvidence {
  return {
    name: p.author,
    messagesPct: round(p.sharePct / 100, 2),
    avgWords: round(p.avgWords, 1),
    medianReplyMinutes: p.medianReplyMs == null ? null : round(p.medianReplyMs / 60000, 1),
    initiationShare: round(p.initiationShare, 2),
    questionsRatio: round(p.questionRatio, 2),
    hedgesRatio: round(p.hedgeRatio, 2),
    emojiPerMsg: round(p.emojiPerMsg, 2),
    topEmojis: p.topEmojis.slice(0, 4).map((e) => e.emoji),
    lateNightShare: round(p.lateNightRatio, 2),
    longestBurst: p.longestBurst,
    signatureWords: computeSignatureWords(ownMsgs),
    signatureOpeners: computeSignatureOpeners(ownMsgs),
    toneHint: computeToneHint(p),
  }
}

function computeToneHint(p: PerPersonStats): ToneHint {
  const hints: ToneHint[] = []
  if (p.questionRatio >= 0.35) hints.push('questioning')
  if (p.hedgeRatio >= 0.2) hints.push('hedging')
  if (p.emojiPerMsg >= 0.6) hints.push('playful')
  if (p.avgWords >= 20) hints.push('verbose')
  if (p.avgWords < 6) hints.push('terse')
  if (hints.length === 0) return 'declarative'
  if (hints.length === 1) return hints[0]
  return 'mixed'
}

function computeSignatureWords(msgs: Message[]): string[] {
  if (msgs.length === 0) return []
  const freq = new Map<string, number>()
  for (const m of msgs) {
    const words = m.text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{L}\s'-]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1)
  }
  return [...freq.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w)
}

function computeSignatureOpeners(msgs: Message[]): string[] {
  if (msgs.length === 0) return []
  const freq = new Map<string, number>()
  for (const m of msgs) {
    const trimmed = m.text.trim().toLowerCase()
    if (trimmed.length < 4) continue
    const first2 = trimmed.split(/\s+/).slice(0, 2).join(' ')
    if (first2.length < 4) continue
    // skip openers that are just stopwords
    const parts = first2.split(' ')
    if (parts.every((p) => STOPWORDS.has(p))) continue
    freq.set(first2, (freq.get(first2) ?? 0) + 1)
  }
  return [...freq.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([s]) => s)
}

function computeAsymmetry(
  facts: HardFacts,
  pA: PerPersonStats | undefined,
  pB: PerPersonStats | undefined,
): EvidencePacket['asymmetry'] {
  const messageShareDelta = pA && pB ? round(Math.abs(pA.sharePct - pB.sharePct) / 100, 2) : 0
  let replySpeedRatio: number | null = null
  if (pA?.medianReplyMs != null && pB?.medianReplyMs != null) {
    const slower = Math.max(pA.medianReplyMs, pB.medianReplyMs)
    const faster = Math.max(1, Math.min(pA.medianReplyMs, pB.medianReplyMs))
    replySpeedRatio = round(slower / faster, 1)
  }
  const initiationLeader =
    pA && pB ? (pA.initiationShare >= pB.initiationShare ? pA.author : pB.author) : null
  const initiationLeaderShare = pA && pB ? round(Math.max(pA.initiationShare, pB.initiationShare), 2) : 0

  return {
    messageShareDelta,
    replySpeedRatio,
    initiationLeader,
    initiationLeaderShare,
    initiationDriftSwap: facts.initiationDrift.swap,
    firstHalfLeader: facts.initiationDrift.firstHalfLeader,
    secondHalfLeader: facts.initiationDrift.secondHalfLeader,
  }
}

function computeRhythm(
  facts: HardFacts,
  pA: PerPersonStats | undefined,
  pB: PerPersonStats | undefined,
): EvidencePacket['rhythm'] {
  let bestHour = 0
  let bestDay = 0
  let bestCount = -1
  for (let d = 0; d < facts.heatmap.length; d++) {
    for (let h = 0; h < facts.heatmap[d].length; h++) {
      const c = facts.heatmap[d][h]
      if (c > bestCount) {
        bestCount = c
        bestHour = h
        bestDay = d
      }
    }
  }
  const totalLateNight = (pA?.lateNightCount ?? 0) + (pB?.lateNightCount ?? 0)
  const lateNightShare = facts.totalMessages ? round(totalLateNight / facts.totalMessages, 2) : 0
  const burstiest =
    pA && pB ? (pA.longestBurst >= pB.longestBurst ? pA.author : pB.author) : null
  const longestBurst = pA && pB ? Math.max(pA.longestBurst, pB.longestBurst) : 0

  return {
    mostActiveHourLabel: hourLabel(bestHour),
    mostActiveWeekday: weekdayName(bestDay),
    lateNightShare,
    burstiest,
    longestBurst,
  }
}

function hourLabel(h: number): string {
  if (h >= 5 && h < 9) return `early morning (${pad(h)}h)`
  if (h >= 9 && h < 12) return `morning (${pad(h)}h)`
  if (h >= 12 && h < 14) return `midday (${pad(h)}h)`
  if (h >= 14 && h < 18) return `afternoon (${pad(h)}h)`
  if (h >= 18 && h < 22) return `evening (${pad(h)}h)`
  if (h >= 22) return `late evening (${pad(h)}h)`
  return `deep night (${pad(h)}h)`
}

function weekdayName(d: number): string {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d] ?? 'unknown'
}

function computeArc(facts: HardFacts): EvidencePacket['arc'] {
  const weekly = facts.weekly
  if (weekly.length === 0) return []
  const size = Math.max(1, Math.ceil(weekly.length / 3))
  const chunks: typeof weekly[] = [
    weekly.slice(0, size),
    weekly.slice(size, size * 2),
    weekly.slice(size * 2),
  ]
  const phases: ('start' | 'middle' | 'end')[] = ['start', 'middle', 'end']
  return chunks
    .map((c, i) => {
      if (c.length === 0) return null
      const total = c.reduce((s, w) => s + w.count, 0)
      return { phase: phases[i], messagesPerWeek: Math.round(total / c.length) }
    })
    .filter((x): x is { phase: 'start' | 'middle' | 'end'; messagesPerWeek: number } => x !== null)
}

function detectFlags(
  facts: HardFacts,
  people: Record<string, PersonEvidence>,
  moments: NotableMoment[],
): Flag[] {
  const flags: Flag[] = []
  const list = Object.values(people)

  // one-sided apologies
  const apologies = moments.filter((m) => m.reason === 'apology')
  if (apologies.length >= 3) {
    const by = new Map<string, number>()
    for (const a of apologies) by.set(a.author, (by.get(a.author) ?? 0) + 1)
    const values = [...by.values()]
    if (values.length > 0 && Math.max(...values) >= apologies.length * 0.8) {
      flags.push('one_sided_apologies')
    }
  }

  // night-only contact — more than 40% of all messages in late night
  if (list.some((p) => p.lateNightShare >= 0.4)) flags.push('night_only_contact')

  // silent phases grow — longest silence over multiple days
  if (facts.longestSilenceDays >= 7) flags.push('silent_phases_grow')

  // burst asymmetry — one person bursts 3x more
  if (list.length === 2) {
    const [a, b] = list
    const maxB = Math.max(1, b.longestBurst)
    const maxA = Math.max(1, a.longestBurst)
    if (a.longestBurst / maxB >= 3 || b.longestBurst / maxA >= 3) {
      flags.push('burst_asymmetry')
    }
  }

  // one-sided hedging
  if (list.length === 2) {
    const [a, b] = list
    if (a.hedgesRatio >= 0.25 && b.hedgesRatio <= 0.08) flags.push('one_sided_hedging')
    if (b.hedgesRatio >= 0.25 && a.hedgesRatio <= 0.08) flags.push('one_sided_hedging')
  }

  return flags.length > 0 ? flags : ['none']
}

function buildAsymmetryNote(
  pA: PerPersonStats | undefined,
  pB: PerPersonStats | undefined,
  asymmetry: EvidencePacket['asymmetry'],
  rhythm: EvidencePacket['rhythm'],
): string {
  if (!pA || !pB) return ''
  const parts: string[] = []
  const leader = pA.sharePct >= pB.sharePct ? pA : pB
  parts.push(`${leader.author} sends ${Math.round(leader.sharePct)}%.`)
  if (asymmetry.replySpeedRatio && asymmetry.replySpeedRatio >= 2) {
    const faster = pA.medianReplyMs != null && pB.medianReplyMs != null
      ? (pA.medianReplyMs < pB.medianReplyMs ? pA.author : pB.author)
      : null
    if (faster) parts.push(`${faster} replies ${asymmetry.replySpeedRatio}× faster.`)
  }
  if (asymmetry.initiationLeader && asymmetry.initiationLeaderShare >= 0.7) {
    parts.push(`${asymmetry.initiationLeader} initiates ${Math.round(asymmetry.initiationLeaderShare * 100)}% of gaps.`)
  }
  if (asymmetry.initiationDriftSwap) {
    parts.push(`Initiative flipped between halves.`)
  }
  if (rhythm.lateNightShare >= 0.3) {
    parts.push(`${Math.round(rhythm.lateNightShare * 100)}% of traffic after 23h.`)
  }
  return parts.join(' ')
}

function pickNotableMoments(messages: Message[], facts: HardFacts): NotableMoment[] {
  if (messages.length === 0) return []

  // Score each message with a reason + priority. Later de-dupe to caps.
  type Candidate = { idx: number; reason: NotableReason; score: number }
  const candidates: Candidate[] = []
  const add = (idx: number, reason: NotableReason, score: number) =>
    candidates.push({ idx, reason, score })

  const peakDate = facts.peakDay.date
  const driftTs = computeDriftWindowTs(facts)

  // Burst starts
  let runStart = 0
  for (let i = 1; i <= messages.length; i++) {
    const prev = messages[i - 1]
    const curr = i < messages.length ? messages[i] : null
    const sameAuthor = curr && curr.author === prev.author
    const shortGap = curr && +curr.ts - +prev.ts <= BURST_GAP_MS
    if (!sameAuthor || !shortGap) {
      const runLen = i - runStart
      if (runLen >= 3) add(runStart, 'burst_start', 60 + runLen)
      runStart = i
    }
  }

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    const h = m.ts.getHours()
    const text = m.text

    if (h >= 23 || h < 5) add(i, 'late_night', 55 + (h < 5 ? 5 - h : h - 22))
    if (APOLOGY_RE.test(text)) add(i, 'apology', 70)
    const hedgeMatches = countMatches(text, HEDGES_ANY_RE)
    if (hedgeMatches >= 2) add(i, 'hedge_cluster', 50 + hedgeMatches * 4)
    if (isoDate(m.ts) === peakDate) add(i, 'peak_day', 45)
    if (text.length > 180) add(i, 'long_message', 40 + Math.min(20, text.length / 40))
    if (AFFECTION_RE.test(text)) add(i, 'affection', 72)
    if (LAUGHTER_RE.test(text)) add(i, 'laughter', 60)
    if (APPRECIATION_RE.test(text)) add(i, 'appreciation', 58)
    if (EXCITEMENT_RE.test(text)) add(i, 'excitement', 55)

    if (i > 0) {
      const gap = +m.ts - +messages[i - 1].ts
      if (gap >= LONG_SILENCE_MS) {
        add(i, 'post_silence', 65 + Math.min(10, gap / (LONG_SILENCE_MS * 4)))
        add(i - 1, 'pre_silence', 58 + Math.min(10, gap / (LONG_SILENCE_MS * 4)))
      }
    }
    if (driftTs && Math.abs(+m.ts - +driftTs) <= 3 * 24 * 60 * 60 * 1000) {
      add(i, 'drift_window', 48)
    }
  }

  // Ordinary pass — everyday texture. Must have no other score, moderate
  // length, be part of an actual back-and-forth. That's the mundane middle
  // the AI was previously blind to.
  const alreadyScored = new Set(candidates.map((c) => c.idx))
  for (let i = 0; i < messages.length; i++) {
    if (alreadyScored.has(i)) continue
    const m = messages[i]
    const len = m.text.length
    if (len < 15 || len > 120) continue
    const prev = i > 0 ? messages[i - 1] : null
    const next = i < messages.length - 1 ? messages[i + 1] : null
    const inExchange = (prev && prev.author !== m.author) || (next && next.author !== m.author)
    if (!inExchange) continue
    add(i, 'ordinary', 30 + Math.min(15, len / 10))
  }

  // Three-axis balanced picker:
  //   axis 1 — VALENCE: friction ÷ warmth ÷ ordinary each get a reserved
  //            share of the 30 slots so the AI sees every colour of the chat
  //   axis 2 — TIME: within each valence, we stratify across 5 equal-time
  //            segments so one bad week can't monopolise the sample
  //   axis 3 — AUTHOR: 60% cap per person so the louder talker doesn't
  //            dominate just because they wrote more
  // Plus anti-cluster: minimum 10-minute gap between picks to avoid the
  // sample being three adjacent messages of the same exchange.
  const firstMs = +messages[0].ts
  const lastMs = +messages[messages.length - 1].ts
  const segmentOf = (tsMs: number): number => {
    if (lastMs <= firstMs) return 0
    const rel = (tsMs - firstMs) / (lastMs - firstMs)
    return Math.min(TIME_SEGMENTS - 1, Math.max(0, Math.floor(rel * TIME_SEGMENTS)))
  }

  candidates.sort((a, b) => b.score - a.score)
  const picked = new Map<number, NotableReason>()
  const capCount: Record<NotableReason, number> = {
    apology: 0, hedge_cluster: 0, late_night: 0, burst_start: 0,
    post_silence: 0, pre_silence: 0, drift_window: 0, long_message: 0, peak_day: 0,
    affection: 0, laughter: 0, appreciation: 0, excitement: 0, ordinary: 0,
  }
  const authorCount = new Map<string, number>()
  const segCount = new Array<number>(TIME_SEGMENTS).fill(0)
  const AUTHOR_CAP = Math.ceil(MAX_NOTABLE * 0.6)

  const tryPick = (c: { idx: number; reason: NotableReason }) => {
    if (picked.has(c.idx)) return false
    if (capCount[c.reason] >= REASON_CAPS[c.reason]) return false
    const msg = messages[c.idx]
    if ((authorCount.get(msg.author) ?? 0) >= AUTHOR_CAP) return false
    if (picked.size >= MAX_NOTABLE) return false
    // Anti-cluster: reject if within MIN_PICK_GAP_MS of any already-picked.
    for (const pickedIdx of picked.keys()) {
      if (Math.abs(+messages[pickedIdx].ts - +msg.ts) < MIN_PICK_GAP_MS) return false
    }
    picked.set(c.idx, c.reason)
    capCount[c.reason]++
    authorCount.set(msg.author, (authorCount.get(msg.author) ?? 0) + 1)
    segCount[segmentOf(+msg.ts)]++
    return true
  }

  const fillCategory = (category: 'friction' | 'warmth' | 'ordinary', target: number) => {
    const pool = candidates.filter((c) => categoryOf(c.reason) === category)
    // Pass A — stratify: rotate through time segments, picking best-scored
    // available candidate in each before moving on. Stops early if target hit.
    const perSeg = Math.ceil(target / TIME_SEGMENTS)
    const bySeg: typeof pool[] = Array.from({ length: TIME_SEGMENTS }, () => [])
    for (const c of pool) bySeg[segmentOf(+messages[c.idx].ts)].push(c)
    for (let seg = 0; seg < TIME_SEGMENTS; seg++) bySeg[seg].sort((a, b) => b.score - a.score)
    let filled = Array.from(picked.values()).filter((r) => categoryOf(r) === category).length
    for (let round = 0; round < perSeg && filled < target; round++) {
      for (let seg = 0; seg < TIME_SEGMENTS && filled < target; seg++) {
        const c = bySeg[seg][round]
        if (c && tryPick(c)) filled++
      }
    }
    // Pass B — if stratification couldn't hit target (e.g. no candidates in
    // some segments), fall through to pure score order within the category.
    for (const c of pool) {
      if (filled >= target) break
      if (tryPick(c)) filled++
    }
  }

  fillCategory('ordinary', CATEGORY_TARGETS.ordinary)
  fillCategory('warmth', CATEGORY_TARGETS.warmth)
  fillCategory('friction', CATEGORY_TARGETS.friction)

  // Any remaining slot goes to whoever scored highest, regardless of category.
  // This pulls in neutral reasons (burst_start, peak_day, long_message) plus
  // any overflow from under-filled categories.
  for (const c of candidates) {
    if (picked.size >= MAX_NOTABLE) break
    tryPick(c)
  }

  // Sort chronologically for readable model input
  const sorted = [...picked.entries()].sort((a, b) => a[0] - b[0])

  return sorted.map(([idx, reason]) => {
    const m = messages[idx]
    const cap = reason === 'long_message' ? LONG_TEXT_CAP : TEXT_CAP
    return {
      index: idx,
      ts: `${pad(m.ts.getHours())}:${pad(m.ts.getMinutes())}`,
      date: isoDate(m.ts),
      author: m.author,
      text: truncate(scrubPii(m.text), cap),
      reason,
    }
  })
}

function computeDriftWindowTs(facts: HardFacts): Date | null {
  if (!facts.initiationDrift.firstHalfLeader || !facts.initiationDrift.secondHalfLeader) return null
  return new Date((+facts.firstTs + +facts.lastTs) / 2)
}

function countMatches(s: string, re: RegExp): number {
  re.lastIndex = 0
  const m = s.match(re)
  return m ? m.length : 0
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function round(n: number, digits: number): number {
  const m = Math.pow(10, digits)
  return Math.round(n * m) / m
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + '…'
}
