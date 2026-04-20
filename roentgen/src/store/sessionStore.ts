import type { ParsedChat } from '../parser/types'
import type { PrepareResult } from '../ai/profile'
import type {
  EntwicklungResult,
  HighlightsResult,
  ProfileResult,
  RelationshipResult,
  TimelineResult,
} from '../ai/types'

export interface SessionSnapshot {
  fileName: string | null
  chat: ParsedChat | null
  prepared: PrepareResult | null
  profiles: ProfileResult[] | null
  relationship: RelationshipResult | null
  highlights: HighlightsResult | null
  timeline: TimelineResult | null
  entwicklung: EntwicklungResult | null
  savedAt: string
}

const PREFIX = 'roentgen.chat.'

function keyFor(id: string): string {
  return `${PREFIX}${id}`
}

function reviveDates<T>(value: T): T {
  if (value instanceof Date) return value
  if (Array.isArray(value)) return value.map(reviveDates) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === 'ts' && typeof v === 'string') out[k] = new Date(v)
      else out[k] = reviveDates(v)
    }
    return out as unknown as T
  }
  return value
}

export function loadSession(id: string): Partial<SessionSnapshot> | null {
  try {
    const raw = localStorage.getItem(keyFor(id))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SessionSnapshot>
    return reviveDates(parsed)
  } catch {
    return null
  }
}

export function saveSession(id: string, snapshot: Omit<SessionSnapshot, 'savedAt'>): boolean {
  try {
    const payload: SessionSnapshot = { ...snapshot, savedAt: new Date().toISOString() }
    const json = JSON.stringify(payload)
    localStorage.setItem(keyFor(id), json)
    return true
  } catch (err) {
    console.error('[saveSession] failed:', (err as Error).message)
    return false
  }
}

export function clearSession(id: string): void {
  try {
    localStorage.removeItem(keyFor(id))
  } catch {
    // ignore
  }
}
