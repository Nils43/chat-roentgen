import { type ChatMeta, chatLibrary, type ModuleId, useChatLibrary } from '../store/chatLibrary'
import { t, useLocale } from '../i18n'

interface Props {
  onOpen: (id: string) => void
  onNew: () => void
}

const MODULE_ORDER: ModuleId[] = ['profiles', 'relationship']
const MODULE_LABELS_EN: Record<ModuleId, string> = {
  profiles: 'Personal analysis',
  relationship: 'Relationship analysis',
}
const MODULE_LABELS_DE: Record<ModuleId, string> = {
  profiles: 'Persönliche Analyse',
  relationship: 'Beziehungsanalyse',
}

const TILTS = [-1.4, 0.6, -0.8, 1.1, -0.4, 0.9]

export function Library({ onOpen, onNew }: Props) {
  const locale = useLocale()
  const chats = useChatLibrary()
  const countCopy =
    chats.length === 0
      ? t('library.empty', locale)
      : t(chats.length === 1 ? 'library.count_one' : 'library.count_many', locale, {
          count: chats.length,
        })

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 pt-8 pb-24">
      {/* HERO — RECEIPTS-style bleed */}
      <header className="mb-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 mb-2">
          {t('library.archive', locale)}
        </div>
        <h1 className="font-serif text-[20vw] md:text-[140px] leading-[0.85] tracking-[-0.01em] text-ink overflow-hidden whitespace-nowrap">
          {t('library.hero', locale)}
        </h1>
        <div className="flex justify-between items-end mt-2 gap-4 flex-wrap">
          <p className="font-mono italic text-base md:text-lg max-w-md leading-snug">
            {countCopy}
          </p>
          <button onClick={onNew} className="btn-pop">
            <span aria-hidden>＋</span>
            {t('library.newLeak', locale)}
          </button>
        </div>
      </header>

      {chats.length === 0 ? (
        <div className="card relative text-center py-16 mt-4">
          <span className="exhibit-label">{t('library.emptyTitle', locale)}</span>
          <p className="serif-body text-xl mb-6 mt-2">{t('library.emptyCopy', locale)}</p>
          <button onClick={onNew} className="btn-pop">{t('library.uploadFirst', locale)}</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {chats.map((chat, i) => (
            <ChatCard key={chat.id} chat={chat} onOpen={onOpen} tilt={TILTS[i % TILTS.length]} index={i + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function ChatCard({ chat, onOpen, tilt, index }: { chat: ChatMeta; onOpen: (id: string) => void; tilt: number; index: number }) {
  const locale = useLocale()
  const moduleLabels = locale === 'de' ? MODULE_LABELS_DE : MODULE_LABELS_EN
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (confirm(`${t('library.shred', locale)} "${displayName(chat, locale)}"?`)) {
      chatLibrary.remove(chat.id)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen(chat.id)
    }
  }

  const doneCount = chat.modulesDone.length

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(chat.id)}
      onKeyDown={handleKey}
      className="card cursor-pointer relative transition-transform hover:translate-x-[-2px] hover:translate-y-[-2px] focus:outline-none group"
      style={{ transform: `rotate(${tilt}deg)`, boxShadow: '6px 6px 0 #0A0A0A' }}
    >
      <span className="exhibit-label">{t('library.exhibit', locale)} {String(index).padStart(2, '0')}: {t('library.log', locale)}</span>

      <button
        onClick={handleDelete}
        aria-label={t('library.shred', locale)}
        className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center bg-ink text-pop-yellow text-base leading-none border border-ink hover:bg-pop-yellow hover:text-ink transition-colors opacity-50 group-hover:opacity-100"
      >
        ×
      </button>

      <div className="font-serif text-3xl leading-tight mt-3 mb-3 tracking-tight">
        {chat.participants.slice(0, 2).join(' · ').toUpperCase() || '—'}
        {chat.participants.length > 2 && (
          <span className="text-ink/50"> +{chat.participants.length - 2}</span>
        )}
      </div>

      <div className="font-mono text-xs leading-relaxed mb-4 text-ink/70">
        <div>{chat.messageCount.toLocaleString(locale === 'de' ? 'de-DE' : 'en-US')} {t('library.messages', locale)}</div>
        <div>{formatRange(chat.firstTs, chat.lastTs, locale)}</div>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        {MODULE_ORDER.map((m) => {
          const done = chat.modulesDone.includes(m)
          return (
            <span
              key={m}
              className="font-mono text-[9px] uppercase tracking-[0.12em] px-2 py-0.5 border border-ink"
              style={{
                background: done ? '#FFE234' : 'transparent',
                color: '#0A0A0A',
                opacity: done ? 1 : 0.4,
              }}
              title={moduleLabels[m]}
            >
              {moduleLabels[m].split(' ')[0]}
            </span>
          )
        })}
      </div>

      {doneCount === 2 && (
        <span
          className="absolute -top-3 -right-3 sticker sticker-tilt"
          style={{ transform: 'rotate(8deg)' }}
        >
          {t('library.allFiles', locale)}
        </span>
      )}
    </div>
  )
}

function displayName(chat: ChatMeta, locale: 'en' | 'de' = 'en'): string {
  if (chat.fileName) return chat.fileName.replace(/\.txt$/i, '')
  return new Date(chat.createdAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-US')
}

function formatRange(first: string | null, last: string | null, locale: 'en' | 'de' = 'en'): string {
  if (!first || !last) return '—'
  const f = new Date(first)
  const l = new Date(last)
  const sameYear = f.getFullYear() === l.getFullYear()
  const tag = locale === 'de' ? 'de-DE' : 'en-US'
  const fmt = (d: Date) =>
    sameYear
      ? d.toLocaleDateString(tag, { day: '2-digit', month: 'short' })
      : d.toLocaleDateString(tag, { day: '2-digit', month: 'short', year: 'numeric' })
  return `${fmt(f)} – ${fmt(l)}${sameYear ? ` ${l.getFullYear()}` : ''}`
}
