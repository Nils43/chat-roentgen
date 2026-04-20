import { useSyncExternalStore } from 'react'
import type { ParsedChat } from '../parser/types'
import type { ModuleId } from '../tokens/store'
import { clearSession, saveSession, type SessionSnapshot } from './sessionStore'

export interface ChatMeta {
  id: string
  fileName: string | null
  participants: string[]
  messageCount: number
  firstTs: string | null
  lastTs: string | null
  createdAt: string
  modulesDone: ModuleId[]
  selfPerson?: string | null
  unlockedProfiles?: string[]
  // Flipped to true once the user has walked through the page-by-page
  // Hard Facts exhibit. Future opens render as a scroll view.
  exhibitSeen?: boolean
}

const INDEX_KEY = 'roentgen.library.v1'
const LEGACY_SESSION_KEY = 'roentgen.session.v1'

function uid(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function readIndex(): ChatMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    if (!raw) return migrateLegacy()
    const parsed = JSON.parse(raw) as ChatMeta[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeIndex(list: ChatMeta[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(list))
  } catch {
    // quota — ignore
  }
}

// One-time: if a single-chat session existed in the old format, lift it into
// the library as the first chat.
function migrateLegacy(): ChatMeta[] {
  try {
    const raw = localStorage.getItem(LEGACY_SESSION_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Partial<SessionSnapshot>
    if (!parsed.chat) {
      localStorage.removeItem(LEGACY_SESSION_KEY)
      return []
    }
    const id = uid()
    const messages = parsed.chat.messages ?? []
    const meta: ChatMeta = {
      id,
      fileName: parsed.fileName ?? null,
      participants: parsed.chat.participants ?? [],
      messageCount: messages.length,
      firstTs:
        messages.length > 0 && messages[0]?.ts ? new Date(messages[0].ts as unknown as string).toISOString() : null,
      lastTs:
        messages.length > 0 && messages[messages.length - 1]?.ts
          ? new Date(messages[messages.length - 1].ts as unknown as string).toISOString()
          : null,
      createdAt: parsed.savedAt ?? new Date().toISOString(),
      modulesDone: collectModules(parsed),
    }
    void saveSession(id, parsed as Omit<SessionSnapshot, 'savedAt'>)
    localStorage.setItem(INDEX_KEY, JSON.stringify([meta]))
    localStorage.removeItem(LEGACY_SESSION_KEY)
    return [meta]
  } catch {
    return []
  }
}

function collectModules(snap: Partial<SessionSnapshot>): ModuleId[] {
  const done: ModuleId[] = []
  if (snap.profiles) done.push('profiles')
  if (snap.relationship) done.push('relationship')
  return done
}

let cache: ChatMeta[] | null = null
const listeners = new Set<() => void>()

function get(): ChatMeta[] {
  if (!cache) cache = readIndex()
  return cache
}

function emit(): void {
  for (const l of listeners) l()
}

function update(mutator: (list: ChatMeta[]) => ChatMeta[]): void {
  const next = mutator(get())
  cache = next
  writeIndex(next)
  emit()
}

export const chatLibrary = {
  get,
  subscribe(l: () => void): () => void {
    listeners.add(l)
    return () => listeners.delete(l)
  },

  create(parsed: ParsedChat, fileName: string | null): ChatMeta {
    const id = uid()
    const messages = parsed.messages
    const meta: ChatMeta = {
      id,
      fileName,
      participants: parsed.participants,
      messageCount: messages.length,
      firstTs: messages.length > 0 ? messages[0].ts.toISOString() : null,
      lastTs: messages.length > 0 ? messages[messages.length - 1].ts.toISOString() : null,
      createdAt: new Date().toISOString(),
      modulesDone: [],
    }
    update((list) => [meta, ...list])
    return meta
  },

  syncModules(id: string, snap: Partial<SessionSnapshot>): void {
    const done = collectModules(snap)
    update((list) =>
      list.map((m) => (m.id === id ? { ...m, modulesDone: done } : m)),
    )
  },

  remove(id: string): void {
    void clearSession(id)
    update((list) => list.filter((m) => m.id !== id))
  },

  setSelf(id: string, person: string | null): void {
    update((list) => list.map((m) => (m.id === id ? { ...m, selfPerson: person } : m)))
  },

  markExhibitSeen(id: string): void {
    update((list) => list.map((m) => (m.id === id ? { ...m, exhibitSeen: true } : m)))
  },

  unlockProfile(id: string, person: string): void {
    update((list) =>
      list.map((m) =>
        m.id === id ? { ...m, unlockedProfiles: [...new Set([...(m.unlockedProfiles ?? []), person])] } : m,
      ),
    )
  },

  getMeta(id: string): ChatMeta | undefined {
    return get().find((m) => m.id === id)
  },
}

export function useChatLibrary(): ChatMeta[] {
  return useSyncExternalStore(
    (l) => chatLibrary.subscribe(l),
    () => chatLibrary.get(),
    () => chatLibrary.get(),
  )
}
