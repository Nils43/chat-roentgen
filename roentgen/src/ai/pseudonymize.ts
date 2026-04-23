import type { Message } from '../parser/types'

// Pseudonymization: real names → "Person A", "Person B", … before AI call.
// After response, we reverse the mapping client-side so the UI shows real names.
//
// We also scrub obvious PII from text bodies: phone numbers, email addresses,
// raw URLs. The AI doesn't need them for psychological interpretation.

export interface PseudonymMap {
  // real → pseudonym
  forward: Record<string, string>
  // pseudonym → real
  reverse: Record<string, string>
  participants: { real: string; pseudonym: string }[]
}

const LABELS = ['Person A', 'Person B', 'Person C', 'Person D', 'Person E', 'Person F']

export function buildPseudonymMap(participants: string[]): PseudonymMap {
  const forward: Record<string, string> = {}
  const reverse: Record<string, string> = {}
  const list: { real: string; pseudonym: string }[] = []
  participants.forEach((real, i) => {
    const pseudo = LABELS[i] ?? `Person ${String.fromCharCode(65 + i)}`
    forward[real] = pseudo
    reverse[pseudo] = real
    list.push({ real, pseudonym: pseudo })
  })
  return { forward, reverse, participants: list }
}

// Scrubbers — applied per message body
const PHONE_RE = /(\+?\d{1,3}[\s.-]?)?(\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,5}/g
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g
const URL_RE = /https?:\/\/\S+/g

// Scrub name tokens that appear *inside* message text, based on the
// participant list. Previously only scrubbed first names — surnames leaked
// through and the model would paste them back onto the pseudonym
// ("Person A Müller"), which after restoration became a doubled surname
// ("Max Müller Müller"). Now we also strip surnames / middle tokens.
function scrubNamesInText(text: string, map: PseudonymMap): string {
  return applyNameScrub(text, map.participants.map((p) => ({ real: p.real, replacement: p.pseudonym })))
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Shared helper for both pseudonymize (real → pseudonym) and scrub passes.
// Two passes:
//  1) full-name verbatim ("Max Müller" → "Person A").
//  2) individual tokens (≥ 2 chars), but only if unique to one participant —
//     otherwise a shared surname would be ambiguously rewritten.
function applyNameScrub(text: string, pairs: { real: string; replacement: string }[]): string {
  let out = text
  // Pass 1 — whole real name first, so the regex doesn't eat tokens we'd
  // match again in pass 2.
  for (const { real, replacement } of pairs) {
    if (real.length < 2) continue
    if (!/\s/.test(real)) continue // single-token real names handled in pass 2
    const fullRe = new RegExp(`(?<!\\w)${escapeRe(real)}(?!\\w)`, 'gi')
    out = out.replace(fullRe, replacement)
  }
  // Pass 2 — individual tokens, disambiguated.
  const tokenOwner = new Map<string, string>()
  for (const { real, replacement } of pairs) {
    for (const token of real.split(/\s+/)) {
      if (token.length < 2) continue
      const key = token.toLowerCase()
      if (tokenOwner.has(key) && tokenOwner.get(key) !== replacement) {
        tokenOwner.set(key, '__AMBIGUOUS__')
      } else {
        tokenOwner.set(key, replacement)
      }
    }
  }
  for (const [tokenLC, replacement] of tokenOwner) {
    if (replacement === '__AMBIGUOUS__') continue
    const re = new RegExp(`(?<!\\w)${escapeRe(tokenLC)}(?!\\w)`, 'gi')
    out = out.replace(re, replacement)
  }
  return out
}

export function pseudonymizeMessages(messages: Message[], map: PseudonymMap): Message[] {
  return messages.map((m) => ({
    ts: m.ts,
    author: map.forward[m.author] ?? m.author,
    text: scrubPii(scrubNamesInText(m.text, map)),
  }))
}

// Strip obvious PII (phone numbers, emails, raw URLs) from any string before
// it leaves the device. Used anywhere raw user text goes to the AI — not just
// the Message[] path. Kept as its own export because the evidence packet's
// `conversation` field needs the same treatment.
export function scrubPii(text: string): string {
  return text
    .replace(EMAIL_RE, '[email]')
    .replace(URL_RE, '[link]')
    .replace(PHONE_RE, (match) => (match.replace(/\D/g, '').length >= 7 ? '[phone]' : match))
}

// Forward-pseudonymize free text — real name → pseudonym. Used on the evidence
// packet before serialization so no real names leak to the API.
export function pseudonymizeText(text: string, map: PseudonymMap): string {
  return applyNameScrub(
    text,
    Object.entries(map.forward).map(([real, pseudo]) => ({ real, replacement: pseudo })),
  )
}

// Recursively walk a JSON value and pseudonymize every string leaf and key.
export function pseudonymizeDeep<T>(value: T, map: PseudonymMap): T {
  if (typeof value === 'string') return pseudonymizeText(value, map) as unknown as T
  if (Array.isArray(value)) return value.map((v) => pseudonymizeDeep(v, map)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[pseudonymizeText(k, map)] = pseudonymizeDeep(v, map)
    }
    return out as T
  }
  return value
}

// Reverse pseudonyms in any text coming back from the AI.
//
// Case-insensitive on purpose: the Gen-Z-style prompt often has the model
// lowercasing prose ("person a writes more"), but the pseudonym was issued in
// canonical form ("Person A"). Without the `i` flag those would leak through
// unreplaced. Replacement always uses the real name in its original casing.
//
// Lookahead guard so "Person A" doesn't match inside "Person Alpha" or
// "Person A1" — our pseudonyms are bounded by non-word chars on both sides.
export function restoreNames(text: string, map: PseudonymMap): string {
  let out = text
  for (const [pseudo, real] of Object.entries(map.reverse)) {
    const re = new RegExp(`(?<!\\w)${escapeRe(pseudo)}(?!\\w)`, 'gi')
    out = out.replace(re, real)
  }
  // Defensive: if the model ever echoed a surname from chat text onto the
  // pseudonym ("Person A Müller"), the restore above will have produced
  // "Max Müller Müller". Collapse those immediate trailing-token duplicates.
  for (const { real } of map.participants) {
    const tokens = real.split(/\s+/).filter((t) => t.length >= 2)
    if (tokens.length < 2) continue
    const last = tokens[tokens.length - 1]
    const dupRe = new RegExp(`(${escapeRe(real)})(\\s+${escapeRe(last)})+(?!\\w)`, 'gi')
    out = out.replace(dupRe, '$1')
  }
  return out
}

// Recursively walk a JSON value and restore names in every string leaf.
export function restoreNamesDeep<T>(value: T, map: PseudonymMap): T {
  if (typeof value === 'string') return restoreNames(value, map) as unknown as T
  if (Array.isArray(value)) return value.map((v) => restoreNamesDeep(v, map)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[restoreNames(k, map)] = restoreNamesDeep(v, map)
    }
    return out as T
  }
  return value
}

// Swap out any third-person personal/possessive pronouns referring to `name`
// with the literal name. Used after a profile analysis comes back, where we
// know every pronoun must refer to the single profiled person — so the
// replacement is unambiguous. Not safe for multi-subject text (relationship),
// where we can't tell which person is meant.
//
// The list intentionally excludes "sie" in isolation: too many legitimate uses
// (formal "Sie", 3rd-person plural, start-of-sentence). We still catch the
// possessive forms "ihre/ihrer/ihrem/ihren" and clear personal pronouns.
const PROFILE_PRONOUNS_DE = [
  'er', 'ihn', 'ihm',
  'sein', 'seine', 'seinem', 'seinen', 'seiner', 'seines',
  'ihre', 'ihrer', 'ihrem', 'ihren', 'ihres',
]
const PROFILE_PRONOUNS_EN = ['he', 'him', 'his', 'she', 'her', 'hers']

function scrubPronouns(text: string, name: string): string {
  const words = [...PROFILE_PRONOUNS_DE, ...PROFILE_PRONOUNS_EN]
  let out = text
  for (const w of words) {
    const re = new RegExp(`(?<!\\w)${w}(?!\\w)`, 'gi')
    out = out.replace(re, name)
  }
  return out
}

// Deep variant — walk a JSON payload and scrub pronouns in every string leaf.
export function scrubPronounsDeep<T>(value: T, name: string): T {
  if (typeof value === 'string') return scrubPronouns(value, name) as unknown as T
  if (Array.isArray(value)) return value.map((v) => scrubPronounsDeep(v, name)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubPronounsDeep(v, name)
    }
    return out as T
  }
  return value
}
