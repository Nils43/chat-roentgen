import { useState } from 'react'

export type NetworkMode = 'local' | 'ai' | 'done'

interface Props {
  mode: NetworkMode
  detail?: string
}

export function NetworkIndicator({ mode, detail }: Props) {
  const [open, setOpen] = useState(false)

  const config = {
    local: {
      icon: '●',
      color: 'text-a',
      bg: 'bg-a/10',
      border: 'border-a/30',
      label: 'Lokal',
      text: 'Keine Daten verlassen dein Gerät.',
    },
    ai: {
      icon: '◈',
      color: 'text-b',
      bg: 'bg-b/10',
      border: 'border-b/30',
      label: 'AI aktiv',
      text: detail ?? 'Ausschnitt wird an Anthropic gesendet.',
    },
    done: {
      icon: '✓',
      color: 'text-ink-muted',
      bg: 'bg-ink/5',
      border: 'border-line',
      label: 'Fertig',
      text: 'Keine weitere Übertragung.',
    },
  }[mode]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 rounded-full border ${config.border} ${config.bg} px-3 py-1.5 label-mono ${config.color} transition-all hover:brightness-125`}
      >
        <span className="animate-pulse-soft text-[10px]">{config.icon}</span>
        <span>{config.label}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-line bg-bg-surface p-4 shadow-2xl z-50">
          <div className="label-mono mb-2">Datenfluss</div>
          <p className="text-sm text-ink-muted leading-relaxed">{config.text}</p>
          <div className="mt-3 pt-3 border-t border-line/60 text-[11px] text-ink-faint font-mono">
            {mode === 'local' && '→ Browser · Parser · Rechner'}
            {mode === 'ai' && '→ Browser · Proxy · Anthropic API'}
            {mode === 'done' && '→ Alles lokal. Ergebnis im Browser.'}
          </div>
        </div>
      )}
    </div>
  )
}
