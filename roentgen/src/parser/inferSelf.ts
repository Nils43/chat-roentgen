import type { ParsedChat } from './types'

// Three-pronged self-person detection for 2-person chats. Tried in order of
// confidence; first hit wins. Only for N=2 — group chats have no "self" in
// this sense and we analyse the user as a full participant there anyway.
//
// 1. Google profile full_name — if the user signed in with Google we know
//    their real name. Match it fuzzily against participants; whichever hits
//    is the self.
// 2. WhatsApp export filename — "WhatsApp Chat mit X.txt" names the OTHER
//    participant, so the remaining participant is the self.
// 3. Google email local-part — "nils.heck@..." token-matched against the
//    participants. Catches cases where full_name is missing/nickname.
//
// If all three fail, caller falls back to participants[0] — imperfect but
// matches the user's expectation that "it just works" without a picker.

const FILENAME_PATTERNS = [
  /WhatsApp[-\s_]*Chat\s+(?:mit|with)\s+(.+?)(?:\.txt|\.zip)?$/i,
  /WhatsApp[-\s_]*Chat\s*-\s*(.+?)(?:\.txt|\.zip)?$/i,
  /Chat\s+(?:mit|with)\s+(.+?)(?:\.txt|\.zip)?$/i,
]

function stripNoise(s: string): string {
  return s
    // iOS sometimes prefixes a left-to-right mark
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    // collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

function extractNameFromFilename(fileName: string): string | null {
  const base = fileName.replace(/^.*[/\\]/, '') // strip any path
  const cleaned = stripNoise(base)
  for (const re of FILENAME_PATTERNS) {
    const m = re.exec(cleaned)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

function firstToken(name: string): string {
  return name.split(/\s+/)[0]?.toLowerCase() ?? ''
}

export interface SelfHints {
  fileName: string | null
  fullName?: string | null // Google profile display name, if signed in
  email?: string | null
}

export function inferSelfPerson(hints: SelfHints, chat: ParsedChat): string | null {
  if (chat.participants.length !== 2) return null

  // 1. Google full_name match — highest confidence. "Nils Heck" vs
  //    participants ["Nils", "Antonia"]: substring match lands on "Nils".
  if (hints.fullName) {
    const hit = matchParticipant(hints.fullName, chat.participants)
    if (hit) return hit
  }

  // 2. Filename heuristic — "WhatsApp Chat mit X" where X is the OTHER.
  if (hints.fileName) {
    const extracted = extractNameFromFilename(hints.fileName)
    if (extracted) {
      const other = matchParticipant(extracted, chat.participants)
      if (other) {
        const self = chat.participants.find((p) => p !== other)
        if (self) return self
      }
    }
  }

  // 3. Email local-part tokens.
  if (hints.email) {
    const local = hints.email.split('@')[0] ?? ''
    const tokens = local.toLowerCase().split(/[._\-+]/).filter((t) => t.length >= 2)
    for (const token of tokens) {
      const hit = matchParticipant(token, chat.participants)
      if (hit) return hit
    }
  }

  return null
}

// Is `needle` a match for one of the participants? Case-insensitive; allows
// word-boundary substring in either direction so "Nils Heck" ↔ "Nils" both hit.
function matchParticipant(needle: string, participants: string[]): string | null {
  const nLower = needle.toLowerCase().trim()
  const nFirst = firstToken(nLower)
  for (const p of participants) {
    const pLower = p.toLowerCase()
    if (pLower === nLower) return p
    if (firstToken(p) === nFirst && nFirst.length >= 2) return p
    if (pLower.includes(nLower) || nLower.includes(pLower)) return p
  }
  return null
}
