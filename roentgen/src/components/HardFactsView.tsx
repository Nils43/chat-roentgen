import type { HardFacts } from '../analysis/hardFacts'
import { formatDuration } from '../analysis/hardFacts'
import { interpretHardFacts } from '../analysis/interpretation'
import { CountUp } from './CountUp'
import { SplitBar } from './charts/SplitBar'
import { Heatmap } from './charts/Heatmap'
import { EngagementCurve } from './charts/EngagementCurve'
import { ReplyDistribution } from './charts/ReplyDistribution'
import { PowerGauge } from './charts/PowerGauge'
import { useTokenState } from '../tokens/store'

interface Props {
  facts: HardFacts
  onStartAi?: () => void
  onOpenTokens?: () => void
}

const PERSON_COLORS = ['text-a', 'text-b', 'text-blue-400', 'text-orange-400', 'text-violet-400']

export function HardFactsView({ facts, onStartAi, onOpenTokens }: Props) {
  const interpretations = interpretHardFacts(facts)
  const shareInterp = interpretations.find((i) => i.metric === 'share')
  const deltaInterp = interpretations.find((i) => i.metric === 'delta')
  const { balance } = useTokenState()
  const personA = facts.perPerson[0]?.author ?? 'Person A'
  const personB = facts.perPerson[1]?.author ?? 'Person B'

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 pb-32 pt-12 space-y-16">
      {/* Opener */}
      <header className="space-y-6">
        <div className="label-mono text-a">Modul 01 · Hard Facts · Lokal</div>
        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
          Was die Zahlen <span className="italic text-ink-muted">sagen.</span>
        </h2>
        <p className="serif-body text-lg md:text-xl text-ink-muted max-w-2xl">
          {facts.totalMessages.toLocaleString('de-DE')} Nachrichten über {facts.durationDays} Tage zwischen{' '}
          {facts.perPerson.map((p) => p.author).join(' und ')}. Jede Zahl hier wurde in deinem Browser berechnet —
          nichts wurde übertragen.
        </p>
      </header>

      {/* Topline grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Tile
          label="Nachrichten"
          value={<CountUp value={facts.totalMessages} format={(n) => Math.round(n).toLocaleString('de-DE')} />}
        />
        <Tile
          label="Wörter"
          value={<CountUp value={facts.totalWords} format={(n) => Math.round(n).toLocaleString('de-DE')} />}
        />
        <Tile
          label="Aktive Tage"
          value={<CountUp value={facts.activeDays} format={(n) => Math.round(n).toLocaleString('de-DE')} />}
        />
        <Tile
          label="Emojis"
          value={<CountUp value={facts.totalEmojis} format={(n) => Math.round(n).toLocaleString('de-DE')} />}
        />
      </section>

      {/* Split: message distribution */}
      <Section
        kicker="01 · Verteilung"
        title="Wer schreibt mehr?"
        body={shareInterp?.body}
      >
        <SplitBar perPerson={facts.perPerson} metric="share" label="Nachrichtenanteil" />
        <div className="mt-10">
          <SplitBar perPerson={facts.perPerson} metric="words" label="Wortanteil" />
        </div>
      </Section>

      {/* Response times */}
      <Section
        kicker="02 · Geschwindigkeit"
        title="Wer reagiert wie schnell?"
        body={interpretations.find((i) => i.metric.startsWith('reply:'))?.body}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-10">
          {facts.perPerson.map((p, i) => (
            <Tile
              key={p.author}
              label={`${p.author} · Median`}
              accent={PERSON_COLORS[i % PERSON_COLORS.length]}
              value={formatDuration(p.medianReplyMs)}
            />
          ))}
          {facts.perPerson.length === 2 && <div className="hidden md:block" />}
        </div>
        <ReplyDistribution perPerson={facts.perPerson} />
      </Section>

      {/* Initiation & questions */}
      <Section
        kicker="03 · Initiative"
        title="Wer denkt an den anderen?"
        body={interpretations.find((i) => i.metric.startsWith('init:'))?.body}
      >
        <SplitBar
          perPerson={facts.perPerson}
          metric="initiation"
          label={`Initiierungen nach Stille · ${facts.perPerson.reduce((s, p) => s + p.initiations, 0)} gesamt`}
        />
        <div className="mt-10 grid md:grid-cols-2 gap-4">
          {facts.perPerson.map((p, i) => (
            <div key={p.author} className="bg-bg-surface rounded-xl p-5">
              <div className="label-mono mb-1">Fragen</div>
              <div className="flex items-baseline gap-3">
                <span className={`metric-num text-3xl ${PERSON_COLORS[i % PERSON_COLORS.length]}`}>
                  {(p.questionRatio * 100).toFixed(0)}%
                </span>
                <span className="font-sans text-sm text-ink-muted">der Nachrichten · {p.author}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Hedges & emoji */}
      <Section
        kicker="04 · Sprachliche Signale"
        title="Hedges, Emojis, Nachrichtenlänge"
        body={interpretations.find((i) => i.metric.startsWith('hedge:'))?.body ?? interpretations.find((i) => i.metric.startsWith('emoji:'))?.body}
      >
        <div className="grid md:grid-cols-2 gap-4">
          {facts.perPerson.map((p, i) => (
            <div key={p.author} className="bg-bg-surface rounded-xl p-6 space-y-5">
              <div className={`font-sans ${PERSON_COLORS[i % PERSON_COLORS.length]}`}>{p.author}</div>
              <MiniRow label="Ø Wörter / Nachricht" value={p.avgWords.toFixed(1)} />
              <MiniRow label="Hedge-Wörter" value={`${(p.hedgeRatio * 100).toFixed(0)}%`} />
              <MiniRow label="Emojis / Nachricht" value={p.emojiPerMsg.toFixed(2)} />
              {p.topEmojis.length > 0 && (
                <div>
                  <div className="label-mono mb-2">Top-Emojis</div>
                  <div className="flex gap-3 text-2xl">
                    {p.topEmojis.map((e) => (
                      <span key={e.emoji} title={`${e.count}×`}>
                        {e.emoji}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Heatmap */}
      <Section
        kicker="05 · Rhythmus"
        title="Wann wird geschrieben?"
        body={`Peak-Tag: ${fmtDayKey(facts.peakDay.date)} mit ${facts.peakDay.count} Nachrichten. Aktivität an ${facts.activeDays} von ${facts.durationDays} Tagen.`}
      >
        <Heatmap matrix={facts.heatmap} />
      </Section>

      {/* Engagement curve */}
      <Section
        kicker="06 · Verlauf"
        title="Engagement über Zeit"
        body="Jede Zeile ein Monat, jeder Peak ein Wochenende an dem nicht geschlafen wurde. Wächst die Kommunikation, ist sie stabil, oder kühlt sie ab?"
      >
        <EngagementCurve facts={facts} />
      </Section>

      {/* Power score */}
      <Section
        kicker="07 · Investment-Delta"
        title="Principle of Least Interest"
        body={
          deltaInterp?.body ??
          'Der Power Score kombiniert Volumen, Initiierung und Antwortgeschwindigkeit. Höherer Wert = weniger Investment = mehr relationale Macht. Kein moralisches Urteil, nur ein numerisches Delta.'
        }
      >
        <PowerGauge perPerson={facts.perPerson} />
      </Section>

      {/* Lock gallery — what's still hidden */}
      <section className="relative mt-24 space-y-10">
        <div className="space-y-5">
          <div className="label-mono text-b">Noch nicht entschlüsselt</div>
          <h3 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
            Das Skelett.
            <br />
            <span className="italic text-ink-muted">Fünf Module. Ein Klick.</span>
          </h3>
          <p className="serif-body text-lg md:text-xl text-ink-muted max-w-2xl">
            Die Zahlen oben sind die Haut. Darunter liegt das, was du eigentlich wissen willst — wer {personA} und{' '}
            {personB} wirklich sind, was zwischen euch läuft, und welche Momente alles erklären.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <LockedCard
            number="02"
            tone="a"
            title="Persönliche Profile"
            subtitle="Horney · Berne · Bowlby · Adler · Goffman"
            lines={[
              `${personA} operiert aus dem angepassten Kind-Ich. Die Hedge-Rate von ${((facts.perPerson[0]?.hedgeRatio ?? 0) * 100).toFixed(0)}% deutet auf …`,
              `${personB}: Bindungsstil-Tendenz ängstlich-ambivalent. Das Muster zeigt sich in …`,
              `Goffman-Moment bei ${personA}: Wenn die Fassade bricht, dann meistens nach …`,
            ]}
          />
          <LockedCard
            number="03"
            tone="a"
            title="Beziehungsebene"
            subtitle="Machtgefälle · Cialdini · Ungeschriebene Regeln"
            lines={[
              `Investment-Delta: ${personA} investiert strukturell mehr als ${personB}. Die Asymmetrie liegt bei …`,
              `Unausgesprochene Regel #1: Wir reden nicht über …`,
              `Dominante Cialdini-Taktik zwischen euch: Reciprocity. Wirkung: …`,
            ]}
          />
          <LockedCard
            number="04"
            tone="a"
            title="Entwicklung"
            subtitle="Phasen · Kipppunkte · thematische Drift"
            lines={[
              'Phase 1 „Kalibrierung" (Monat 1–3): Hohe Symmetrie, spielerischer Ton …',
              `Kipppunkt am 14. März: Antwortzeiten brechen von 12 Min auf 4 Std. Auslöser …`,
              'Aktuelle Phase: Abkühlung. Merkmale …',
            ]}
          />
          <LockedCard
            number="05"
            tone="b"
            title="Highlights"
            subtitle="Die Momente, die bleiben"
            lines={[
              `„Ich glaub ich bin grad zu viel" — ${personA} um 23:41. Verletzlichkeit. Dekodierung: …`,
              `Ignorierte Nachricht von ${personB}: 47 Stunden Schweigen. Das Schweigen ist das Signal …`,
              'Goffman-Moment: Die Fassade bricht um 2:14 Uhr. Grund …',
            ]}
            featured
          />
          <LockedCard
            number="06"
            tone="a"
            title="Timeline"
            subtitle="Die Beziehung auf einer Achse"
            lines={[
              'Emotionale Temperatur-Kurve von 8.2 (Peak Februar) auf 3.1 (aktuell) …',
              'Phasen-Overlay: 4 erkennbare Kapitel, davon 2 mit klaren Markern …',
              'Shareworthy: 1 Bild, das eure ganze Beziehung zusammenfasst …',
            ]}
            className="md:col-span-2"
          />
        </div>

        {/* Social proof + scarcity pokes */}
        <div className="flex flex-wrap gap-6 justify-center text-center pt-4">
          <FomoPoke kicker="Ø Erkenntnisse" value="23" body="pro Komplett-Analyse" />
          <FomoPoke kicker="Dauer" value="~90s" body="komplett dekodiert" />
          <FomoPoke kicker="Modelle" value="Claude 4.6" body="Opus für Highlights" />
        </div>

        {/* The CTA block — balance + actions */}
        <div className="card relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-b/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-a/10 blur-3xl pointer-events-none" />

          <div className="relative grid md:grid-cols-[1fr_auto] gap-8 items-center">
            <div>
              <div className="label-mono text-b mb-3">Jetzt freischalten</div>
              <h4 className="font-serif text-3xl md:text-4xl leading-tight mb-3">
                Alle 5 Module für <span className="text-a">5 Tokens</span>.
              </h4>
              <p className="serif-body text-base md:text-lg text-ink-muted max-w-md mb-5">
                Jedes AI-Modul kostet genau einen Token. Jedes einzeln. Kein Abo, kein Zwang, keine Überraschungen.
              </p>
              <div className="flex items-baseline gap-2 mb-1">
                <span className={`font-mono text-2xl tabular-nums ${balance === 0 ? 'text-b' : 'text-a'}`}>
                  {balance}
                </span>
                <span className="label-mono text-ink-muted">
                  {balance === 1 ? 'Token verfügbar' : 'Tokens verfügbar'}
                </span>
              </div>
              {balance === 0 && (
                <div className="label-mono text-b animate-pulse-soft">⚠ Guthaben leer — jetzt nachladen</div>
              )}
              {balance > 0 && balance < 5 && (
                <div className="label-mono text-ink-faint">
                  Reicht für {balance} von 5 Modulen · {5 - balance} fehlen für alles
                </div>
              )}
              {balance >= 5 && (
                <div className="label-mono text-a">Reicht für alle 5 Module · Du kannst direkt starten</div>
              )}
            </div>

            <div className="flex flex-col gap-3 md:min-w-[240px]">
              {onStartAi && (
                <button
                  onClick={onStartAi}
                  disabled={balance < 1}
                  className="w-full px-6 py-4 bg-ink text-bg rounded-full font-sans font-medium text-base hover:bg-a hover:text-bg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-ink disabled:hover:text-bg"
                >
                  Analyse starten <span className="label-mono ml-1 text-bg/60">1 Token</span>
                </button>
              )}
              {onOpenTokens && (
                <button
                  onClick={onOpenTokens}
                  className={`w-full px-6 py-4 rounded-full font-sans font-medium text-base transition-colors ${
                    balance === 0
                      ? 'bg-b text-bg hover:bg-b/90'
                      : 'border border-line text-ink hover:border-a hover:text-a'
                  }`}
                >
                  {balance === 0 ? 'Tokens kaufen' : 'Tokens nachladen'}
                </button>
              )}
            </div>
          </div>

          <div className="relative mt-8 pt-6 border-t border-line/40 flex flex-wrap gap-4 items-center justify-between">
            <div className="label-mono text-ink-faint">
              Willkommens-Guthaben: 3 Tokens · Hard Facts bleiben gratis
            </div>
            <div className="label-mono text-ink-faint">Tab zu = weg · Kein Account · Keine E-Mail</div>
          </div>
        </div>
      </section>
    </div>
  )
}

function LockedCard({
  number,
  title,
  subtitle,
  lines,
  tone,
  featured,
  className,
}: {
  number: string
  title: string
  subtitle: string
  lines: string[]
  tone: 'a' | 'b'
  featured?: boolean
  className?: string
}) {
  const accent = tone === 'a' ? 'text-a' : 'text-b'
  const glow = tone === 'a' ? 'bg-a/10' : 'bg-b/15'
  const borderHover = tone === 'a' ? 'hover:border-a/50' : 'hover:border-b/50'

  return (
    <article
      className={`group card relative overflow-hidden transition-colors ${borderHover} ${
        featured ? 'border-b/30' : ''
      } ${className ?? ''}`}
    >
      <div
        className={`absolute -top-20 -right-20 w-56 h-56 rounded-full ${glow} blur-3xl pointer-events-none opacity-70 group-hover:opacity-100 transition-opacity`}
      />

      <header className="relative flex items-baseline justify-between mb-4">
        <div className="flex items-baseline gap-3">
          <span className={`label-mono ${accent}`}>Modul {number}</span>
          <span className="label-mono text-ink-faint hidden md:inline">·</span>
          <span className="label-mono text-ink-muted hidden md:inline">{subtitle}</span>
        </div>
        <div className="label-mono text-ink-faint flex items-center gap-1.5">
          <LockIcon />
          <span className={accent}>1 Token</span>
        </div>
      </header>

      <h4 className="font-serif text-2xl md:text-3xl leading-tight mb-1">{title}</h4>
      <p className="label-mono text-ink-muted mb-5 md:hidden">{subtitle}</p>

      <div className="relative">
        <div className="select-none pointer-events-none space-y-2.5 font-serif text-base text-ink-muted blur-[4px]">
          {lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg-raised/40 to-bg-raised" />
      </div>

      <div className="relative mt-4 pt-4 border-t border-line/40 flex items-center justify-between">
        <span className="label-mono text-ink-faint">
          Bereit zum Freischalten
        </span>
        <span className={`label-mono ${accent} opacity-0 group-hover:opacity-100 transition-opacity`}>
          Hover · {title} →
        </span>
      </div>
    </article>
  )
}

function LockIcon() {
  return (
    <svg width="10" height="12" viewBox="0 0 10 12" fill="none" className="inline-block">
      <path
        d="M2 5V3a3 3 0 0 1 6 0v2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <rect x="1" y="5" width="8" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="5" cy="8" r="0.8" fill="currentColor" />
    </svg>
  )
}

function FomoPoke({ kicker, value, body }: { kicker: string; value: string; body: string }) {
  return (
    <div className="space-y-1">
      <div className="label-mono text-ink-faint">{kicker}</div>
      <div className="font-serif text-3xl text-ink tracking-tight">{value}</div>
      <div className="label-mono text-ink-muted">{body}</div>
    </div>
  )
}

function Section({
  kicker,
  title,
  body,
  children,
}: {
  kicker: string
  title: string
  body?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-6">
      <div>
        <div className="label-mono text-a mb-3">{kicker}</div>
        <h3 className="font-serif text-2xl md:text-4xl leading-tight tracking-tight">{title}</h3>
      </div>
      <div className="card">{children}</div>
      {body && <p className="serif-body text-lg md:text-xl text-ink-muted max-w-2xl leading-snug">{body}</p>}
    </section>
  )
}

function Tile({
  label,
  value,
  accent,
}: {
  label: string
  value: React.ReactNode
  accent?: string
}) {
  return (
    <div className="bg-bg-raised border border-line/60 rounded-xl p-5">
      <div className="label-mono mb-2">{label}</div>
      <div className={`text-3xl md:text-4xl metric-num ${accent ?? 'text-ink'}`}>{value}</div>
    </div>
  )
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line/40 pb-2">
      <span className="label-mono">{label}</span>
      <span className="metric-num text-lg">{value}</span>
    </div>
  )
}

function fmtDayKey(key: string): string {
  if (!key) return '—'
  const [y, m, d] = key.split('-')
  return `${d}.${m}.${y.slice(2)}`
}
