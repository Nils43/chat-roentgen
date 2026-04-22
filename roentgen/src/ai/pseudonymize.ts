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

// Scrub first-name tokens that appear *inside* message text, based on the
// participant list. Use a word-boundary-ish match case-insensitive.
function scrubNamesInText(text: string, map: PseudonymMap): string {
  let out = text
  for (const { real, pseudonym } of map.participants) {
    if (real.length < 2) continue
    const re = new RegExp(`(?<![\\w])${escapeRe(real.split(/\s+/)[0])}(?![\\w])`, 'gi')
    out = out.replace(re, pseudonym)
  }
  return out
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
  let out = text
  for (const [real, pseudo] of Object.entries(map.forward)) {
    if (real.length < 2) continue
    const re = new RegExp(`(?<![\\w])${escapeRe(real.split(/\s+/)[0])}(?![\\w])`, 'gi')
    out = out.replace(re, pseudo)
  }
  return out
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
