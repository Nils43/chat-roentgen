interface Props {
  done: number
  total: number
  currentPerson: string | null
  error?: string | null
  onCancel?: () => void
}

export function AiProgress({ done, total, currentPerson, error, onCancel }: Props) {
  const pct = total === 0 ? 0 : (done / total) * 100

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="w-full max-w-xl">
        <div className="label-mono text-b mb-8 animate-pulse-soft">
          <span className="inline-block w-1.5 h-1.5 bg-b rounded-full mr-2" />
          AI aktiv · Claude analysiert · Zone 3
        </div>

        <div className="font-serif text-4xl md:text-5xl leading-tight tracking-tight mb-4">
          {error ? (
            <span className="italic text-b">Da ist was schiefgelaufen.</span>
          ) : currentPerson ? (
            <>
              Profil<span className="text-ink-muted italic"> wird geschrieben.</span>
            </>
          ) : (
            'Warte auf Response…'
          )}
        </div>

        {currentPerson && !error && (
          <div className="font-mono text-sm text-ink-muted mb-10">
            Aktuell: {currentPerson}
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
          <span>{done} / {total} Profile fertig</span>
          {onCancel && (
            <button onClick={onCancel} className="hover:text-ink transition-colors">
              Abbrechen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
