import type { Message, ParsedChat } from '../parser/types'

// Smart-Sessions sampler. Treats conversations (gaps < 4h) as the unit instead
// of individual messages — preserves dialogue structure for the AI. Picks the
// emotionally densest sessions, then balances by speaker so quiet voices aren't
// lost. Runs entirely in the browser (Zone 1).

export interface SampleResult {
  messages: Message[]
  totalAvailable: number
  approxTokens: number
  strategy: {
    sessionsTotal: number
    sessionsPicked: number
    forced: number
    signal: number
    balanced: number
    avgSessionScore: number
  }
}

const TARGET_TOKENS = 20_000
const TOKEN_ESTIMATE_PER_CHAR = 0.28
const SESSION_GAP_MS = 4 * 60 * 60 * 1000
const MIN_SPEAKER_WORD_SHARE = 0.25 // each participant should have ≥ this share

interface Session {
  index: number
  messages: Message[]
  startTs: Date
  endTs: Date
  wordCount: number
  emojiCount: number
  hedgeCount: number
  questionCount: number
  lateNightCount: number
  speakerWordCount: Record<string, number>
  bothActive: boolean
  score: number
  approxTokens: number
}

const HEDGE_RE = /\b(vielleicht|eigentlich|irgendwie|halt|fast|sozusagen|maybe|kinda|just|i\s+think|i\s+guess)\b/gi
// eslint-disable-next-line no-misleading-character-class
const EMOJI_RE = /(\p{Extended_Pictographic})(\uFE0F|\u200D\p{Extended_Pictographic})*/gu

function countWords(s: string): number {
  const t = s.trim()
  return t ? t.split(/\s+/).length : 0
}

function countMatches(s: string, re: RegExp): number {
  re.lastIndex = 0
  const m = s.match(re)
  return m ? m.length : 0
}

function estimateTokens(msgs: Message[]): number {
  let chars = 0
  for (const m of msgs) chars += m.text.length + m.author.length + 10
  return Math.round(chars * TOKEN_ESTIMATE_PER_CHAR)
}

function splitSessions(messages: Message[], participants: string[]): Session[] {
  const sessions: Session[] = []
  let current: Message[] = []
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (current.length === 0) {
      current.push(msg)
      continue
    }
    const gap = +msg.ts - +current[current.length - 1].ts
    if (gap > SESSION_GAP_MS) {
      sessions.push(buildSession(current, sessions.length, participants))
      current = [msg]
    } else {
      current.push(msg)
    }
  }
  if (current.length > 0) sessions.push(buildSession(current, sessions.length, participants))
  return sessions
}

function buildSession(msgs: Message[], index: number, participants: string[]): Session {
  const speakerWordCount: Record<string, number> = {}
  for (const p of participants) speakerWordCount[p] = 0
  let wordCount = 0
  let emojiCount = 0
  let hedgeCount = 0
  let questionCount = 0
  let lateNightCount = 0
  const seenSpeakers = new Set<string>()

  for (const m of msgs) {
    const w = countWords(m.text)
    wordCount += w
    speakerWordCount[m.author] = (speakerWordCount[m.author] ?? 0) + w
    seenSpeakers.add(m.author)
    emojiCount += countMatches(m.text, EMOJI_RE)
    hedgeCount += countMatches(m.text, HEDGE_RE)
    if (m.text.includes('?')) questionCount++
    const h = m.ts.getHours()
    if (h < 6 || h >= 23) lateNightCount++
  }

  const session: Session = {
    index,
    messages: msgs,
    startTs: msgs[0].ts,
    endTs: msgs[msgs.length - 1].ts,
    wordCount,
    emojiCount,
    hedgeCount,
    questionCount,
    lateNightCount,
    speakerWordCount,
    bothActive: seenSpeakers.size >= 2,
    score: 0,
    approxTokens: estimateTokens(msgs),
  }
  session.score = scoreSession(session)
  return session
}

function scoreSession(s: Session): number {
  // Composite signal score. Each factor is a multiplier on a base of log(words).
  // Logarithmic base keeps verbose-but-empty sessions from dominating.
  const base = Math.log(1 + s.wordCount)
  const msgs = s.messages.length
  const emojiDensity = msgs ? s.emojiCount / msgs : 0
  const hedgeDensity = msgs ? s.hedgeCount / msgs : 0
  const questionDensity = msgs ? s.questionCount / msgs : 0
  const lateNightFraction = msgs ? s.lateNightCount / msgs : 0

  const multiplier =
    1 +
    0.6 * Math.min(1, emojiDensity * 4) +
    0.5 * Math.min(1, hedgeDensity * 4) +
    0.4 * Math.min(1, questionDensity * 4) +
    0.7 * lateNightFraction +
    (s.bothActive ? 0.5 : 0)

  return base * multiplier
}

function wordShareInPicked(picked: Set<number>, sessions: Session[]): Record<string, number> {
  const totals: Record<string, number> = {}
  let sum = 0
  for (const i of picked) {
    for (const [author, w] of Object.entries(sessions[i].speakerWordCount)) {
      totals[author] = (totals[author] ?? 0) + w
      sum += w
    }
  }
  const share: Record<string, number> = {}
  if (sum === 0) return share
  for (const [a, w] of Object.entries(totals)) share[a] = w / sum
  return share
}

export function sampleForAI(chat: ParsedChat): SampleResult {
  const { messages, participants } = chat
  const N = messages.length

  // Tiny chats: just send everything.
  if (estimateTokens(messages) <= TARGET_TOKENS) {
    return {
      messages: [...messages],
      totalAvailable: N,
      approxTokens: estimateTokens(messages),
      strategy: {
        sessionsTotal: 0,
        sessionsPicked: 0,
        forced: 0,
        signal: 0,
        balanced: 0,
        avgSessionScore: 0,
      },
    }
  }

  const sessions = splitSessions(messages, participants)
  const sessionCount = sessions.length

  // Force-include first session and last two — preserve setup + current state.
  const forcedIdx = new Set<number>()
  if (sessionCount > 0) forcedIdx.add(0)
  if (sessionCount > 1) forcedIdx.add(sessionCount - 1)
  if (sessionCount > 2) forcedIdx.add(sessionCount - 2)

  const picked = new Set(forcedIdx)
  let usedTokens = [...picked].reduce((s, i) => s + sessions[i].approxTokens, 0)

  // Greedy by signal score until budget hit.
  const ranked = sessions
    .filter((s) => !picked.has(s.index))
    .sort((a, b) => b.score - a.score)

  let signalAdded = 0
  for (const s of ranked) {
    if (usedTokens + s.approxTokens > TARGET_TOKENS) continue
    picked.add(s.index)
    usedTokens += s.approxTokens
    signalAdded++
  }

  // Speaker balance: if a participant is under-represented, swap in their best sessions.
  let balancedAdded = 0
  for (const p of participants) {
    let share = wordShareInPicked(picked, sessions)
    let safety = 50
    while ((share[p] ?? 0) < MIN_SPEAKER_WORD_SHARE && safety-- > 0) {
      // Find the highest-score not-yet-picked session where p contributed the most words.
      const candidate = sessions
        .filter((s) => !picked.has(s.index) && (s.speakerWordCount[p] ?? 0) > 0)
        .sort((a, b) => {
          // prefer sessions where p's relative contribution is high
          const aShare = (a.speakerWordCount[p] ?? 0) / (a.wordCount || 1)
          const bShare = (b.speakerWordCount[p] ?? 0) / (b.wordCount || 1)
          if (Math.abs(aShare - bShare) > 0.05) return bShare - aShare
          return b.score - a.score
        })[0]
      if (!candidate) break
      // Make room if needed: drop the lowest-score picked session that isn't forced.
      while (usedTokens + candidate.approxTokens > TARGET_TOKENS) {
        const droppable = [...picked]
          .filter((i) => !forcedIdx.has(i))
          .sort((a, b) => sessions[a].score - sessions[b].score)[0]
        if (droppable === undefined) break
        usedTokens -= sessions[droppable].approxTokens
        picked.delete(droppable)
      }
      if (usedTokens + candidate.approxTokens > TARGET_TOKENS) break
      picked.add(candidate.index)
      usedTokens += candidate.approxTokens
      balancedAdded++
      share = wordShareInPicked(picked, sessions)
    }
  }

  // Final: collect messages chronologically.
  const sortedSessionIdx = [...picked].sort((a, b) => a - b)
  const sampled = sortedSessionIdx.flatMap((i) => sessions[i].messages)

  // Hard trim if still over budget (rare).
  while (estimateTokens(sampled) > TARGET_TOKENS && sampled.length > 200) {
    const third = Math.floor(sampled.length / 3)
    for (let i = sampled.length - third - 1; i >= third; i -= 2) {
      sampled.splice(i, 1)
    }
  }

  const avgScore =
    picked.size > 0
      ? [...picked].reduce((s, i) => s + sessions[i].score, 0) / picked.size
      : 0

  return {
    messages: sampled,
    totalAvailable: N,
    approxTokens: estimateTokens(sampled),
    strategy: {
      sessionsTotal: sessionCount,
      sessionsPicked: picked.size,
      forced: forcedIdx.size,
      signal: signalAdded,
      balanced: balancedAdded,
      avgSessionScore: Math.round(avgScore * 10) / 10,
    },
  }
}
