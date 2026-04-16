import type { HardFacts } from '../analysis/hardFacts'
import { formatDuration } from '../analysis/hardFacts'
import { interpretHardFacts } from '../analysis/interpretation'
import { CountUp } from './CountUp'
import { SplitBar } from './charts/SplitBar'
import { Heatmap } from './charts/Heatmap'
import { EngagementCurve } from './charts/EngagementCurve'
import { ReplyDistribution } from './charts/ReplyDistribution'
import { PowerGauge } from './charts/PowerGauge'

interface Props {
  facts: HardFacts
  onStartAi?: () => void
}

const PERSON_COLORS = ['text-a', 'text-b', 'text-blue-400', 'text-orange-400', 'text-violet-400']

export function HardFactsView({ facts, onStartAi }: Props) {
  const interpretations = interpretHardFacts(facts)
  const shareInterp = interpretations.find((i) => i.metric === 'share')
  const deltaInterp = interpretations.find((i) => i.metric === 'delta')

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

      {/* Paywall teaser */}
      <section className="relative mt-24">
        <div className="card relative overflow-hidden">
          <div className="label-mono text-b mb-3">Modul 02–06 · AI-Analyse</div>
          <h3 className="font-serif text-3xl md:text-5xl leading-tight mb-4">
            Die Zahlen sind die Haut.
            <br />
            <span className="italic text-ink-muted">Das Skelett kommt jetzt.</span>
          </h3>
          <p className="serif-body text-lg text-ink-muted max-w-xl mb-8">
            Persönliche Profile nach Horney, Berne, Bowlby, Adler, Goffman. Beziehungsdynamik. Entwicklung über Zeit.
            Die psychologisch signifikantesten Momente in deinem Chat.
          </p>

          <div className="relative">
            <div className="filter blur-md select-none pointer-events-none space-y-3 font-serif text-lg text-ink-muted">
              <p>
                {facts.perPerson[0]?.author} operiert überwiegend aus dem Erwachsenen-Ich (Berne), mit einer moderaten
                Tendenz zur Nähe-Suche (Horney). Die Hedge-Rate von {(facts.perPerson[0]?.hedgeRatio * 100).toFixed(0)}%
                deutet auf …
              </p>
              <p>
                Bindungsstil-Tendenz: ängstlich-ambivalent. Das Muster zeigt sich in der asymmetrischen
                Antwortgeschwindigkeit und …
              </p>
              <p>
                Die Beziehung folgt einem Kompensationsmuster nach Adler: {facts.perPerson[1]?.author} reagiert auf …
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg-raised/70 to-bg-raised" />
          </div>

          {onStartAi ? (
            <button
              onClick={onStartAi}
              className="mt-8 inline-flex items-center gap-3 px-6 py-4 bg-ink text-bg rounded-full font-sans font-medium text-base hover:bg-a transition-colors"
            >
              AI-Analyse starten
              <span className="label-mono text-bg/60">Demo · €0</span>
            </button>
          ) : (
            <button
              disabled
              className="mt-8 inline-flex items-center gap-3 px-6 py-3 bg-ink/10 text-ink-muted rounded-full font-sans font-medium text-sm cursor-not-allowed"
            >
              AI-Analyse freischalten · €4,99
              <span className="text-xs">(bald)</span>
            </button>
          )}
        </div>
      </section>
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
