import { t, useLocale } from '../i18n'

interface Props {
  done: number
  total: number
  currentPerson: string | null
  error?: string | null
  onCancel?: () => void
}

export function AiProgress({ done, total, currentPerson, error, onCancel }: Props) {
  const locale = useLocale()
  const pct = total === 0 ? 0 : (done / total) * 100

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="w-full max-w-xl">
        <div className="label-mono text-b mb-8 animate-pulse-soft">
          <span className="inline-block w-1.5 h-1.5 bg-b rounded-full mr-2" />
          {t('aiprog.kicker', locale)}
        </div>

        <div className="font-serif text-4xl md:text-5xl leading-tight tracking-tight mb-4">
          {error ? (
            <span className="italic text-b">{t('aiprog.titleErr', locale)}</span>
          ) : currentPerson ? (
            <>
              {t('aiprog.titleA', locale)}
              <span className="text-ink-muted italic"> {t('aiprog.titleB', locale)}</span>
            </>
          ) : (
            t('aiprog.titleWait', locale)
          )}
        </div>

        {currentPerson && !error && (
          <div className="font-mono text-sm text-ink-muted mb-10">
            {t('aiprog.onIt', locale)} {currentPerson}
          </div>
        )}

        {error && (
          <div className="bg-b/10 border border-b/30 rounded-xl p-5 text-ink-muted font-mono text-sm mb-6 whitespace-pre-wrap">
            {error}
          </div>
        )}

        <div className="h-[2px] bg-line overflow-hidden rounded-full">
          <div
            className={`h-full ${error ? 'bg-b' : 'bg-b'} transition-all duration-700 ease-out`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-4 flex justify-between font-mono text-[11px] text-ink-faint">
          <span>{t('aiprog.progress', locale, { done, total })}</span>
          {onCancel && (
            <button onClick={onCancel} className="hover:text-ink transition-colors">
              {t('aiprog.cancelBtn', locale)}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
