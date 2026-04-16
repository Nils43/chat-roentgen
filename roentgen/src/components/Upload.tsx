import { useCallback, useRef, useState } from 'react'

interface Props {
  onFile: (text: string, fileName: string) => void
}

export function Upload({ onFile }: Props) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const readFile = useCallback(
    (file: File) => {
      setError(null)
      if (file.size > 50 * 1024 * 1024) {
        setError('Datei größer als 50 MB. Das wäre ein rekordverdächtiger Chat.')
        return
      }
      const ext = file.name.toLowerCase().split('.').pop()
      if (ext !== 'txt' && ext !== 'zip') {
        setError('Aktuell wird nur WhatsApp-.txt-Export unterstützt. (ZIP kommt gleich.)')
        return
      }
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = (e.target?.result as string) ?? ''
        onFile(text, file.name)
      }
      reader.onerror = () => setError('Datei konnte nicht gelesen werden.')
      reader.readAsText(file, 'utf-8')
    },
    [onFile],
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
        onClick={() => inputRef.current?.click()}
        className={`
          relative cursor-pointer group
          border border-dashed rounded-3xl
          transition-all duration-300
          px-8 py-20 md:py-28
          text-center
          ${dragging ? 'border-a bg-a/5 scale-[1.01]' : 'border-line hover:border-a/50 hover:bg-bg-raised/50'}
        `}
      >
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

        <div className="label-mono mb-6 text-a">
          <span className="inline-block w-1.5 h-1.5 bg-a rounded-full mr-2 animate-pulse-soft" />
          Zone 1 · Lokal · Kein Upload
        </div>

        <div className="font-serif text-4xl md:text-6xl leading-[1.05] mb-4 tracking-tight">
          Lade deinen Chat.
          <br />
          <span className="italic text-ink-muted">Sieh, was er sagt.</span>
        </div>

        <div className="text-ink-muted mb-8 max-w-md mx-auto text-sm md:text-base">
          Drop deine WhatsApp-<span className="font-mono text-ink">.txt</span>-Datei hier. Die Analyse läuft vollständig
          in deinem Browser — nichts wird hochgeladen.
        </div>

        <div className="inline-flex items-center gap-3 px-5 py-3 bg-ink text-bg rounded-full font-sans font-medium text-sm group-hover:bg-a transition-colors">
          Datei auswählen
          <span className="text-xs">→</span>
        </div>

        {error && (
          <div className="mt-6 text-sm text-b font-mono">{error}</div>
        )}
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
        className="label-mono text-ink-muted hover:text-ink transition-colors inline-flex items-center gap-2"
      >
        Wie exportiere ich einen WhatsApp-Chat? <span className="font-serif italic normal-case">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="mt-6 card text-left serif-body text-base md:text-lg space-y-3">
          <ol className="space-y-3 list-decimal pl-5 marker:text-a marker:font-mono marker:text-sm">
            <li>WhatsApp öffnen → den gewünschten Chat wählen.</li>
            <li>Oben auf den Chatnamen tippen → <span className="font-mono text-sm">Chat exportieren</span>.</li>
            <li>„Ohne Medien" wählen (schneller, reicht für die Analyse).</li>
            <li>Die <span className="font-mono text-sm">.txt</span>-Datei per AirDrop, Mail oder Drive an diesen Browser schicken.</li>
          </ol>
          <p className="text-ink-muted text-sm font-sans pt-2 border-t border-line/60">
            Tipp: Android packt den Export in ein <span className="font-mono">.zip</span>. Entpacke es vorher und lade
            nur die <span className="font-mono">.txt</span> hoch.
          </p>
        </div>
      )}
    </div>
  )
}
