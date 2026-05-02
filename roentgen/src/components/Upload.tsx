import { useCallback, useRef, useState } from 'react'
import JSZip from 'jszip'
import { t, useLocale } from '../i18n'

interface Props {
  onFile: (text: string, fileName: string) => void
}

export function Upload({ onFile }: Props) {
  const locale = useLocale()
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consented, setConsented] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const readFile = useCallback(
    async (file: File) => {
      setError(null)
      if (!consented) {
        setError(t('upload.err.noConsent', locale))
        return
      }
      if (file.size > 50 * 1024 * 1024) {
        setError(t('upload.err.tooBig', locale))
        return
      }
      const ext = file.name.toLowerCase().split('.').pop()
      if (ext !== 'txt' && ext !== 'zip') {
        setError(t('upload.err.wrongType', locale))
        return
      }

      try {
        if (ext === 'zip') {
          const arrayBuffer = await file.arrayBuffer()
          const zip = await JSZip.loadAsync(arrayBuffer)
          const txtFile = Object.values(zip.files).find(
            (f) => !f.dir && f.name.toLowerCase().endsWith('.txt')
          )
          if (!txtFile) {
            setError(t('upload.err.noTxt', locale))
            return
          }
          const text = await txtFile.async('string')
          const name = txtFile.name.split('/').pop() ?? file.name
          onFile(text, name)
        } else {
          const reader = new FileReader()
          reader.onload = (e) => {
            const text = (e.target?.result as string) ?? ''
            onFile(text, file.name)
          }
          reader.onerror = () => setError(t('upload.err.readFail', locale))
          reader.readAsText(file, 'utf-8')
        }
      } catch {
        setError(t('upload.err.unzipFail', locale))
      }
    },
    [onFile, consented, locale],
  )

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const f = e.dataTransfer.files[0]
          if (f) readFile(f)
        }}
        onClick={() => {
          if (!consented) {
            setError(t('upload.err.noConsent', locale))
            return
          }
          inputRef.current?.click()
        }}
        className={`
          relative cursor-pointer group overflow-hidden
          rounded-[2rem]
          transition-all duration-300
          px-8 py-20 md:py-28
          text-center dotgrid
          ${dragging ? 'gradient-border scale-[1.01]' : 'border border-dashed border-line hover:border-transparent hover:bg-bg-raised/50'}
        `}
      >
        {/* One quiet ambient glow */}
        <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-full bg-a/[0.06] blur-3xl" aria-hidden />

        <input
          ref={inputRef}
          type="file"
          accept=".txt,.zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) readFile(f)
          }}
        />

        <div className="relative inline-flex items-center gap-2 mb-8 pill-pop">
          <span className="inline-block w-1.5 h-1.5 bg-a rounded-full animate-pulse-soft" />
          <span className="font-mono uppercase tracking-[0.14em]">{t('upload.privacy', locale)}</span>
        </div>

        <div className="relative font-serif text-4xl md:text-6xl leading-[1.05] mb-4 tracking-tight">
          {t('upload.hero.prefix', locale)}<span className="gradient-text">{t('upload.hero.highlight', locale)}</span>.
          <br />
          <span className="italic text-ink-muted">{t('upload.hero.sub', locale)}</span>
        </div>

        <div className="relative text-ink-muted mb-8 max-w-md mx-auto text-sm md:text-base">
          {t('upload.body', locale)}
        </div>

        <div className={`relative btn-pop group-hover:scale-[1.03] transition-all ${!consented ? 'opacity-30 cursor-not-allowed grayscale' : ''}`}>
          <span className="text-base">📎</span>
          {t('upload.cta', locale)}
          <span className="text-xs">→</span>
        </div>

        {!consented && !error && (
          <div className="relative mt-6 text-xs font-mono uppercase tracking-[0.14em] text-ink/50 animate-pulse">
            {t('upload.consentHint', locale)}
          </div>
        )}

        {error && (
          <div className="relative mt-6 px-4 py-3 bg-black text-white font-mono text-sm border-2 border-black" style={{boxShadow:'3px 3px 0 #FFE234', transform:'rotate(-0.5deg)'}}>
            <span className="text-[var(--yellow)] font-bold">{t('upload.blocked', locale)}</span> {error}
          </div>
        )}
      </div>

      {/* Misuse disclaimer with consent checkbox */}
      <div
        className="mt-6 card max-w-2xl mx-auto"
        style={{ transform: 'rotate(-0.3deg)', boxShadow: '4px 4px 0 #0A0A0A' }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="exhibit-label">{t('upload.rules.label', locale)}</span>
        <label className="flex gap-3 items-start cursor-pointer mt-2 select-none">
          <input
            type="checkbox"
            checked={consented}
            onChange={(e) => {
              setConsented(e.target.checked)
              if (e.target.checked) setError(null)
            }}
            className="mt-1 w-5 h-5 accent-pop-yellow flex-shrink-0"
          />
          <span className="serif-body text-base leading-snug">
            {t('upload.rules.prefix', locale)}
            <strong className="not-italic font-bold">{t('upload.rules.bold', locale)}</strong>
            {t('upload.rules.suffix', locale)}
          </span>
        </label>
      </div>

      <HowToExport />
    </div>
  )
}

function HowToExport() {
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-6 text-center">
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-pop text-base md:text-lg px-6 py-3 inline-flex items-center gap-2"
      >
        {t('upload.howTo.cta', locale)} <span className="font-serif italic normal-case">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="mt-6 card text-left serif-body text-base md:text-lg space-y-3">
          <ol className="space-y-3 list-decimal pl-5 marker:text-a marker:font-mono marker:text-sm">
            <li>{t('upload.howTo.step1', locale)}</li>
            <li>{t('upload.howTo.step2', locale)}</li>
            <li>{t('upload.howTo.step3', locale)}</li>
            <li>{t('upload.howTo.step4', locale)}</li>
          </ol>
          <p className="text-ink-muted text-sm font-sans pt-2 border-t border-line/60">
            {t('upload.howTo.note', locale)}
          </p>
        </div>
      )}
    </div>
  )
}
