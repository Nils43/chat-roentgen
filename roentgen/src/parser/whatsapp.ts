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
  // E2E notices
  'end-to-end verschlüsselt',
  'end-to-end encrypted',
  'messages and calls are end-to-end',
  'nachrichten und anrufe sind ende-zu-ende',
  'are now secured with end-to-end encryption',
  // Group lifecycle
  'hat die gruppe',
  'gruppe erstellt',
  'diese gruppe erstellt',
  'created group',
  'created this group',
  'you created this group',
  'joined using this group',
  'joined using this invite',
  'ist der gruppe beigetreten',
  'left the group',
  'hat die gruppe verlassen',
  // Subject / description / icon
  'changed the subject',
  'changed this group',
  "changed this group's icon",
  'changed the group description',
  'gruppenbeschreibung',
  'gruppen-icon',
  'hat den gruppennamen',
  // Admin actions
  'wurde hinzugefügt',
  'hinzugefügt',
  'added',
  'wurde entfernt',
  'removed',
  'is now an admin',
  'ist jetzt admin',
  'no longer an admin',
  'nicht mehr admin',
  // Pins
  'pinned a message',
  'angeheftet',
  // Phone
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

// Looser check for post-parse scrubbing. Matches single-message "participants"
// that look like group-admin notices which slipped past SYSTEM_MARKERS — usually
// the group's own name appearing once as the author of a creation/rename line.
// Keep these specific enough that a real user's one-off message wouldn't match.
const SYSTEM_KEYWORDS_LOOSE = [
  'erstellt',
  'created group',
  'created this group',
  'hinzugefügt',
  'added you',
  'added me',
  'wurde entfernt',
  'beigetreten',
  'gruppenbeschreibung',
  'gruppen-icon',
  'gruppennamen',
  'group description',
  'group icon',
  'group name',
  'angeheftet',
  'pinned a message',
]

function looksLikeSystemNotice(text: string): boolean {
  const lower = text.toLowerCase()
  return SYSTEM_KEYWORDS_LOOSE.some((k) => lower.includes(k))
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

  // Post-parse scrub: if a "participant" has ≤2 messages and all of them look
  // like admin notices (created group, added X, changed description, …), drop
  // them. This cleans up cases where the group name itself was captured as an
  // author because WhatsApp formatted a system line with a colon.
  const authorMessageCounts = new Map<string, Message[]>()
  for (const msg of messages) {
    const list = authorMessageCounts.get(msg.author) ?? []
    list.push(msg)
    authorMessageCounts.set(msg.author, list)
  }
  const ghostAuthors = new Set<string>()
  for (const [author, msgs] of authorMessageCounts) {
    if (msgs.length <= 2 && msgs.every((m) => looksLikeSystemNotice(m.text))) {
      ghostAuthors.add(author)
    }
  }
  if (ghostAuthors.size > 0) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (ghostAuthors.has(messages[i].author)) messages.splice(i, 1)
    }
    for (const author of ghostAuthors) participantsSet.delete(author)
  }

  const participants = [...participantsSet.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([name]) => name)

  return {
    messages,
    participants,
    source: 'whatsapp',
    locale,
    warnings,
  }
}
