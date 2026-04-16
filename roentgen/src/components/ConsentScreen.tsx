import type { PrepareResult } from '../ai/profile'
import type { ParsedChat } from '../parser/types'

interface Props {
  chat: ParsedChat
  prepared: PrepareResult
  onAccept: () => void
  onCancel: () => void
}

// The critical trust moment. Show exactly what's going out and why.
// "Transparenz schafft mehr Vertrauen als Verschweigen."
export function ConsentScreen({ chat, prepared, onAccept, onCancel }: Props) {
  const pctOfChat = ((prepared.messagesSent / prepared.sample.totalAvailable) * 100).toFixed(1)
  const isFixture = prepared.analyzerKind === 'fixture'

  return (
    <div className="min-h-[80vh] flex items-start justify-center px-5 md:px-8 py-12">
      <div className="w-full max-w-2xl">
        <div className={`label-mono mb-6 ${isFixture ? 'text-a' : 'text-b'}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-2 animate-pulse-soft ${isFixture ? 'bg-a' : 'bg-b'}`} />
          {isFixture ? 'Dev · Fixture-Mode · kein API-Call' : 'Zone 2+3 · Daten verlassen dein Gerät'}
        </div>

        <h2 className="font-serif text-4xl md:text-5xl leading-tight mb-6 tracking-tight">
          Bevor wir die AI starten,
          <br />
          <span className="italic text-ink-muted">die Fakten.</span>
        </h2>

        <p className="serif-body text-lg md:text-xl text-ink-muted mb-10">
          Die psychologische Analyse braucht ein Sprachmodell. Hier ist, was genau passiert, wenn du jetzt zustimmst.
        </p>

        {/* The number block */}
        <div className="card space-y-6 mb-6">
          <Row
            label={isFixture ? 'Nachrichten vorbereitet' : 'Nachrichten gesendet'}
            value={prepared.messagesSent.toLocaleString('de-DE')}
            suffix={`von ${prepared.sample.totalAvailable.toLocaleString('de-DE')} (${pctOfChat}%)`}
          />
          <Row
            label="Tokens geschätzt"
            value={`~${prepared.approxTokensPerCall.toLocaleString('de-DE')}`}
            suffix={`pro Person · ${prepared.totalCalls} Call${prepared.totalCalls > 1 ? 's' : ''}`}
          />
          <Row
            label="Empfänger"
            value={isFixture ? 'Fixture (lokal)' : 'Anthropic (Claude)'}
            suffix={isFixture ? 'vorgeneriertes Profil · kein Netzwerk' : 'Frankfurt / US · via API'}
          />
          <Row
            label="Namen"
            value="pseudonymisiert"
            suffix={chat.participants.map((p, i) => `${p} → Person ${String.fromCharCode(65 + i)}`).join(', ')}
          />
          <Row
            label="Scrubbed"
            value="E-Mails, URLs, Telefonnummern"
            suffix="ersetzt durch [email], [link], [phone]"
          />
          <Row
            label="Sampling"
            value="intelligent"
            suffix={`${prepared.sample.strategy.start} Anfang · ${prepared.sample.strategy.end} Ende · ${prepared.sample.strategy.longTail} lang · ${prepared.sample.strategy.offHours} Nachts · ${prepared.sample.strategy.kipppunkte} Kipppunkte · ${prepared.sample.strategy.random} zufällig`}
          />
        </div>

        {/* Anthropic retention */}
        <div className="bg-bg-surface/60 border border-line/60 rounded-xl p-5 mb-10">
          <div className="label-mono mb-3 text-b">Was Anthropic damit macht</div>
          <ul className="serif-body text-base md:text-lg text-ink space-y-2">
            <li>
              <span className="text-a">+</span> Verarbeitung für dein Request — Response wird zurückgeschickt.
            </li>
            <li>
              <span className="text-a">+</span> Speicherung bis zu 30 Tage für Trust &amp; Safety.
            </li>
            <li>
              <span className="text-a">+</span> <span className="font-semibold">Kein</span> Training auf deinen Daten.
            </li>
            <li>
              <span className="text-ink-faint">·</span> Röntgen speichert nichts. Wir sehen den Chat nie, auch nicht im
              RAM.
            </li>
          </ul>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onAccept}
            className="flex-1 px-6 py-4 bg-ink text-bg rounded-full font-sans font-medium text-base hover:bg-a hover:text-bg transition-colors"
          >
            Analyse starten <span className="label-mono ml-2 text-bg/60">€0 · Demo</span>
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-4 border border-line rounded-full font-sans font-medium text-base text-ink-muted hover:border-ink hover:text-ink transition-colors"
          >
            Nur lokale Analyse
          </button>
        </div>

        <p className="text-ink-faint text-[11px] font-mono mt-6 leading-relaxed">
          Mit „Analyse starten" bestätigst du, dass dieser Chat dir gehört oder du an ihm beteiligt warst. Keine Analyse
          fremder Chats.
        </p>
      </div>
    </div>
  )
}

function Row({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 flex-wrap border-b border-line/40 pb-4 last:border-b-0 last:pb-0">
      <span className="label-mono shrink-0">{label}</span>
      <div className="text-right min-w-0 flex-1">
        <div className="metric-num text-lg md:text-xl text-ink">{value}</div>
        {suffix && <div className="text-ink-muted font-mono text-[11px] mt-1">{suffix}</div>}
      </div>
    </div>
  )
}
