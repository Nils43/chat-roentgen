import { useEffect, useState } from 'react'
import { t, useLocale } from '../i18n'

const STORAGE_KEY = 'tea.privacy.ack.v1'

interface Props {
  onReadPolicy: () => void
}

// Shown once per browser, first time the app loads. Not a consent gate — just
// makes the data flow transparent on entry. Art. 13 GDPR information duty.
export function PrivacyBanner({ onReadPolicy }: Props) {
  const locale = useLocale()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch {
      /* storage disabled — skip banner */
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-md z-[70]">
      <div
        className="bg-white border-2 border-ink p-4 md:p-5 relative"
        style={{ boxShadow: '6px 6px 0 #0A0A0A', transform: 'rotate(-0.4deg)' }}
      >
        <span className="exhibit-label">{t('banner.label', locale)}</span>
        <div className="font-serif text-xl md:text-2xl leading-[1.05] tracking-tight mt-3 mb-2">
          {t('banner.title', locale)}
        </div>
        <p className="serif-body text-sm md:text-base text-ink/80 leading-snug mb-4">
          {t('banner.body', locale)}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={dismiss}
            className="btn-pop px-4 py-2 text-sm"
          >
            {t('banner.got', locale)}
          </button>
          <button
            onClick={() => {
              dismiss()
              onReadPolicy()
            }}
            className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/70 hover:text-ink underline underline-offset-4 decoration-dotted"
          >
            {t('banner.read', locale)}
          </button>
        </div>
      </div>
    </div>
  )
}
