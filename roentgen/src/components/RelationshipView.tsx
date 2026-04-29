import { useState } from 'react'
import type {
  AttachmentDyad,
  BidResponse,
  DemandWithdraw,
  Horseman,
  RelationshipResult,
  Zitat,
} from '../ai/types'
import { SafetyBanner } from './SafetyBanner'
import { AiDisclosure } from './AiDisclosure'
import { t, useLocale, type Locale } from '../i18n'

interface Props {
  result: RelationshipResult
  participants: string[]
  onBack?: () => void
  onRerun?: () => void
}

type PersonColor = {
  text: string
  bg: string
  border: string
  dim: string
  glow: string
  soft: string
}

const PERSON_COLORS: PersonColor[] = [
  { text: 'text-a', bg: 'bg-a', border: 'border-a', dim: 'text-a/60', glow: 'bg-a/10', soft: 'bg-a/20' },
  { text: 'text-b', bg: 'bg-b', border: 'border-b', dim: 'text-b/60', glow: 'bg-b/10', soft: 'bg-b/20' },
  {
    text: 'text-blue-400',
    bg: 'bg-blue-400',
    border: 'border-blue-400',
    dim: 'text-blue-400/60',
    glow: 'bg-blue-400/10',
    soft: 'bg-blue-400/20',
  },
  {
    text: 'text-orange-400',
    bg: 'bg-orange-400',
    border: 'border-orange-400',
    dim: 'text-orange-400/60',
    glow: 'bg-orange-400/10',
    soft: 'bg-orange-400/20',
  },
]

const NEUTRAL: PersonColor = {
  text: 'text-ink',
  bg: 'bg-ink-faint',
  border: 'border-line',
  dim: 'text-ink-muted',
  glow: 'bg-line/20',
  soft: 'bg-line/30',
}

export function RelationshipView({ result, participants, onBack, onRerun }: Props) {
  const locale = useLocale()
  const r = (en: string, de: string) => (locale === 'de' ? de : en)
  const { payload } = result

  const colorFor = (name: string): PersonColor => {
    const idx = participants.indexOf(name)
    if (idx === -1) return NEUTRAL
    return PERSON_COLORS[idx % PERSON_COLORS.length]
  }

  // Sanity: if the model returned a truncated / incomplete payload, fall back
  // to a graceful "retry" panel instead of crashing the render.
  const missingSections = collectMissingSections(payload)
  if (missingSections.length > 0) {
    return (
      <div className="max-w-3xl mx-auto px-5 md:px-8 pt-12 pb-24 space-y-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">
          → {r('incomplete response', 'unvollständige antwort')}
        </div>
        <h2 className="font-serif text-5xl md:text-7xl leading-[0.92] tracking-tight">
          {r('ANALYSIS WAS CUT SHORT.', 'ANALYSE WURDE ABGESCHNITTEN.')}
        </h2>
        <p className="serif-body text-lg text-ink-muted max-w-2xl">
          {r(
            'The model returned an incomplete payload. Missing sections: ',
            'Das Modell hat eine unvollständige Antwort geliefert. Fehlende Abschnitte: ',
          )}
          <span className="serif-body italic">
            {missingSections.map((k) => missingSectionLabel(k, locale)).join(', ')}
          </span>
          .
          <br />
          {r(
            'Run it again — usually works on the second try. If it keeps failing, set a bigger model via env (',
            'Nochmal starten — klappt meist beim zweiten Versuch. Wenn es weiter fehlschlägt, ein größeres Modell per env setzen (',
          )}
          <span className="font-mono text-xs">VITE_ROENTGEN_MODEL=claude-sonnet-4-6</span>
          ).
        </p>
        {onBack && (
          <button onClick={onBack} className="btn-pop">
            {r('← back', '← zurück')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 pt-12 pb-24 space-y-14">
      <header className="space-y-6 relative">
        {onRerun && (
          <button
            onClick={onRerun}
            className="absolute top-0 right-0 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/60 hover:text-ink underline underline-offset-4 decoration-dotted"
          >
            ↻ {t('rerun.cta', locale, { lang: t(`rerun.lang.${locale}`, locale) })}
          </button>
        )}
        <AiDisclosure />
        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
          {locale === 'de' ? (
            <>Was läuft da eigentlich <span className="italic text-ink-muted">zwischen euch.</span></>
          ) : (
            <>What's actually going on <span className="italic text-ink-muted">between you.</span></>
          )}
        </h2>
        <p className="serif-body text-lg md:text-xl text-ink-muted max-w-2xl">
          {r(
            "Not who you are solo — what the two of you do together. Sync, fight, lean in, ghost. All of it.",
            'Nicht wer ihr einzeln seid — was ihr zu zweit macht. Syncen, streiten, annähern, wegdriften. Alles.',
          )}
        </p>
      </header>

      {payload.safety_flag?.aktiv && payload.safety_flag?.beschreibung && (
        <SafetyBanner pattern={payload.safety_flag.beschreibung} />
      )}

      <blockquote className="relative font-serif italic text-2xl md:text-4xl leading-snug text-ink pl-6 border-l-2 border-b">
        "{payload.kern_insight}"
      </blockquote>

      {/* 01 — Coupling. Meter tiles (0-100% sync/rhythm/lexicon) removed — the
          percentages felt made-up and clinical. Prose + quotes carry the read. */}
      <Section kicker={r('01 · Connection', '01 · Ankommen')} title={r("Is anything actually landing?", 'Kommt überhaupt was an?')} framework="">
        <Prose>{payload.kopplung.interpretation}</Prose>
        <Evidence zitate={payload.kopplung.zitate} colorFor={colorFor} locale={locale} />
      </Section>

      {/* 02 — Power structure 3D */}
      <Section
        kicker={r('02 · Who runs it', '02 · Wer hat den Hut auf')}
        title={r('Who runs the show — and who sets the mood?', 'Wer macht die Ansage — und wer bestimmt die Stimmung?')}
        framework=""
      >
        <div className="grid md:grid-cols-3 gap-3 mb-6">
          <LeadCard
            label={r('Topics', 'Themen')}
            sublabel={r('Who brings stuff up?', 'Wer bringt die Themen rein?')}
            lead={leadLabel(payload.machtstruktur.inhalt_lead, locale)}
            colorFor={colorFor}
          />
          <LeadCard
            label={r('Pace', 'Tempo')}
            sublabel={r('Who sets the pace?', 'Wer gibt das Tempo vor?')}
            lead={leadLabel(payload.machtstruktur.prozess_lead, locale)}
            colorFor={colorFor}
          />
          <LeadCard
            label={r('Mood', 'Stimmung')}
            sublabel={r("Whose feelings run the room?", 'Wessen Gefühl bestimmt den Raum?')}
            lead={leadLabel(payload.machtstruktur.affekt_lead, locale)}
            colorFor={colorFor}
          />
        </div>
        {/* Asymmetry bar (0-100 with a draggable-looking marker) dropped —
            "who leads" is already in the three Lead cards above. */}
        <Prose>{payload.machtstruktur.interpretation}</Prose>
        <Evidence zitate={payload.machtstruktur.zitate} colorFor={colorFor} locale={locale} />
      </Section>

      {/* 03 — Attachment dyad. "How sure" confidence tag removed. */}
      <Section
        kicker={r('03 · Close & far', '03 · Nähe & Distanz')}
        title={dyadLabel(payload.bindungsdyade.konstellation, locale)}
        framework=""
      >
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          <InfoBlock label={r('What this combo does to you two', 'Was diese Kombi mit euch macht')}>
            {payload.bindungsdyade.dyaden_beschreibung}
          </InfoBlock>
          <InfoBlock label={r('Where it usually gets stuck', 'Wo es typischerweise hakt')} tone="warn">
            {payload.bindungsdyade.dyaden_risiko}
          </InfoBlock>
        </div>
        <Prose>{payload.bindungsdyade.interpretation}</Prose>
        <Evidence zitate={payload.bindungsdyade.zitate} colorFor={colorFor} locale={locale} />
      </Section>

      {/* 04 — Bids */}
      <Section
        kicker={r('04 · Little throws', '04 · Kleine Signale')}
        title={r('How attention gets thrown — and how it lands', 'Wie Aufmerksamkeit rübergeht — und wie sie ankommt')}
        framework=""
        tag={bidResponseLabel(payload.bids.dominante_response, locale)}
      >
        {/* Per-person bid stats. Drop the frequency level (selten/mittel/hoch)
            — it's vague. Keep the response-pattern because it has narrative
            value (turning_toward/away/against). */}
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          {payload.bids.pro_person.map((p) => {
            const c = colorFor(p.person)
            return (
              <div key={p.person} className="bg-bg-surface/70 border border-line/50 rounded-xl p-5 space-y-2">
                <div className={`label-mono ${c.text}`}>{p.person}</div>
                <div className="serif-body text-lg text-ink">
                  {bidResponseLabel(p.antwort_signatur, locale)}
                </div>
              </div>
            )
          })}
        </div>

        <div className="space-y-3 mb-6">
          {payload.bids.beispiele.map((b, i) => (
            <BidPair key={i} bid={b.bid} antwort={b.antwort} klasse={b.klasse} colorFor={colorFor} locale={locale} />
          ))}
        </div>
        <Prose>{payload.bids.interpretation}</Prose>
      </Section>

      {/* 05 — Repair */}
      <Section
        kicker={r('05 · Patching up', '05 · Wieder glatt ziehen')}
        title={payload.repair.hat_repair
          ? r('Fights get patched up.', 'Streit wird wieder glatt gezogen.')
          : r('Something stays hanging after a fight.', 'Nach dem Streit bleibt was hängen.')}
        framework=""
      >
        {/* "How often it lands" tile (hoch/mittel/niedrig) removed — reads
            as a grade, which is exactly the clinical vibe we're cutting. */}
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          <InfoBlock label={r('Who takes the first step', 'Wer den ersten Schritt macht')}>
            {payload.repair.wer_repariert.length === 0
              ? '—'
              : payload.repair.wer_repariert.map((p) => (
                  <span key={p} className={`font-serif text-xl ${colorFor(p).text}`}>
                    {p}
                  </span>
                ))}
          </InfoBlock>
          <InfoBlock label={r('How it usually goes', 'Wie es meist läuft')}>{payload.repair.typische_form}</InfoBlock>
        </div>
        <Prose>{payload.repair.interpretation}</Prose>
        <Evidence zitate={payload.repair.zitate} colorFor={colorFor} locale={locale} />
      </Section>

      {/* 06 — Conflict signature */}
      <Section
        kicker={r('06 · How you fight', '06 · Wie ihr streitet')}
        title={r('How tension actually shows up.', 'Wie die Spannung bei euch rauskommt.')}
        framework=""
      >
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          {payload.konflikt_signatur.four_horsemen_pro_person.map((p) => {
            const c = colorFor(p.person)
            return (
              <div key={p.person} className="bg-bg-surface/70 border border-line/50 rounded-xl p-5">
                <div className={`label-mono mb-3 ${c.text}`}>{p.person}</div>
                <HorsemenPanel praesenz={p.praesenz} dominierend={p.dominierend} locale={locale} />
              </div>
            )
          })}
        </div>

        <div className="bg-bg-surface/50 border border-line/40 rounded-xl p-5 mb-6">
          <div className="label-mono mb-2">{r('Who pushes, who shuts down', 'Wer drängt, wer macht dicht')}</div>
          <div className="font-serif text-2xl">{demandWithdrawLabel(payload.konflikt_signatur.demand_withdraw, participants, locale)}</div>
        </div>

        {payload.konflikt_signatur.flooding_hinweise.length > 0 && (
          <div className="mb-6 space-y-2">
            <div className="label-mono">{r("When it's just too much", "Wenn's zu viel wird")}</div>
            {payload.konflikt_signatur.flooding_hinweise.map((f, i) => {
              const c = colorFor(f.person)
              return (
                <div key={i} className={`pl-3 border-l ${c.border.replace('border-', 'border-')} text-ink`}>
                  <span className={`label-mono mr-2 ${c.text}`}>{f.person}</span>
                  <span className="serif-body text-base">{f.hinweis}</span>
                </div>
              )
            })}
          </div>
        )}

        <Prose>{payload.konflikt_signatur.interpretation}</Prose>
        <Evidence zitate={payload.konflikt_signatur.zitate} colorFor={colorFor} locale={locale} />
      </Section>

      {/* 07 — Mentalization */}
      <Section
        kicker={r('07 · Reading each other', '07 · Einander lesen')}
        title={r("Can they actually get what's going on over there?", 'Kriegen die beiden wirklich mit, was auf der anderen Seite los ist?')}
        framework=""
      >
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          {payload.mentalisierung.pro_person.map((p) => {
            const c = colorFor(p.person)
            return (
              <div key={p.person} className="bg-bg-surface/70 border border-line/50 rounded-xl p-5">
                <div className={`label-mono mb-2 ${c.text}`}>{p.person}</div>
                <div className="font-serif text-2xl mb-3">{mentalisierungLabel(p.qualitaet, locale)}</div>
                <p className="serif-body text-base text-ink-muted">{p.beschreibung}</p>
              </div>
            )
          })}
        </div>
        <div className="bg-bg-surface/50 border border-line/40 rounded-xl p-5 mb-6">
          <div className="label-mono mb-2">{r("When you're just making up what the other one thinks", 'Wenn du dir ausmalst was die andere Seite denkt')}</div>
          <p className="serif-body text-base text-ink">{payload.mentalisierung.projektion_statt_modellierung}</p>
        </div>
        <Prose>{payload.mentalisierung.interpretation}</Prose>
        <Evidence zitate={payload.mentalisierung.zitate} colorFor={colorFor} locale={locale} />
      </Section>

      {/* 08 — Meta-communication */}
      <Section
        kicker={r('08 · Talking about you two', '08 · Über euch reden')}
        title={metaLabel(payload.meta_kommunikation.kapazitaet, locale)}
        framework=""
      >
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          <InfoBlock label={r('Who brings it up', 'Wer es anspricht')}>
            <span className={`font-serif text-xl ${colorFor(payload.meta_kommunikation.initiator).text}`}>
              {payload.meta_kommunikation.initiator}
            </span>
          </InfoBlock>
          <InfoBlock label={r('How it gets dodged', 'Wie es umschifft wird')} tone="warn">
            {payload.meta_kommunikation.blocker_muster}
          </InfoBlock>
        </div>
        <Prose>{payload.meta_kommunikation.interpretation}</Prose>
        <Evidence zitate={payload.meta_kommunikation.zitate} colorFor={colorFor} locale={locale} />
      </Section>

      {/* 09 — Double-meaning messages */}
      <Section
        kicker={r('09 · Between the lines', '09 · Zwischen den Zeilen')}
        title={berneModusLabel(payload.berne.dominanter_modus, locale)}
        framework=""
      >
        <div className="space-y-3 mb-6">
          {payload.berne.ulterior_transactions.map((t, i) => (
            <article key={i} className="bg-bg-surface/70 border border-line/50 rounded-xl p-5 space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <div className="label-mono mb-1">{r("What's said", 'Was gesagt wird')}</div>
                  <div className="serif-body text-base text-ink">{t.sozial}</div>
                </div>
                <div>
                  <div className="label-mono mb-1 text-b">{r("What's actually meant", 'Was eigentlich gemeint ist')}</div>
                  <div className="serif-body text-base text-ink">{t.psychologisch}</div>
                </div>
              </div>
              <SingleQuote zitat={t.beispiel} colorFor={colorFor} />
            </article>
          ))}
        </div>

        {payload.berne.games.length > 0 && (
          <div className="space-y-3 mb-6">
            <div className="label-mono">{r('Stuff that keeps happening', 'Das läuft immer wieder so')}</div>
            {payload.berne.games.map((g, i) => (
              <article key={i} className="bg-bg-surface/70 border border-line/50 rounded-xl p-5">
                <div className="font-serif text-xl mb-1">"{g.name}"</div>
                <p className="serif-body text-base text-ink-muted mb-3">{g.funktion}</p>
                <SingleQuote zitat={g.beispiel} colorFor={colorFor} />
              </article>
            ))}
          </div>
        )}
        <Prose>{payload.berne.interpretation}</Prose>
      </Section>

      {/* 10 — Unspoken rules */}
      <Section kicker={r('10 · Unspoken rules', '10 · Ungesagte Regeln')} title={r('Rules nobody ever said out loud.', 'Regeln die nie jemand laut gesagt hat.')}>
        <div className="space-y-3 mb-6">
          {payload.unausgesprochene_regeln.regeln.map((rule, i) => (
            <article key={i} className="bg-bg-surface/70 border border-line/50 rounded-xl p-5">
              <div className="font-serif text-xl md:text-2xl mb-2">"{rule.regel}"</div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <div className="label-mono mb-1">{r('What the rule does', 'Was die Regel macht')}</div>
                  <div className="serif-body text-base text-ink-muted">{rule.funktion}</div>
                </div>
                <div>
                  <div className="label-mono mb-1">{r("Where you catch it in the chat", "Wo's im Chat rauskommt")}</div>
                  <div className="serif-body text-base text-ink-muted">{rule.evidenz}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
        <Prose>{payload.unausgesprochene_regeln.interpretation}</Prose>
      </Section>

      {onBack && (
        <div className="pt-8 border-t border-line/40">
          <button onClick={onBack} className="label-mono text-ink-muted hover:text-ink transition-colors">
            {r('← back to profiles', '← zurück zum profil')}
          </button>
        </div>
      )}

      <div className="text-center serif-body text-ink-muted italic pt-6 border-t border-line/40">
        "{r('One reading, not the truth. For real talk, see a pro.', 'Eine Lesart, nicht die Wahrheit. Für echte Fragen → zu einer Fachperson.')}"
      </div>
    </div>
  )
}

// --- Sub-components ---

function Section({
  kicker,
  title,
  framework,
  tag,
  children,
}: {
  kicker: string
  title: string
  framework?: string
  tag?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-6">
      <div>
        <div className="label-mono text-a mb-2">{kicker}</div>
        <h3 className="font-serif text-2xl md:text-4xl leading-tight tracking-tight">{title}</h3>
        {(framework || tag) && (
          <div className="flex items-baseline gap-3 mt-2 flex-wrap">
            {framework && <span className="label-mono text-ink-muted">{framework}</span>}
            {tag && (
              <span className="label-mono text-ink-muted border border-line/60 rounded-full px-2 py-0.5">{tag}</span>
            )}
          </div>
        )}
      </div>
      <div className="card">{children}</div>
    </section>
  )
}

// Prose with a magazine-style lead: split the interpretation into its
// first sentence (rendered as a big italic pull quote) and the rest
// (smaller body). Gives every section a typographic anchor so the eye
// has a place to land while scrolling — without that, the whole page
// reads as one undifferentiated wall of paragraphs.
function Prose({ children }: { children: React.ReactNode }) {
  if (typeof children !== 'string') {
    return <p className="serif-body text-lg md:text-xl text-ink leading-snug">{children}</p>
  }
  const text = children.trim()
  const cut = findFirstSentenceEnd(text)
  if (cut < 0) {
    return <p className="serif-body text-lg md:text-xl text-ink leading-snug">{text}</p>
  }
  const lead = text.slice(0, cut + 1).trim()
  const rest = text.slice(cut + 1).trim()
  return (
    <div className="space-y-3 pl-4 border-l-2 border-ink/30">
      <p className="font-serif italic text-2xl md:text-[28px] text-ink leading-[1.15] tracking-[-0.005em]">
        {lead}
      </p>
      {rest && (
        <p className="serif-body text-base md:text-lg text-ink/80 leading-snug">{rest}</p>
      )}
    </div>
  )
}

// Find the index of the first sentence-ending punctuation (`. ! ?`)
// followed by whitespace or end-of-string. We avoid splitting on
// abbreviations by requiring whitespace after the punctuation.
function findFirstSentenceEnd(text: string): number {
  for (let i = 0; i < text.length - 1; i++) {
    const c = text[i]
    if (c === '.' || c === '!' || c === '?') {
      const next = text[i + 1]
      if (next === ' ' || next === '\n') return i
    }
  }
  // Single-sentence text — return the last char so callers see one full block.
  if (/[.!?]$/.test(text)) return text.length - 1
  return -1
}

function Evidence({
  zitate,
  colorFor,
  locale,
}: {
  zitate: Zitat[] | undefined
  colorFor: (name: string) => PersonColor
  locale?: Locale
}) {
  const [open, setOpen] = useState(false)
  if (!zitate || zitate.length === 0) return null
  const label = locale === 'de' ? 'Direkt aus dem Chat' : 'Straight from the chat'
  return (
    <div className="mt-6 pt-4 border-t border-line/30">
      <button
        onClick={() => setOpen((v) => !v)}
        className="label-mono text-ink-muted hover:text-ink transition-colors flex items-center gap-2"
      >
        <span>{label} ({zitate.length})</span>
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2 animate-fade-in">
          {zitate.map((z, i) => (
            <SingleQuote key={i} zitat={z} colorFor={colorFor} />
          ))}
        </div>
      )}
    </div>
  )
}

function SingleQuote({ zitat, colorFor }: { zitat: Zitat; colorFor: (name: string) => PersonColor }) {
  const c = colorFor(zitat.person)
  return (
    <div className={`font-mono text-sm pl-3 border-l ${c.border}`}>
      <span className={`${c.text} mr-2`}>{zitat.person}:</span>
      <span className="text-ink-muted">"{zitat.text}"</span>
    </div>
  )
}

function LeadCard({
  label,
  sublabel,
  lead,
  colorFor,
}: {
  label: string
  sublabel: string
  lead: string
  colorFor: (name: string) => PersonColor
}) {
  const c = colorFor(lead)
  return (
    <div className="bg-bg-surface/70 border border-line/50 rounded-xl p-5">
      <div className="label-mono mb-1">{label}</div>
      <div className="font-mono text-[11px] text-ink-faint mb-3">{sublabel}</div>
      <div className={`font-serif text-2xl md:text-3xl ${c.text} leading-tight`}>{lead}</div>
    </div>
  )
}

function InfoBlock({
  label,
  tone,
  children,
}: {
  label: string
  tone?: 'warn'
  children: React.ReactNode
}) {
  const toneClass = tone === 'warn' ? 'border-b/40 bg-b/5' : 'border-line/50 bg-bg-surface/70'
  return (
    <div className={`border ${toneClass} rounded-xl p-5`}>
      <div className={`label-mono mb-2 ${tone === 'warn' ? 'text-b' : ''}`}>{label}</div>
      <div className="serif-body text-base text-ink">{children}</div>
    </div>
  )
}

function BidPair({
  bid,
  antwort,
  klasse,
  colorFor,
  locale,
}: {
  bid: Zitat
  antwort: Zitat
  klasse: BidResponse
  colorFor: (name: string) => PersonColor
  locale?: Locale
}) {
  const cb = colorFor(bid.person)
  const ca = colorFor(antwort.person)
  const toneClass =
    klasse === 'turning_toward'
      ? 'border-a/50 bg-a/5'
      : klasse === 'turning_away'
        ? 'border-line/60 bg-bg-surface/70'
        : 'border-b/50 bg-b/5'
  const headline = locale === 'de' ? 'Angebot → Reaktion' : 'Offer → response'
  return (
    <article className={`border ${toneClass} rounded-xl p-5 space-y-3`}>
      <div className="flex items-center justify-between gap-3">
        <span className="label-mono">{headline}</span>
        <span className="label-mono text-ink-muted border border-line/60 rounded-full px-2 py-0.5">
          {bidResponseLabel(klasse, locale)}
        </span>
      </div>
      <div className={`font-mono text-sm pl-3 border-l ${cb.border}`}>
        <span className={`${cb.text} mr-2`}>{bid.person}:</span>
        <span className="text-ink">"{bid.text}"</span>
      </div>
      <div className={`font-mono text-sm pl-3 border-l ${ca.border}`}>
        <span className={`${ca.text} mr-2`}>{antwort.person}:</span>
        <span className="text-ink-muted">"{antwort.text}"</span>
      </div>
    </article>
  )
}

function HorsemenPanel({
  praesenz,
  dominierend,
  locale,
}: {
  praesenz: Horseman[]
  dominierend: Horseman | null
  locale?: Locale
}) {
  const ALL: Horseman[] = ['kritik', 'verachtung', 'abwehr', 'stonewalling']
  if (praesenz.length === 0) {
    return (
      <div className="font-serif text-xl text-ink-muted">
        {locale === 'de' ? 'Keines der vier Warnzeichen sichtbar.' : 'None of the four warning signs visible.'}
      </div>
    )
  }
  return (
    <div className="flex flex-wrap gap-2">
      {ALL.map((h) => {
        const present = praesenz.includes(h)
        const dom = dominierend === h
        const base = 'label-mono rounded-full px-3 py-1 border'
        const cls = dom
          ? `${base} bg-b text-bg border-b`
          : present
            ? `${base} border-b/60 text-b`
            : `${base} border-line/50 text-ink-faint line-through`
        return (
          <span key={h} className={cls}>
            {horsemanLabel(h, locale)}
          </span>
        )
      })}
    </div>
  )
}

// --- Labels ---

function dyadLabel(d: AttachmentDyad, locale?: Locale): string {
  const en: Record<AttachmentDyad, string> = {
    secure_secure: 'Secure ↔ Secure',
    anxious_avoidant: 'Anxious ↔ Avoidant',
    avoidant_anxious: 'Avoidant ↔ Anxious',
    anxious_anxious: 'Anxious ↔ Anxious',
    avoidant_avoidant: 'Avoidant ↔ Avoidant',
    secure_anxious: 'Secure ↔ Anxious',
    anxious_secure: 'Anxious ↔ Secure',
    secure_avoidant: 'Secure ↔ Avoidant',
    avoidant_secure: 'Avoidant ↔ Secure',
    disorganisiert_beteiligt: 'Disorganized involvement',
    unklar: "Can't be cleanly classified",
  }
  const de: Record<AttachmentDyad, string> = {
    secure_secure: 'Sicher ↔ Sicher',
    anxious_avoidant: 'Ängstlich ↔ Vermeidend',
    avoidant_anxious: 'Vermeidend ↔ Ängstlich',
    anxious_anxious: 'Ängstlich ↔ Ängstlich',
    avoidant_avoidant: 'Vermeidend ↔ Vermeidend',
    secure_anxious: 'Sicher ↔ Ängstlich',
    anxious_secure: 'Ängstlich ↔ Sicher',
    secure_avoidant: 'Sicher ↔ Vermeidend',
    avoidant_secure: 'Vermeidend ↔ Sicher',
    disorganisiert_beteiligt: 'Desorganisierte Beteiligung',
    unklar: 'Nicht klar einzuordnen',
  }
  return (locale === 'de' ? de : en)[d]
}

function bidResponseLabel(r: BidResponse, locale?: Locale): string {
  const en: Record<BidResponse, string> = {
    turning_toward: 'Turning toward · engagement',
    turning_away: 'Turning away · ignoring',
    turning_against: 'Turning against · rejection',
  }
  const de: Record<BidResponse, string> = {
    turning_toward: 'Hinwendung · Eingehen',
    turning_away: 'Abwendung · Ignorieren',
    turning_against: 'Gegen-Wendung · Ablehnung',
  }
  return (locale === 'de' ? de : en)[r]
}

function demandWithdrawLabel(dw: DemandWithdraw, participants: string[], locale?: Locale): string {
  const [a, b] = participants
  if (locale === 'de') {
    return {
      a_demand_b_withdraw: `${a ?? 'A'} drängt · ${b ?? 'B'} zieht sich zurück`,
      b_demand_a_withdraw: `${b ?? 'B'} drängt · ${a ?? 'A'} zieht sich zurück`,
      symmetrisch_demand: 'Beide drängen · niemand zieht sich zurück',
      symmetrisch_withdraw: 'Beide ziehen sich zurück · niemand drängt',
      kein_muster: 'Kein klares Drängen/Zurückziehen-Muster',
    }[dw]
  }
  return {
    a_demand_b_withdraw: `${a ?? 'A'} pushes · ${b ?? 'B'} pulls back`,
    b_demand_a_withdraw: `${b ?? 'B'} pushes · ${a ?? 'A'} pulls back`,
    symmetrisch_demand: 'Both push · neither pulls back',
    symmetrisch_withdraw: 'Both pull back · nobody pushes',
    kein_muster: 'No clear push/pull pattern',
  }[dw]
}

function horsemanLabel(h: Horseman, locale?: Locale): string {
  const en = { kritik: 'Criticism', verachtung: 'Contempt', abwehr: 'Defensiveness', stonewalling: 'Stonewalling' }
  const de = { kritik: 'Kritik', verachtung: 'Verachtung', abwehr: 'Abwehr', stonewalling: 'Mauern' }
  return (locale === 'de' ? de : en)[h]
}

function collectMissingSections(p: unknown): string[] {
  const required = [
    'kopplung',
    'machtstruktur',
    'bindungsdyade',
    'bids',
    'repair',
    'konflikt_signatur',
    'mentalisierung',
    'meta_kommunikation',
    'berne',
    'unausgesprochene_regeln',
    'kern_insight',
    'safety_flag',
  ] as const
  if (!p || typeof p !== 'object') return ['payload']
  const obj = p as Record<string, unknown>
  const missing: string[] = []
  for (const key of required) {
    const v = obj[key]
    if (v == null) missing.push(key)
  }
  // Deep sanity: mentalisierung.pro_person must be an array, etc.
  const m = obj.mentalisierung as { pro_person?: unknown } | undefined
  if (m && !Array.isArray(m.pro_person)) missing.push('mentalisierung.pro_person')
  const k = obj.konflikt_signatur as { four_horsemen_pro_person?: unknown } | undefined
  if (k && !Array.isArray(k.four_horsemen_pro_person)) missing.push('konflikt_signatur.four_horsemen_pro_person')
  const bids = obj.bids as { pro_person?: unknown; beispiele?: unknown } | undefined
  if (bids && !Array.isArray(bids.pro_person)) missing.push('bids.pro_person')
  return missing
}

// machtstruktur.{inhalt,prozess,affekt}_lead is typed as a free string but the
// schema documents three conceptual values: a pseudonym, "balanced", or
// "shifting". The pseudonym is restored to a real name upstream, so only
// "balanced"/"shifting" still need translating for the German UI — and we
// keep the backfill dash ("—") as-is when the model dropped the field.
function leadLabel(raw: string, locale?: Locale): string {
  const s = raw?.trim()
  if (!s) return '—'
  const lower = s.toLowerCase()
  if (lower === 'balanced') return locale === 'de' ? 'ausgewogen' : 'balanced'
  if (lower === 'shifting') return locale === 'de' ? 'wechselnd' : 'shifting'
  return s
}

// Friendly labels for the raw schema keys that collectMissingSections returns.
// Users should never see "kopplung, bids, kern_insight" in the fallback UI.
function missingSectionLabel(key: string, locale: Locale): string {
  const de = locale === 'de'
  const map: Record<string, { en: string; de: string }> = {
    teilnehmer: { en: 'participants', de: 'Teilnehmende' },
    kopplung: { en: 'connection', de: 'Ankommen' },
    machtstruktur: { en: 'power balance', de: 'Machtgefüge' },
    bindungsdyade: { en: 'attachment dyad', de: 'Bindung' },
    bids: { en: 'bids for attention', de: 'Signale' },
    repair: { en: 'repair', de: 'Wieder-glatt-ziehen' },
    konflikt_signatur: { en: 'conflict signature', de: 'Konflikt' },
    mentalisierung: { en: 'mentalization', de: 'Gedanken-lesen' },
    meta_kommunikation: { en: 'meta-talk', de: 'Meta-Gespräch' },
    berne: { en: 'hidden games', de: 'Verdeckte Ebenen' },
    unausgesprochene_regeln: { en: 'unspoken rules', de: 'Ungesagte Regeln' },
    kern_insight: { en: 'core insight', de: 'Kern-Insight' },
    safety_flag: { en: 'safety', de: 'Warnsignal' },
    'mentalisierung.pro_person': { en: 'per-person mentalization', de: 'Gedanken-lesen pro Person' },
    'konflikt_signatur.four_horsemen_pro_person': { en: 'per-person conflict markers', de: 'Konfliktmarker pro Person' },
    'bids.pro_person': { en: 'per-person bids', de: 'Signale pro Person' },
    payload: { en: 'everything', de: 'alles' },
  }
  const entry = map[key]
  if (!entry) return key
  return de ? entry.de : entry.en
}

function mentalisierungLabel(q: 'hoch' | 'mittel' | 'niedrig' | 'ungleichmäßig', locale?: Locale): string {
  const en = { hoch: 'High', mittel: 'Medium', niedrig: 'Low', ungleichmäßig: 'Uneven' }
  const de = { hoch: 'Hoch', mittel: 'Mittel', niedrig: 'Niedrig', ungleichmäßig: 'Ungleichmäßig' }
  return (locale === 'de' ? de : en)[q]
}

function metaLabel(k: 'hoch' | 'mittel' | 'niedrig' | 'blockiert', locale?: Locale): string {
  if (locale === 'de') {
    return {
      hoch: 'Ihr könnt über die Beziehung reden.',
      mittel: 'Meta-Gespräch passiert, aber es kostet Kraft.',
      niedrig: 'Ihr redet kaum über die Beziehung.',
      blockiert: 'Meta-Gespräch ist blockiert.',
    }[k]
  }
  return {
    hoch: 'You can talk about the relationship.',
    mittel: 'Meta-talk happens, but it takes effort.',
    niedrig: 'You barely talk about the relationship.',
    blockiert: 'Meta-talk is blocked.',
  }[k]
}

function berneModusLabel(
  m: 'oberflächlich_parallel' | 'verdeckt_doppelbödig' | 'wiederkehrendes_spiel' | 'gemischt',
  locale?: Locale,
): string {
  if (locale === 'de') {
    return {
      oberflächlich_parallel: 'Oberflächlich, läuft parallel',
      verdeckt_doppelbödig: 'Verdeckt, doppelbödig',
      wiederkehrendes_spiel: 'Wiederkehrendes Muster',
      gemischt: 'Gemischt',
    }[m]
  }
  return {
    oberflächlich_parallel: 'Surface-level, running parallel',
    verdeckt_doppelbödig: 'Covert, double-layered',
    wiederkehrendes_spiel: 'Recurring pattern',
    gemischt: 'Mixed',
  }[m]
}
