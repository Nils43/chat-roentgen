import type { ParsedChat } from './types'

// Heuristic: WhatsApp exports an N-person chat with a filename that points at
// the *other* participant (e.g. `WhatsApp Chat mit Lena.txt`, `WhatsApp Chat -
// Lena Müller.txt`, `WhatsApp Chat with Lena.txt`). The user doing the export
// is therefore the participant whose name does NOT appear in the filename.
//
// Returns the name of the self-person if we can infer it with reasonable
// confidence — otherwise null (caller falls back to the manual self-pick
// screen). Only runs for two-person chats; group exports name the group, not
// a person, so the filename tells us nothing useful.

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

export function inferSelfPerson(
  fileName: string | null,
  chat: ParsedChat,
): string | null {
  if (!fileName) return null
  if (chat.participants.length !== 2) return null
  const extracted = extractNameFromFilename(fileName)
  if (!extracted) return null

  const extractedFirst = firstToken(extracted)
  const extractedLower = extracted.toLowerCase()

  // Match extracted name against each participant. A participant counts as
  // "the other" when either the first-name tokens match or one name contains
  // the other (handles "Lena Müller" vs "Lena").
  const other = chat.participants.find((p) => {
    const pLower = p.toLowerCase()
    if (pLower === extractedLower) return true
    if (firstToken(p) === extractedFirst && extractedFirst.length >= 2) return true
    if (pLower.includes(extractedLower) || extractedLower.includes(pLower)) return true
    return false
  })
  if (!other) return null

  // The self-person is the participant that ISN'T the match. If both somehow
  // match (shouldn't with length === 2 and a unique name), bail out.
  const self = chat.participants.find((p) => p !== other)
  return self ?? null
}
