import { useState } from 'react'
import { t, useLocale } from '../i18n'

// Transparency badge shown on top of every AI-generated analysis screen.
// Art. 13/14 GDPR — the reader must be able to recognize the output as AI and
// know who processes the data, where, and how long.
export function AiDisclosure() {
  const locale = useLocale()
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] bg-pop-yellow text-ink border border-ink rounded-full px-3 py-1.5 hover:opacity-90 transition-opacity"
        style={{ boxShadow: '2px 2px 0 #0A0A0A' }}
      >
        <span aria-hidden>✦</span>
        <span>{t('ai.disclosure.short', locale)}</span>
        <span className="text-ink/60">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <p className="serif-body text-sm text-ink-muted max-w-2xl mt-3 leading-snug">
          {t('ai.disclosure.long', locale)}
        </p>
      )}
    </div>
  )
}
