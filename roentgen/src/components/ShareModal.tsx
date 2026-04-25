import { useEffect, useRef, useState, type ReactNode } from 'react'
import { toPng } from 'html-to-image'
import { useLocale } from '../i18n'

// Generic share modal. The caller supplies a 1080×1350 card component as
// `card`; we render it twice — once inside a scaled preview the user can
// see, once off-screen at full size for html-to-image to capture. The PNG
// either goes to the native share sheet (Web Share API on mobile) or
// falls back to a plain download.

interface Props {
  card: ReactNode
  filename: string
  shareTitle: string
  shareText: string
  onClose: () => void
}

const CARD_WIDTH = 1080
const CARD_HEIGHT = 1350

export function ShareModal({ card, filename, shareTitle, shareText, onClose }: Props) {
  const locale = useLocale()
  const captureRef = useRef<HTMLDivElement>(null)
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
    if (!captureRef.current) return null
    // Capture the off-screen wrapper. pixelRatio=1 keeps file size sane;
    // the card design is large-print so it stays crisp on phones.
    const dataUrl = await toPng(captureRef.current, {
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
      const file = new File([blob], filename, { type: 'image/png' })

      // Prefer native share sheet (iOS, Android, newer desktops). If the
      // browser can't share files, fall through to a plain download.
      const canShareFile =
        typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
      if (canShareFile) {
        try {
          await navigator.share({
            files: [file],
            title: shareTitle,
            text: shareText,
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
          {/* Scaled preview. The inner node renders the card at full size
              and gets visually shrunk via transform; the off-screen copy
              below is what the capture pulls from. */}
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
              {card}
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

      {/* Off-screen render for html-to-image. Kept attached + visible so
          layout metrics resolve correctly; hidden via large negative left. */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: -99999,
          pointerEvents: 'none',
        }}
      >
        <div ref={captureRef} style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
          {card}
        </div>
      </div>
    </div>
  )
}
