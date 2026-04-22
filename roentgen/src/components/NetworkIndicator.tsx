import { useState } from 'react'
import { useLocale } from '../i18n'

export type NetworkMode = 'local' | 'ai' | 'done'

interface Props {
  mode: NetworkMode
  detail?: string
}

export function NetworkIndicator({ mode, detail }: Props) {
  const [open, setOpen] = useState(false)
  const locale = useLocale()
  const de = locale === 'de'

  const config = {
    local: {
      icon: '●',
      color: 'text-a',
      bg: 'bg-a/10',
      border: 'border-a/30',
      label: de ? 'Privat' : 'Private',
      text: de
        ? 'Alles bleibt auf deinem Gerät. Niemand liest mit.'
        : 'Everything stays on your device. Nobody reads along.',
    },
    ai: {
      icon: '◈',
      color: 'text-b',
      bg: 'bg-b/10',
      border: 'border-b/30',
      label: de ? 'KI liest' : 'AI reading',
      text:
        detail ??
        (de
          ? 'Gerade ist nur ein kleiner Slice bei der KI — Namen sind raus.'
          : 'Only a small slice is with the AI right now — names are out.'),
    },
    done: {
      icon: '✓',
      color: 'text-ink-muted',
      bg: 'bg-ink/5',
      border: 'border-line',
      label: de ? 'Fertig' : 'Done',
      text: de ? 'Nichts geht mehr raus.' : 'Nothing else goes out.',
    },
  }[mode]

  const heading = de ? 'Was gerade passiert' : "What's happening"
  const footnote = {
    local: de ? '→ Dein Gerät rechnet. Sonst nichts.' : "→ Your device is crunching. That's it.",
    ai: de ? '→ Kleiner Slice ist gerade bei der KI' : '→ Small slice is with the AI right now',
    done: de ? '→ Fertig. Alles zurück auf deinem Gerät.' : "→ Done. Everything's back on your device.",
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
          <div className="label-mono mb-2">{heading}</div>
          <p className="text-sm text-ink-muted leading-relaxed">{config.text}</p>
          <div className="mt-3 pt-3 border-t border-line/60 text-[11px] text-ink-faint font-mono">
            {footnote}
          </div>
        </div>
      )}
    </div>
  )
}
