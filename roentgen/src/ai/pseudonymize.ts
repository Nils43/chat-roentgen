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
    text: scrubNamesInText(m.text, map)
      .replace(EMAIL_RE, '[email]')
      .replace(URL_RE, '[link]')
      .replace(PHONE_RE, (match) => (match.replace(/\D/g, '').length >= 7 ? '[phone]' : match)),
  }))
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
export function restoreNames(text: string, map: PseudonymMap): string {
  let out = text
  for (const [pseudo, real] of Object.entries(map.reverse)) {
    const re = new RegExp(escapeRe(pseudo), 'g')
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
