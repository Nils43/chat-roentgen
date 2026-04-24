import { useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import type { RelationshipPayload } from '../ai/types'
import { useLocale } from '../i18n'
import { ShareCard } from './ShareCard'

// Share modal — renders the ShareCard at its real size (1080×1350) inside
// a scaled-down viewport so the user sees a preview before hitting save.
// On save we capture the unscaled card via html-to-image, then either
// hand the PNG to the native share sheet (Web Share API, mobile-first) or
// fall back to a plain download.

interface Props {
  payload: RelationshipPayload
  participants: string[]
  onClose: () => void
}

const CARD_WIDTH = 1080
const CARD_HEIGHT = 1350

export function ShareModal({ payload, participants, onClose }: Props) {
  const locale = useLocale()
  const cardRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(0.3)
  const [status, setStatus] = useState<'idle' | 'rendering' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  // Recompute scale based on available viewport width (minus padding).
  useEffect(() => {
    const update = () => {
      const available = Math.min(window.innerWidth - 48, 560)
      setPreviewScale(available / CARD_WIDTH)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Esc closes the modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status !== 'rendering') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, status])

  // Lock body scroll.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const r = (en: string, de: string) => (locale === 'de' ? de : en)

  async function render(): Promise<Blob | null> {
    if (!cardRef.current) return null
    // Capture at real 1080×1350; pixelRatio=2 would double the file size with
    // only marginal quality gain — the card design is large-print anyway.
    const dataUrl = await toPng(cardRef.current, {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      canvasWidth: CARD_WIDTH,
      canvasHeight: CARD_HEIGHT,
      pixelRatio: 1,
      cacheBust: true,
      style: { transform: 'none' },
    })
    const res = await fetch(dataUrl)
    return res.blob()
  }

  async function handleSave() {
    setStatus('rendering')
    setError(null)
    try {
      const blob = await render()
      if (!blob) throw new Error('render_failed')
      const filename = `spillteato-${participants.slice(0, 2).join('-').toLowerCase().replace(/[^a-z0-9-]+/g, '')}.png`
      const file = new File([blob], filename, { type: 'image/png' })

      // Prefer native share sheet (iOS, Android, newer desktops). If the
      // browser can't share files, fall through to a plain download.
      const canShareFile =
        typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
      if (canShareFile) {
        try {
          await navigator.share({
            files: [file],
            title: r('Our analysis', 'Unsere Analyse'),
            text: r('What is actually going on between us', 'Was läuft eigentlich zwischen uns'),
          })
          setStatus('done')
          return
        } catch (e) {
          // User cancelled share sheet — treat as idle, not error.
          if ((e as Error).name === 'AbortError') {
            setStatus('idle')
            return
          }
          // Any other share error → fall back to download.
        }
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setStatus('done')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const previewHeight = CARD_HEIGHT * previewScale
  const previewWidth = CARD_WIDTH * previewScale

  return (
    <div
      className="fixed inset-0 z-[90] bg-ink/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 md:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget && status !== 'rendering') onClose()
      }}
    >
      <div
        className="relative w-full max-w-xl bg-bg border-2 border-ink"
        style={{ boxShadow: '6px 6px 0 #0A0A0A' }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          disabled={status === 'rendering'}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center bg-ink text-pop-yellow border-2 border-ink hover:bg-pop-yellow hover:text-ink transition-colors text-lg leading-none disabled:opacity-40"
        >
          ×
        </button>

        <div className="px-5 md:px-6 pt-5 pb-3 border-b border-ink/20">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/70">
            {r('share this analysis', 'analyse teilen')}
          </div>
        </div>

        <div className="p-5 md:p-6 space-y-5">
          {/* Scaled preview. The inner node is the full-size 1080×1350 card
              that gets captured on save. */}
          <div
            className="mx-auto border-2 border-ink"
            style={{
              width: previewWidth,
              height: previewHeight,
              boxShadow: '4px 4px 0 #0A0A0A',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                transform: `scale(${previewScale})`,
                transformOrigin: 'top left',
              }}
            >
              <ShareCard payload={payload} participants={participants} locale={locale} />
            </div>
          </div>

          {status === 'error' && (
            <div className="font-mono text-sm text-red-700 bg-red-50 border border-red-300 p-3">
              {r('Could not generate image:', 'Bild konnte nicht erzeugt werden:')} {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={status === 'rendering'}
              className="flex-1 bg-ink text-pop-yellow border-2 border-ink px-4 py-3 font-mono text-[11px] uppercase tracking-[0.16em] hover:bg-pop-yellow hover:text-ink transition-colors disabled:opacity-50"
              style={{ boxShadow: '3px 3px 0 #0A0A0A' }}
            >
              {status === 'rendering'
                ? r('rendering…', 'erzeuge…')
                : r('save / share →', 'speichern / teilen →')}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/60 hover:text-ink"
            >
              {r('cancel', 'abbrechen')}
            </button>
          </div>

          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50 text-center">
            {r(
              'pseudonyms only — real names never leave your device',
              'nur pseudonyme — echte namen verlassen dein gerät nie',
            )}
          </p>
        </div>
      </div>

      {/* Off-screen render for html-to-image. Keep the node attached and
          visible so layout metrics are correct; hide it via positioning. */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: -99999,
          pointerEvents: 'none',
        }}
      >
        <ShareCard ref={cardRef} payload={payload} participants={participants} locale={locale} />
      </div>
    </div>
  )
}
