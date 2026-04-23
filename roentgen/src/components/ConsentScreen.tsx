import type { PrepareResult } from '../ai/profile'
import type { ParsedChat } from '../parser/types'
import type { ModuleId } from '../store/chatLibrary'
import { t, useLocale } from '../i18n'

interface Props {
  chat: ParsedChat
  prepared: PrepareResult
  onAccept: () => void
  onCancel: () => void
  moduleId?: ModuleId
  selfPerson: string | null
  onSelfPersonChange: (name: string) => void
}

export function ConsentScreen({
  chat,
  prepared,
  onAccept,
  onCancel,
  moduleId,
  selfPerson,
  onSelfPersonChange,
}: Props) {
  const locale = useLocale()
  const pctOfChat = ((prepared.messagesSent / Math.max(1, prepared.totalAvailable)) * 100).toFixed(1)
  const isFixture = prepared.analyzerKind === 'fixture'
  const localeTag = locale === 'de' ? 'de-DE' : 'en-US'
  // Personal module analyzes the self-person. Relationship analyzes both so
  // self matters less — but the picker still lets them fix a wrong auto-guess.
  const showSelfPicker = chat.participants.length >= 2
  const canProceed = !showSelfPicker || (selfPerson !== null && chat.participants.includes(selfPerson))

  return (
    <div className="min-h-[80vh] flex items-start justify-center px-5 md:px-8 py-12">
      <div className="w-full max-w-2xl">
        <div className={`pill-pop mb-6 ${isFixture ? 'text-a' : 'text-b'}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full animate-pulse-soft ${isFixture ? 'bg-a' : 'bg-b'}`} />
          <span className="font-mono uppercase tracking-[0.14em]">
            {isFixture ? t('consent.pill.test', locale) : t('consent.pill.live', locale)}
          </span>
        </div>

        <h2 className="font-serif text-4xl md:text-5xl leading-tight mb-8 tracking-tight">
          {t('consent.title.prefix', locale)}<span className="gradient-text-cool">{t('consent.title.ai', locale)}</span>{t('consent.title.kicks', locale)}{' '}
          <span className="italic text-ink-muted">{t('consent.title.sub', locale)}</span>
        </h2>

        {/* Condensed facts */}
        <div className="card space-y-5 mb-6">
          <Row
            label={t('consent.row.msgs.label', locale)}
            value={`${prepared.messagesSent.toLocaleString(localeTag)} ${t('consent.row.msgs.of', locale)} ${prepared.totalAvailable.toLocaleString(localeTag)}`}
            suffix={`${pctOfChat}% · ${t('consent.row.msgs.suffix', locale)}`}
          />
          <Row
            label={t('consent.row.reader.label', locale)}
            value={isFixture ? t('consent.row.reader.test', locale) : t('consent.row.reader.live', locale)}
            suffix={isFixture ? t('consent.row.reader.testSuffix', locale) : t('consent.row.reader.liveSuffix', locale)}
          />
        </div>

        {/* You-are picker — silently wrong auto-guesses were giving people
            "personal" reports about the other person. Explicit pick fixes it. */}
        {showSelfPicker && (
          <div
            className="bg-white border-2 border-ink p-5 mb-6"
            style={{ boxShadow: '4px 4px 0 #0A0A0A' }}
          >
            <div className="label-mono mb-3 text-ink/70">
              {moduleId === 'relationship'
                ? locale === 'de' ? 'wer bist du in diesem chat?' : 'who are you in this chat?'
                : locale === 'de' ? 'wer soll analysiert werden?' : 'who should be analyzed?'}
            </div>
            <div className="flex flex-wrap gap-2">
              {chat.participants.map((p) => {
                const active = p === selfPerson
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onSelfPersonChange(p)}
                    className={`border-2 border-ink px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                      active ? 'bg-ink text-pop-yellow' : 'bg-pop-yellow/60 text-ink hover:bg-pop-yellow'
                    }`}
                    style={{ boxShadow: active ? '3px 3px 0 #0A0A0A' : '2px 2px 0 #0A0A0A' }}
                  >
                    {active ? '✦ ' : ''}{p}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Art. 9 GDPR explicit consent */}
        {!isFixture && (
          <div className="bg-pop-yellow border-2 border-ink p-5 mb-8" style={{ boxShadow: '4px 4px 0 #0A0A0A', transform: 'rotate(-0.3deg)' }}>
            <div className="label-mono mb-2 text-ink">{t('consent.art9.label', locale)}</div>
            <p className="serif-body text-base text-ink leading-snug">
              {t('consent.art9.body', locale)}
            </p>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onAccept}
            disabled={!canProceed}
            className="flex-1 btn-pop px-6 py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span aria-hidden>✨</span>
            {isFixture ? t('consent.cta.test', locale) : t('consent.cta.live', locale)}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-4 border border-line rounded-full font-sans font-medium text-base text-ink-muted hover:border-ink hover:text-ink hover:bg-bg-raised/40 transition-all"
          >
            {t('consent.cancel', locale)}
          </button>
        </div>

        <p className="text-ink-faint text-[11px] font-mono mt-6 leading-relaxed">
          {t('consent.footnote', locale)}
        </p>
      </div>
    </div>
  )
}

function Row({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 flex-wrap border-b border-line/40 pb-4 last:border-b-0 last:pb-0">
      <span className="label-mono shrink-0">{label}</span>
      <div className="text-right min-w-0 flex-1">
        <div className="metric-num text-base md:text-lg text-ink">{value}</div>
        {suffix && <div className="text-ink-muted font-mono text-[11px] mt-1">{suffix}</div>}
      </div>
    </div>
  )
}
