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
      label: 'Private',
      text: 'Everything stays on your device. Nobody reads along.',
    },
    ai: {
      icon: '◈',
      color: 'text-b',
      bg: 'bg-b/10',
      border: 'border-b/30',
      label: 'AI reading',
      text: detail ?? 'Only a small slice is with the AI right now — names are out.',
    },
    done: {
      icon: '✓',
      color: 'text-ink-muted',
      bg: 'bg-ink/5',
      border: 'border-line',
      label: 'Done',
      text: 'Nothing else goes out.',
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
          <div className="label-mono mb-2">What's happening</div>
          <p className="text-sm text-ink-muted leading-relaxed">{config.text}</p>
          <div className="mt-3 pt-3 border-t border-line/60 text-[11px] text-ink-faint font-mono">
            {mode === 'local' && '→ Your device is crunching. That\'s it.'}
            {mode === 'ai' && '→ Small slice is with the AI right now'}
            {mode === 'done' && '→ Done. Everything\'s back on your device.'}
          </div>
        </div>
      )}
    </div>
  )
}
