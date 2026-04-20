import type { Message, ParsedChat } from './types'

// WhatsApp .txt export parser. Handles the two dominant formats:
//   DE: [DD.MM.YY, HH:MM:SS] Name: Text           (bracketed, 24h)
//       DD.MM.YY, HH:MM - Name: Text              (unbracketed, 24h, older)
//   EN: [M/D/YY, H:MM:SS AM] Name: Text           (bracketed, 12h)
//       M/D/YY, H:MM AM - Name: Text              (unbracketed, 12h)
//
// Continuation lines (no timestamp) belong to the previous message.
// System notices (encryption, group events, media placeholders) are dropped.

const SYSTEM_MARKERS = [
  // WhatsApp system notices
  'end-to-end verschlüsselt',
  'end-to-end encrypted',
  'messages and calls are end-to-end',
  'nachrichten und anrufe sind ende-zu-ende',
  'hat die gruppe',
  'joined using this group',
  'left the group',
  'changed the subject',
  'changed this group',
  'wurde hinzugefügt',
  'added',
  'removed',
  'changed their phone number',
  'hat die telefonnummer gewechselt',
]

const MEDIA_MARKERS = [
  '<medien ausgeschlossen>',
  '<media omitted>',
  'bild weggelassen',
  'image omitted',
  'sticker weggelassen',
  'sticker omitted',
  'video weggelassen',
  'video omitted',
  'gif weggelassen',
  'gif omitted',
  'audio weggelassen',
  'audio omitted',
  'dokument weggelassen',
  'document omitted',
  'kontakt weggelassen',
  'contact card omitted',
  'this message was deleted',
  'diese nachricht wurde gelöscht',
  'du hast diese nachricht gelöscht',
  'you deleted this message',
  'null',
]

// Matches a WhatsApp line header. Two capture groups: datetime + author.
// Uses U+202F (narrow no-break space) AND regular space between time and AM/PM,
// which some iOS exports use.
// Examples it matches:
//   [15.03.24, 21:04:12] Lena: Hey
//   15.03.24, 21:04 - Lena: Hey
//   [3/15/24, 9:04:12 PM] Lena: Hey
//   3/15/24, 9:04 PM - Lena: Hey
const LINE_RE =
  /^\u200e?\[?(\d{1,2}[./]\d{1,2}[./]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)(?:[\s\u202f]*([AP]M))?\]?\s*[-–—]?\s+([^:]{1,120}):\s?(.*)$/

function normalizeLine(line: string): string {
  // Strip left-to-right marks and other invisible chars WhatsApp likes to add.
  return line.replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g, '')
}

function parseDate(dateStr: string, timeStr: string, ampm: string | undefined): Date | null {
  // Date detection:
  //   DD.MM.YY / DD.MM.YYYY  → German
  //   DD/MM/YY or MM/DD/YY   → ambiguous. If first part > 12, it's day-first; else assume month-first (EN)
  //     — if we see AM/PM anywhere, lean EN (month-first); else lean DE (day-first)
  const parts = dateStr.split(/[./]/).map((s) => s.trim())
  if (parts.length !== 3) return null
  const a = parseInt(parts[0], 10)
  const b = parseInt(parts[1], 10)
  let y = parseInt(parts[2], 10)
  if (isNaN(a) || isNaN(b) || isNaN(y)) return null
  if (y < 100) y += 2000

  const hasDot = dateStr.includes('.')
  const isEn = !!ampm || (!hasDot && a <= 12 && b > 12)

  let day: number, month: number
  if (hasDot) {
    day = a
    month = b
  } else if (isEn) {
    month = a
    day = b
  } else {
    day = a
    month = b
  }

  const [hStr, mStr, sStr] = timeStr.split(':')
  let h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  const s = sStr ? parseInt(sStr, 10) : 0
  if (ampm) {
    const pm = ampm.toUpperCase() === 'PM'
    if (pm && h < 12) h += 12
    if (!pm && h === 12) h = 0
  }

  const d = new Date(y, month - 1, day, h, m, s)
  if (isNaN(d.getTime())) return null
  return d
}

function isSystemMessage(text: string): boolean {
  const lower = text.toLowerCase().trim()
  return SYSTEM_MARKERS.some((m) => lower.includes(m))
}

function isMediaOnly(text: string): boolean {
  const stripped = text
    .toLowerCase()
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    .trim()
  return MEDIA_MARKERS.some((m) => stripped === m || stripped.includes(m))
}

export function parseWhatsApp(raw: string): ParsedChat {
  const warnings: string[] = []
  const messages: Message[] = []
  const participantsSet = new Map<string, number>()

  const lines = raw.split(/\r?\n/)
  let current: Message | null = null
  let enLikely = 0
  let deLikely = 0

  const flush = () => {
    if (!current) return
    // Drop system & media-only messages
    if (isSystemMessage(current.text) || isMediaOnly(current.text)) {
      current = null
      return
    }
    const trimmed = current.text.trim()
    if (!trimmed) {
      current = null
      return
    }
    current.text = trimmed
    if (!participantsSet.has(current.author)) {
      participantsSet.set(current.author, participantsSet.size)
    }
    messages.push(current)
    current = null
  }

  for (const rawLine of lines) {
    const line = normalizeLine(rawLine)
    if (!line.trim()) continue

    const m = LINE_RE.exec(line)
    if (m) {
      const [, dateStr, timeStr, ampm, author, text] = m
      if (ampm) enLikely++
      if (dateStr.includes('.')) deLikely++
      const ts = parseDate(dateStr, timeStr, ampm)
      if (!ts) {
        // Couldn't parse timestamp — treat as continuation if possible, else drop
        if (current) current.text += '\n' + line
        continue
      }
      flush()
      // Skip group system notices where author slot contains certain markers
      if (isSystemMessage(`${author}: ${text}`)) continue
      current = { ts, author: author.trim(), text }
    } else {
      // Continuation line: append to current message (preserve newlines)
      if (current) {
        current.text += '\n' + line
      } else {
        // Orphan line before any parsable message — ignore
      }
    }
  }
  flush()

  const locale: ParsedChat['locale'] =
    enLikely > deLikely * 2 ? 'en' : deLikely > enLikely * 2 ? 'de' : enLikely + deLikely === 0 ? 'de' : 'mixed'

  if (messages.length === 0) {
    warnings.push(
      "No messages detected. Is this actually a WhatsApp export? Check the date format on the first line.",
    )
  }

  const participants = [...participantsSet.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([name]) => name)

  if (participants.length > 12) {
    warnings.push(`${participants.length} participants detected — group chats are only partially supported right now.`)
  }

  return {
    messages,
    participants,
    source: 'whatsapp',
    locale,
    warnings,
  }
}
