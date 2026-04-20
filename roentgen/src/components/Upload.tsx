import { useCallback, useRef, useState } from 'react'
import JSZip from 'jszip'

interface Props {
  onFile: (text: string, fileName: string) => void
}

export function Upload({ onFile }: Props) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consented, setConsented] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const readFile = useCallback(
    async (file: File) => {
      setError(null)
      if (!consented) {
        setError('nice try, honey. tick the house rules first — no consent, no tea.')
        return
      }
      if (file.size > 50 * 1024 * 1024) {
        setError('over 50 MB — that\'s low-key a record-breaking chat.')
        return
      }
      const ext = file.name.toLowerCase().split('.').pop()
      if (ext !== 'txt' && ext !== 'zip') {
        setError('that\'s not a WhatsApp export. instructions below — no stress.')
        return
      }

      try {
        if (ext === 'zip') {
          // Auto-unzip: find the .txt file inside the ZIP
          const arrayBuffer = await file.arrayBuffer()
          const zip = await JSZip.loadAsync(arrayBuffer)
          const txtFile = Object.values(zip.files).find(
            (f) => !f.dir && f.name.toLowerCase().endsWith('.txt')
          )
          if (!txtFile) {
            setError('no .txt file found inside the ZIP — is this a WhatsApp export?')
            return
          }
          const text = await txtFile.async('string')
          const name = txtFile.name.split('/').pop() ?? file.name
          onFile(text, name)
        } else {
          // Plain .txt file
          const reader = new FileReader()
          reader.onload = (e) => {
            const text = (e.target?.result as string) ?? ''
            onFile(text, file.name)
          }
          reader.onerror = () => setError('file isn\'t cooperating. try again.')
          reader.readAsText(file, 'utf-8')
        }
      } catch {
        setError('couldn\'t unzip that. is the file corrupted?')
      }
    },
    [onFile, consented],
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
            setError('nice try, honey. tick the house rules first — no consent, no tea.')
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
          <span className="font-mono uppercase tracking-[0.14em]">100% private · nobody reads along</span>
        </div>

        <div className="relative font-serif text-4xl md:text-6xl leading-[1.05] mb-4 tracking-tight">
          Drop your <span className="gradient-text">chat</span>.
          <br />
          <span className="italic text-ink-muted">See what's really going on.</span>
        </div>

        <div className="relative text-ink-muted mb-8 max-w-md mx-auto text-sm md:text-base">
          Drag your WhatsApp export in here or hit the button. Everything stays on your device — nobody else sees it.
        </div>

        <div className={`relative btn-pop group-hover:scale-[1.03] transition-all ${!consented ? 'opacity-30 cursor-not-allowed grayscale' : ''}`}>
          <span className="text-base">📎</span>
          PICK A CHAT
          <span className="text-xs">→</span>
        </div>

        {!consented && !error && (
          <div className="relative mt-6 text-xs font-mono uppercase tracking-[0.14em] text-ink/50 animate-pulse">
            ↓ sign the house rules to proceed ↓
          </div>
        )}

        {error && (
          <div className="relative mt-6 px-4 py-3 bg-black text-white font-mono text-sm border-2 border-black" style={{boxShadow:'3px 3px 0 #FFE234', transform:'rotate(-0.5deg)'}}>
            <span className="text-[var(--yellow)] font-bold">BLOCKED:</span> {error}
          </div>
        )}
      </div>

      {/* Misuse-Disclaimer mit Consent-Checkbox */}
      <div
        className="mt-6 card max-w-2xl mx-auto"
        style={{ transform: 'rotate(-0.3deg)', boxShadow: '4px 4px 0 #0A0A0A' }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="exhibit-label">EXHIBIT 99: HOUSE RULES</span>
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
            I am <strong className="not-italic font-bold">a participant in this chat</strong> and I'm using the analysis for myself — not to control, manipulate or stalk anyone. If I spot red flags, I'll seek real help instead of using this tool.
          </span>
        </label>
      </div>

      <HowToExport />
    </div>
  )
}

function HowToExport() {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-6 text-center">
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-pop text-base md:text-lg px-6 py-3 inline-flex items-center gap-2"
      >
        How do I get my WhatsApp chat? <span className="font-serif italic normal-case">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="mt-6 card text-left serif-body text-base md:text-lg space-y-3">
          <ol className="space-y-3 list-decimal pl-5 marker:text-a marker:font-mono marker:text-sm">
            <li>Open WhatsApp, tap the chat.</li>
            <li>Tap the name at the top, scroll down to "Export chat".</li>
            <li>Pick "Without media" — enough, and faster.</li>
            <li>Send the file via AirDrop, mail or cloud — then drop it here.</li>
          </ol>
          <p className="text-ink-muted text-sm font-sans pt-2 border-t border-line/60">
            Android wraps this in a ZIP. Tap it once, pull the text file out, done.
          </p>
        </div>
      )}
    </div>
  )
}
