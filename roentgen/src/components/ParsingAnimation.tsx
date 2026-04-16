import { useEffect, useState } from 'react'
import type { ParsedChat } from '../parser/types'

interface Props {
  chat: ParsedChat
  onDone: () => void
}

// Inszenierte Sequenz: zählt Nachrichten → Teilnehmer → Zeitraum → startet Analyse.
// Realer Parsing-Vorgang ist < 200ms, wir strecken auf ~3s für den Röntgen-Moment.
export function ParsingAnimation({ chat, onDone }: Props) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 500),
      setTimeout(() => setStep(2), 1100),
      setTimeout(() => setStep(3), 1700),
      setTimeout(() => setStep(4), 2400),
      setTimeout(onDone, 3200),
    ]
    return () => timers.forEach(clearTimeout)
  }, [onDone])

  const span = formatSpan(chat.messages[0].ts, chat.messages[chat.messages.length - 1].ts)

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="w-full max-w-xl">
        <div className="label-mono text-a mb-8 animate-pulse-soft">
          <span className="inline-block w-1.5 h-1.5 bg-a rounded-full mr-2" />
          Scan läuft · lokal im Browser
        </div>

        <div className="space-y-5 font-mono text-base md:text-lg">
          <Line visible={step >= 1} label="Nachrichten erkannt" value={chat.messages.length.toLocaleString('de-DE')} />
          <Line visible={step >= 2} label="Teilnehmer" value={chat.participants.length.toString()} />
          <Line visible={step >= 3} label="Zeitraum" value={span} />
          <Line visible={step >= 4} label="Analyse" value="läuft" accent />
        </div>

        <div className="mt-12 h-[2px] bg-line overflow-hidden rounded-full">
          <div
            className="h-full bg-a transition-all duration-[3000ms] ease-out"
            style={{ width: step >= 4 ? '100%' : `${step * 25}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function Line({
  visible,
  label,
  value,
  accent,
}: {
  visible: boolean
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-6 border-b border-line/50 pb-3 transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <span className="label-mono">{label}</span>
      <span className={`metric-num text-2xl md:text-3xl ${accent ? 'text-a' : 'text-ink'}`}>{value}</span>
    </div>
  )
}

function formatSpan(a: Date, b: Date): string {
  const days = Math.ceil((+b - +a) / 86400000)
  if (days < 31) return `${days} Tage`
  const months = Math.round(days / 30.4)
  if (months < 12) return `${months} Monate`
  const years = Math.round((days / 365) * 10) / 10
  return `${years.toString().replace('.', ',')} Jahre`
}
