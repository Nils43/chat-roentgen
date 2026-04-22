import { useState } from 'react'
import { chatLibrary, useChatLibrary } from '../store/chatLibrary'
import { loadSession } from '../store/sessionStore'
import { i18n, t, useLocale, type Locale } from '../i18n'

interface Props {
  onBack: () => void
  onOpenPrivacy: () => void
  onOpenImprint: () => void
}

// Settings = data control center. Export all (Art. 20), delete all (Art. 17),
// links to privacy + imprint, language toggle.
export function Settings({ onBack, onOpenPrivacy, onOpenImprint }: Props) {
  const locale = useLocale()
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
    for (const meta of [...chats]) {
      chatLibrary.remove(meta.id)
    }
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
        {t('settings.back', locale)}
      </button>

      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 mb-2">
        {t('settings.kicker', locale)}
      </div>
      <h1 className="font-serif text-[18vw] md:text-[160px] leading-[0.82] tracking-[-0.02em] text-ink overflow-hidden mb-10">
        {t('settings.hero', locale)}
      </h1>

      {/* Stats */}
      <div className="card mb-8" style={{ transform: 'rotate(-0.3deg)' }}>
        <span className="exhibit-label">{t('settings.stats.label', locale)}</span>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-4">
          <Stat label={t('settings.stats.chats', locale)} value={String(chats.length)} />
          <Stat
            label={t('settings.stats.messages', locale)}
            value={chats.reduce((s, c) => s + c.messageCount, 0).toLocaleString(locale === 'de' ? 'de-DE' : 'en-US')}
          />
          <Stat
            label={t('settings.stats.analyses', locale)}
            value={String(chats.reduce((s, c) => s + (c.modulesDone?.length ?? 0), 0))}
          />
        </div>
      </div>

      {/* Language toggle */}
      <div className="card mb-4" style={{ transform: 'rotate(0.25deg)' }}>
        <span className="exhibit-label">{t('settings.lang.label', locale)}</span>
        <h2 className="font-serif text-3xl md:text-4xl tracking-tight leading-tight mt-3 mb-4">
          {t('settings.lang.title', locale)}
        </h2>
        <div className="flex gap-2 flex-wrap">
          <LangButton current={locale} target="en" label={t('settings.lang.en', locale)} />
          <LangButton current={locale} target="de" label={t('settings.lang.de', locale)} />
        </div>
      </div>

      {/* Export */}
      <div className="card mb-4" style={{ transform: 'rotate(-0.3deg)' }}>
        <span className="exhibit-label">{t('settings.export.label', locale)}</span>
        <h2 className="font-serif text-3xl md:text-4xl tracking-tight leading-tight mt-3 mb-2">
          {t('settings.export.title', locale)}
        </h2>
        <p className="serif-body text-base text-ink-muted mb-5">
          {t('settings.export.body', locale)}
        </p>
        <button
          onClick={exportAll}
          disabled={exporting || chats.length === 0}
          className="btn-pop disabled:opacity-40"
        >
          {exported ? t('settings.export.done', locale) : exporting ? t('settings.export.doing', locale) : t('settings.export.cta', locale)}
        </button>
      </div>

      {/* Delete */}
      <div
        className="card mb-8 border-ink"
        style={{ transform: 'rotate(-0.4deg)', background: confirmDelete ? '#0A0A0A' : undefined, color: confirmDelete ? '#FFE234' : undefined }}
      >
        <span className="exhibit-label">{t('settings.delete.label', locale)}</span>
        <h2 className="font-serif text-3xl md:text-4xl tracking-tight leading-tight mt-3 mb-2">
          {deleted ? t('settings.delete.done.title', locale) : t('settings.delete.title', locale)}
        </h2>
        {deleted ? (
          <p className="serif-body text-base">{t('settings.delete.done.body', locale)}</p>
        ) : (
          <>
            <p className="serif-body text-base mb-5" style={{ color: confirmDelete ? '#FFE234' : 'rgba(10,10,10,0.72)' }}>
              {t('settings.delete.body', locale)}
            </p>
            {confirmDelete ? (
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={nukeEverything}
                  className="btn-pop"
                  style={{ background: '#FFE234', color: '#0A0A0A' }}
                >
                  {t('settings.delete.confirm', locale)}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="font-mono text-[11px] uppercase tracking-[0.16em] underline underline-offset-4 decoration-dotted"
                >
                  {t('settings.delete.cancel', locale)}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-2 px-4 py-3 border-2 border-ink bg-white text-ink hover:bg-ink hover:text-pop-yellow transition-colors font-mono text-xs uppercase tracking-[0.16em] font-bold"
                style={{ boxShadow: '3px 3px 0 #0A0A0A' }}
              >
                {t('settings.delete.cta', locale)}
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
          <span>{t('settings.links.privacy', locale)}</span>
          <span>→</span>
        </button>
        <button
          onClick={onOpenImprint}
          className="inline-flex items-center justify-between gap-2 px-5 py-4 border-2 border-ink bg-white hover:bg-pop-yellow transition-colors font-mono text-[11px] uppercase tracking-[0.16em] font-bold"
          style={{ boxShadow: '3px 3px 0 #0A0A0A' }}
        >
          <span>{t('settings.links.imprint', locale)}</span>
          <span>→</span>
        </button>
      </div>
    </div>
  )
}

function LangButton({ current, target, label }: { current: Locale; target: Locale; label: string }) {
  const active = current === target
  return (
    <button
      onClick={() => i18n.set(target)}
      className={`inline-flex items-center gap-2 px-4 py-2 border-2 border-ink font-mono text-xs uppercase tracking-[0.14em] font-bold transition-colors ${active ? 'bg-pop-yellow' : 'bg-white hover:bg-pop-yellow/60'}`}
      style={{ boxShadow: active ? '3px 3px 0 #0A0A0A' : '2px 2px 0 #0A0A0A' }}
    >
      {active && <span aria-hidden>✓</span>}
      {label}
    </button>
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
