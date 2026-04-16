import type { Message, ParsedChat } from '../parser/types'

// Intelligent sampling for AI analysis. Runs in the browser (Zone 1) — the
// server only ever sees the sampled subset, never the full chat.
//
// Strategy (from concept §11):
//   - First N messages (Kennenlernen-Phase, sets tone)
//   - Last N messages (current state)
//   - Messages at unusual hours (late night Goffman back-stage candidates)
//   - Long messages (emotional ladung)
//   - Messages around response-time kipppunkte
//   - Random middle filler to fill quota
//
// Target: ~500 messages or ~20k input tokens, whichever comes first.

export interface SampleResult {
  messages: Message[]
  totalAvailable: number
  approxTokens: number
  strategy: {
    start: number
    end: number
    longTail: number
    offHours: number
    kipppunkte: number
    random: number
  }
}

const TARGET_TOKENS = 20_000
const TOKEN_ESTIMATE_PER_CHAR = 0.28 // conservative upper bound for mixed German/English

function estimateTokens(msgs: Message[]): number {
  let chars = 0
  for (const m of msgs) chars += m.text.length + m.author.length + 10
  return Math.round(chars * TOKEN_ESTIMATE_PER_CHAR)
}

function isOffHours(d: Date): boolean {
  const h = d.getHours()
  return h < 6 || h >= 23
}

function findKipppunkte(messages: Message[], topN: number): Set<number> {
  // A kipppunkt is an index where the trailing-average response time jumps sharply.
  // Local heuristic only — AI does the real interpretation.
  if (messages.length < 50) return new Set()
  const windowSize = 20
  const avgAt: number[] = []
  for (let i = windowSize; i < messages.length; i++) {
    const gaps: number[] = []
    for (let j = i - windowSize; j < i; j++) {
      if (messages[j + 1].author !== messages[j].author) {
        gaps.push(+messages[j + 1].ts - +messages[j].ts)
      }
    }
    if (gaps.length === 0) continue
    avgAt.push(gaps.reduce((a, b) => a + b, 0) / gaps.length)
  }
  // Find biggest relative jumps
  const jumps: { idx: number; delta: number }[] = []
  for (let i = 1; i < avgAt.length; i++) {
    const prev = avgAt[i - 1] || 1
    const curr = avgAt[i]
    jumps.push({ idx: i + windowSize, delta: curr / prev })
  }
  jumps.sort((a, b) => b.delta - a.delta)
  return new Set(jumps.slice(0, topN).map((j) => j.idx))
}

export function sampleForAI(chat: ParsedChat): SampleResult {
  const { messages } = chat
  const N = messages.length
  const picked = new Set<number>()

  // 1. First 80 messages (setup)
  const startCount = Math.min(80, Math.floor(N * 0.15))
  for (let i = 0; i < startCount; i++) picked.add(i)

  // 2. Last 150 messages (recent state — highest signal for current dynamic)
  const endCount = Math.min(150, Math.floor(N * 0.25))
  for (let i = Math.max(0, N - endCount); i < N; i++) picked.add(i)

  // 3. Long messages (top 5% by length)
  const sortedByLen = messages
    .map((m, i) => ({ i, len: m.text.length }))
    .sort((a, b) => b.len - a.len)
  const longCount = Math.max(10, Math.floor(N * 0.05))
  for (let k = 0; k < Math.min(longCount, sortedByLen.length); k++) {
    picked.add(sortedByLen[k].i)
  }

  // 4. Off-hours messages (top 30 scattered throughout)
  const offHoursIdx = messages
    .map((m, i) => (isOffHours(m.ts) ? i : -1))
    .filter((i) => i >= 0)
  const offPick = Math.min(30, offHoursIdx.length)
  // Evenly distributed across time
  for (let k = 0; k < offPick; k++) {
    const pos = Math.floor((k / offPick) * offHoursIdx.length)
    picked.add(offHoursIdx[pos])
  }

  // 5. Kipppunkte — pull surrounding 3 messages on each side
  const kipp = findKipppunkte(messages, 5)
  for (const idx of kipp) {
    for (let d = -3; d <= 3; d++) {
      const j = idx + d
      if (j >= 0 && j < N) picked.add(j)
    }
  }

  // 6. Random middle filler until we hit token budget
  const midStart = startCount
  const midEnd = N - endCount
  const midIdx = []
  for (let i = midStart; i < midEnd; i++) if (!picked.has(i)) midIdx.push(i)
  // Shuffle deterministically (don't want true random in privacy-sensitive code)
  for (let i = midIdx.length - 1; i > 0; i--) {
    const j = (i * 2654435761) % (i + 1)
    ;[midIdx[i], midIdx[j]] = [midIdx[j], midIdx[i]]
  }
  const sortedIndices = () => [...picked].sort((a, b) => a - b).map((i) => messages[i])
  let r = 0
  while (r < midIdx.length && estimateTokens(sortedIndices()) < TARGET_TOKENS) {
    picked.add(midIdx[r])
    r++
  }

  // Final: sort by original order so the AI sees chronology
  const sortedPicked = [...picked].sort((a, b) => a - b)
  // If we blew past budget (can happen with many long messages), trim from middle
  const sampled: Message[] = sortedPicked.map((i) => messages[i])
  while (estimateTokens(sampled) > TARGET_TOKENS && sampled.length > 200) {
    // Drop every other message in the middle third
    const third = Math.floor(sampled.length / 3)
    for (let i = sampled.length - third - 1; i >= third; i -= 2) {
      sampled.splice(i, 1)
    }
  }

  return {
    messages: sampled,
    totalAvailable: N,
    approxTokens: estimateTokens(sampled),
    strategy: {
      start: startCount,
      end: endCount,
      longTail: longCount,
      offHours: offPick,
      kipppunkte: kipp.size * 7,
      random: r,
    },
  }
}
