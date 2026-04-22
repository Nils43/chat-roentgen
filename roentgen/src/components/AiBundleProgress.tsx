import { useLocale } from '../i18n'

// Loading screen for bundle analysis — runs Personal and Relationship in
// parallel. Two status rows, each transitions pending → running → done/error
// independently as the two promises resolve. Styled to match AiProgress.

export type BundleStepState = 'pending' | 'running' | 'done' | 'error'

interface Props {
  personal: BundleStepState
  relationship: BundleStepState
  personalError?: string | null
  relationshipError?: string | null
  onBack?: () => void
  /** Fired when the user taps retry on an errored row. */
  onRetry?: (which: 'personal' | 'relationship') => void
}

export function AiBundleProgress({
  personal,
  relationship,
  personalError,
  relationshipError,
  onBack,
  onRetry,
}: Props) {
  const locale = useLocale()
  const r = (en: string, de: string) => (locale === 'de' ? de : en)

  const bothDone = personal === 'done' && relationship === 'done'
  const bothFailed = personal === 'error' && relationship === 'error'

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="w-full max-w-xl">
        <div className={`label-mono mb-8 ${bothFailed ? 'text-b' : 'text-b animate-pulse-soft'}`}>
          <span className="inline-block w-1.5 h-1.5 bg-b rounded-full mr-2" />
          {bothDone
            ? r('both done · brewing', 'beide fertig · wir servieren')
            : bothFailed
              ? r('both failed', 'beide fehlgeschlagen')
              : r('writing both files · stays on this page', 'beide files entstehen · bleib auf der seite')}
        </div>

        <h2 className="font-serif text-4xl md:text-5xl leading-tight tracking-tight mb-10">
          {bothDone ? (
            r('Ready.', 'Fertig.')
          ) : (
            <>
              {r('Writing your ', 'Dein ')}
              <span className="text-ink-muted italic">
                {r('deep tea', 'deep tea')}
              </span>
              .
            </>
          )}
        </h2>

        <div className="space-y-3">
          <StepRow
            label={r('Personal file', 'Persönliche Akte')}
            sub={r('how you write here', 'wie du hier schreibst')}
            state={personal}
            error={personalError}
            onRetry={onRetry ? () => onRetry('personal') : undefined}
            retryLabel={r('retry', 'nochmal')}
          />
          <StepRow
            label={r('Relationship file', 'Beziehungs-Akte')}
            sub={r('the space between you two', 'der raum zwischen euch')}
            state={relationship}
            error={relationshipError}
            onRetry={onRetry ? () => onRetry('relationship') : undefined}
            retryLabel={r('retry', 'nochmal')}
          />
        </div>

        {bothFailed && onBack && (
          <div className="mt-8">
            <button onClick={onBack} className="btn-pop">
              {r('← back', '← zurück')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function StepRow({
  label,
  sub,
  state,
  error,
  onRetry,
  retryLabel,
}: {
  label: string
  sub: string
  state: BundleStepState
  error?: string | null
  onRetry?: () => void
  retryLabel: string
}) {
  const icon =
    state === 'done' ? (
      <span className="font-mono text-a">✓</span>
    ) : state === 'error' ? (
      <span className="font-mono text-b">×</span>
    ) : state === 'running' ? (
      <span className="inline-block w-3 h-3 rounded-full border-2 border-ink border-t-transparent animate-spin" />
    ) : (
      <span className="font-mono text-ink-faint">·</span>
    )

  return (
    <div
      className="flex items-start gap-4 p-4 md:p-5 border-2 border-ink bg-white"
      style={{ boxShadow: '4px 4px 0 #0A0A0A' }}
    >
      <div className="shrink-0 w-6 h-6 flex items-center justify-center mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-serif text-xl md:text-2xl leading-tight">{label}</div>
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/60 mt-0.5">
          {sub}
        </div>
        {state === 'error' && (
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <span className="serif-body text-sm text-b">{error ?? 'error'}</span>
            {onRetry && (
              <button
                onClick={onRetry}
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink hover:text-b underline underline-offset-4 decoration-dotted"
              >
                {retryLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
