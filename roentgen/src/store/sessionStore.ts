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
const DB_NAME = 'roentgen'
const DB_VERSION = 1
const STORE = 'sessions'

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

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('IndexedDB open blocked'))
  })
  return dbPromise
}

function idbGet(key: string): Promise<string | undefined> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
        req.onsuccess = () => resolve(req.result as string | undefined)
        req.onerror = () => reject(req.error)
      }),
  )
}

function idbPut(key: string, value: string): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put(value, key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

function idbDelete(key: string): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).delete(key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
  )
}

// One-time: copy any existing sessions from localStorage (old home) into IDB.
let migrationPromise: Promise<void> | null = null
function migrateFromLocalStorage(): Promise<void> {
  if (migrationPromise) return migrationPromise
  migrationPromise = (async () => {
    try {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(PREFIX)) keys.push(k)
      }
      for (const k of keys) {
        const val = localStorage.getItem(k)
        if (val == null) continue
        try {
          await idbPut(k, val)
          localStorage.removeItem(k)
        } catch (err) {
          console.error('[sessionStore] migration failed for', k, err)
        }
      }
    } catch (err) {
      console.error('[sessionStore] migration scan failed:', err)
    }
  })()
  return migrationPromise
}

export async function loadSession(id: string): Promise<Partial<SessionSnapshot> | null> {
  try {
    await migrateFromLocalStorage()
    const raw = await idbGet(keyFor(id))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SessionSnapshot>
    return reviveDates(parsed)
  } catch {
    return null
  }
}

export async function saveSession(
  id: string,
  snapshot: Omit<SessionSnapshot, 'savedAt'>,
): Promise<boolean> {
  try {
    await migrateFromLocalStorage()
    const payload: SessionSnapshot = { ...snapshot, savedAt: new Date().toISOString() }
    const json = JSON.stringify(payload)
    await idbPut(keyFor(id), json)
    return true
  } catch (err) {
    console.error('[saveSession] failed:', (err as Error).message)
    return false
  }
}

export async function clearSession(id: string): Promise<void> {
  try {
    await idbDelete(keyFor(id))
  } catch {
    // ignore
  }
}
