import { useState } from 'react'
import { chatLibrary, useChatLibrary } from '../store/chatLibrary'
import { loadSession } from '../store/sessionStore'

interface Props {
  onBack: () => void
  onOpenPrivacy: () => void
  onOpenImprint: () => void
}

// Settings = data control center. Export all (Art. 20), delete all (Art. 17),
// links to privacy + imprint.
export function Settings({ onBack, onOpenPrivacy, onOpenImprint }: Props) {
  const chats = useChatLibrary()
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleted, setDeleted] = useState(false)

  const exportAll = async () => {
    setExporting(true)
    try {
      const sessions: Record<string, unknown> = {}
      for (const meta of chats) {
        const snap = await loadSession(meta.id)
        if (snap) sessions[meta.id] = snap
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        library: chats,
        sessions,
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tea-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setExported(true)
      setTimeout(() => setExported(false), 4000)
    } finally {
      setExporting(false)
    }
  }

  const nukeEverything = async () => {
    // Remove each chat via the library (also clears IndexedDB session)
    for (const meta of [...chats]) {
      chatLibrary.remove(meta.id)
    }
    // Clear any residual localStorage keys owned by tea
    try {
      const keysToKill: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && (k.startsWith('roentgen.') || k.startsWith('tea.'))) keysToKill.push(k)
      }
      for (const k of keysToKill) localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
    // Clear the entire IndexedDB store as a belt-and-suspenders move
    try {
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('roentgen')
        req.onsuccess = () => resolve()
        req.onerror = () => resolve()
        req.onblocked = () => resolve()
      })
    } catch {
      /* ignore */
    }
    setDeleted(true)
    setConfirmDelete(false)
  }

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 pt-10 pb-24">
      <button
        onClick={onBack}
        className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60 hover:text-ink mb-8"
      >
        ← back
      </button>

      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 mb-2">
        exhibit 99 · your data · your call
      </div>
      <h1 className="font-serif text-[18vw] md:text-[160px] leading-[0.82] tracking-[-0.02em] text-ink overflow-hidden mb-10">
        SETTINGS.
      </h1>

      {/* Stats */}
      <div className="card mb-8" style={{ transform: 'rotate(-0.3deg)' }}>
        <span className="exhibit-label">ON THIS DEVICE</span>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-4">
          <Stat label="Chats" value={String(chats.length)} />
          <Stat
            label="Messages"
            value={chats.reduce((s, c) => s + c.messageCount, 0).toLocaleString('en-US')}
          />
          <Stat
            label="Analyses done"
            value={String(chats.reduce((s, c) => s + (c.modulesDone?.length ?? 0), 0))}
          />
        </div>
      </div>

      {/* Export */}
      <div className="card mb-4" style={{ transform: 'rotate(0.2deg)' }}>
        <span className="exhibit-label">EXPORT · ART. 20 GDPR</span>
        <h2 className="font-serif text-3xl md:text-4xl tracking-tight leading-tight mt-3 mb-2">
          Take it all with you.
        </h2>
        <p className="serif-body text-base text-ink-muted mb-5">
          One JSON with every chat and every analysis result stored on this device. No server
          involved — the download runs locally.
        </p>
        <button
          onClick={exportAll}
          disabled={exporting || chats.length === 0}
          className="btn-pop disabled:opacity-40"
        >
          {exported ? '✓ DOWNLOADED' : exporting ? 'PACKING…' : 'EXPORT ALL → JSON'}
        </button>
      </div>

      {/* Delete */}
      <div
        className="card mb-8 border-ink"
        style={{ transform: 'rotate(-0.4deg)', background: confirmDelete ? '#0A0A0A' : undefined, color: confirmDelete ? '#FFE234' : undefined }}
      >
        <span className="exhibit-label">DELETE · ART. 17 GDPR</span>
        <h2 className="font-serif text-3xl md:text-4xl tracking-tight leading-tight mt-3 mb-2">
          {deleted ? 'Clean slate.' : 'Nuke it.'}
        </h2>
        {deleted ? (
          <p className="serif-body text-base">
            Every chat, every analysis, every setting — gone from this browser. Anthropic's
            30-day retention runs out on its own. You're clean.
          </p>
        ) : (
          <>
            <p className="serif-body text-base mb-5" style={{ color: confirmDelete ? '#FFE234' : 'rgba(10,10,10,0.72)' }}>
              Wipes every chat, every analysis, and every saved setting from this browser. This
              doesn't touch Anthropic's 30-day retention — that clears itself.
              <br />
              <strong className="not-italic">This can't be undone.</strong>
            </p>
            {confirmDelete ? (
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={nukeEverything}
                  className="btn-pop"
                  style={{ background: '#FFE234', color: '#0A0A0A' }}
                >
                  ✓ YES, DELETE EVERYTHING
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="font-mono text-[11px] uppercase tracking-[0.16em] underline underline-offset-4 decoration-dotted"
                >
                  cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-2 px-4 py-3 border-2 border-ink bg-white text-ink hover:bg-ink hover:text-pop-yellow transition-colors font-mono text-xs uppercase tracking-[0.16em] font-bold"
                style={{ boxShadow: '3px 3px 0 #0A0A0A' }}
              >
                DELETE ALL DATA
              </button>
            )}
          </>
        )}
      </div>

      {/* Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          onClick={onOpenPrivacy}
          className="inline-flex items-center justify-between gap-2 px-5 py-4 border-2 border-ink bg-white hover:bg-pop-yellow transition-colors font-mono text-[11px] uppercase tracking-[0.16em] font-bold"
          style={{ boxShadow: '3px 3px 0 #0A0A0A' }}
        >
          <span>Privacy policy</span>
          <span>→</span>
        </button>
        <button
          onClick={onOpenImprint}
          className="inline-flex items-center justify-between gap-2 px-5 py-4 border-2 border-ink bg-white hover:bg-pop-yellow transition-colors font-mono text-[11px] uppercase tracking-[0.16em] font-bold"
          style={{ boxShadow: '3px 3px 0 #0A0A0A' }}
        >
          <span>Imprint</span>
          <span>→</span>
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/60">{label}</div>
      <div className="font-serif text-4xl md:text-5xl leading-none mt-1">{value}</div>
    </div>
  )
}
