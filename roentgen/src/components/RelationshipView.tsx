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

interface Props {
  result: RelationshipResult
  participants: string[]
  onBack?: () => void
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

export function RelationshipView({ result, participants, onBack }: Props) {
  const { payload } = result

  const colorFor = (name: string): PersonColor => {
    const idx = participants.indexOf(name)
    if (idx === -1) return NEUTRAL
    return PERSON_COLORS[idx % PERSON_COLORS.length]
  }

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 pt-12 pb-24 space-y-14">
      <header className="space-y-6">
        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
          What's going on <span className="italic text-ink-muted">between you.</span>
        </h2>
        <p className="serif-body text-lg md:text-xl text-ink-muted max-w-2xl">
          Not who you are individually — but what you do together. How you sync, fight, get close, pull back.
        </p>
      </header>

      {payload.safety_flag?.aktiv && payload.safety_flag?.beschreibung && (
        <SafetyBanner pattern={payload.safety_flag.beschreibung} />
      )}

      <blockquote className="relative font-serif italic text-2xl md:text-4xl leading-snug text-ink pl-6 border-l-2 border-b">
        "{payload.kern_insight}"
      </blockquote>

      {/* 01 — Coupling */}
      <Section kicker="01 · Connection" title="Is anything actually resonating?" framework="">
        <div className="grid md:grid-cols-3 gap-3 mb-6">
          <MeterTile label="Feelings meet" value={payload.kopplung.attunement} />
          <MeterTile label="Matching rhythm" value={payload.kopplung.rhythmus_synchron} />
          <MeterTile label="Matching words" value={payload.kopplung.lexikon_synchron} />
        </div>
        <Prose>{payload.kopplung.interpretation}</Prose>
        <Evidence zitate={payload.kopplung.zitate} colorFor={colorFor} />
      </Section>

      {/* 02 — Power structure 3D */}
      <Section
        kicker="02 · Who leads"
        title="Who sets topics, who sets the tone?"
        framework=""
      >
        <div className="grid md:grid-cols-3 gap-3 mb-6">
          <LeadCard
            label="Topics"
            sublabel="Who puts them on the table?"
            lead={payload.machtstruktur.inhalt_lead}
            colorFor={colorFor}
          />
          <LeadCard
            label="Pace"
            sublabel="Who sets the rhythm?"
            lead={payload.machtstruktur.prozess_lead}
            colorFor={colorFor}
          />
          <LeadCard
            label="Mood"
            sublabel="Whose feeling sets the tone?"
            lead={payload.machtstruktur.affekt_lead}
            colorFor={colorFor}
          />
        </div>
        <AsymmetryBar skala={payload.machtstruktur.asymmetrie_skala} statik={payload.machtstruktur.statik} />
        <Prose>{payload.machtstruktur.interpretation}</Prose>
        <Evidence zitate={payload.machtstruktur.zitate} colorFor={colorFor} />
      </Section>

      {/* 03 — Attachment dyad */}
      <Section
        kicker="03 · Closeness & distance"
        title={dyadLabel(payload.bindungsdyade.konstellation)}
        framework=""
        tag={`Confidence: ${levelLabel(payload.bindungsdyade.sicherheit)}`}
      >
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          <InfoBlock label="What this combo does to you">
            {payload.bindungsdyade.dyaden_beschreibung}
          </InfoBlock>
          <InfoBlock label="Where it typically gets stuck" tone="warn">
            {payload.bindungsdyade.dyaden_risiko}
          </InfoBlock>
        </div>
        <Prose>{payload.bindungsdyade.interpretation}</Prose>
        <Evidence zitate={payload.bindungsdyade.zitate} colorFor={colorFor} />
      </Section>

      {/* 04 — Bids */}
      <Section
        kicker="04 · Small offers"
        title="How attention is offered — and received"
        framework=""
        tag={bidResponseLabel(payload.bids.dominante_response)}
      >
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          {payload.bids.pro_person.map((p) => {
            const c = colorFor(p.person)
            return (
              <div key={p.person} className="bg-bg-surface/70 border border-line/50 rounded-xl p-5 space-y-3">
                <div className={`label-mono ${c.text}`}>{p.person}</div>
                <MiniRow label="How often they offer" value={bidFreqLabel(p.bid_haeufigkeit)} />
                <MiniRow label="How they usually respond" value={bidResponseLabel(p.antwort_signatur)} />
              </div>
            )
          })}
        </div>

        <div className="space-y-3 mb-6">
          {payload.bids.beispiele.map((b, i) => (
            <BidPair key={i} bid={b.bid} antwort={b.antwort} klasse={b.klasse} colorFor={colorFor} />
          ))}
        </div>
        <Prose>{payload.bids.interpretation}</Prose>
      </Section>

      {/* 05 — Repair */}
      <Section
        kicker="05 · Making up"
        title={payload.repair.hat_repair ? 'Fights get patched up.' : 'Something stays open after fights.'}
        framework=""
      >
        <div className="grid md:grid-cols-3 gap-3 mb-6">
          <InfoBlock label="Who comes back">
            {payload.repair.wer_repariert.length === 0
              ? '—'
              : payload.repair.wer_repariert.map((p) => (
                  <span key={p} className={`font-serif text-xl ${colorFor(p).text}`}>
                    {p}
                  </span>
                ))}
          </InfoBlock>
          <InfoBlock label="How often it's accepted">
            <span className="metric-num text-2xl">{levelLabel(payload.repair.annahme_quote)}</span>
          </InfoBlock>
          <InfoBlock label="How it usually goes">{payload.repair.typische_form}</InfoBlock>
        </div>
        <Prose>{payload.repair.interpretation}</Prose>
        <Evidence zitate={payload.repair.zitate} colorFor={colorFor} />
      </Section>

      {/* 06 — Conflict signature */}
      <Section
        kicker="06 · How you fight"
        title="How tension plays out between you."
        framework=""
      >
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          {payload.konflikt_signatur.four_horsemen_pro_person.map((p) => {
            const c = colorFor(p.person)
            return (
              <div key={p.person} className="bg-bg-surface/70 border border-line/50 rounded-xl p-5">
                <div className={`label-mono mb-3 ${c.text}`}>{p.person}</div>
                <HorsemenPanel praesenz={p.praesenz} dominierend={p.dominierend} />
              </div>
            )
          })}
        </div>

        <div className="bg-bg-surface/50 border border-line/40 rounded-xl p-5 mb-6">
          <div className="label-mono mb-2">Who pushes, who pulls back</div>
          <div className="font-serif text-2xl">{demandWithdrawLabel(payload.konflikt_signatur.demand_withdraw, participants)}</div>
        </div>

        {payload.konflikt_signatur.flooding_hinweise.length > 0 && (
          <div className="mb-6 space-y-2">
            <div className="label-mono">When it gets too much</div>
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
        <Evidence zitate={payload.konflikt_signatur.zitate} colorFor={colorFor} />
      </Section>

      {/* 07 — Mentalization */}
      <Section
        kicker="07 · Reading each other"
        title="Can they actually think their way into the other?"
        framework=""
      >
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          {payload.mentalisierung.pro_person.map((p) => {
            const c = colorFor(p.person)
            return (
              <div key={p.person} className="bg-bg-surface/70 border border-line/50 rounded-xl p-5">
                <div className={`label-mono mb-2 ${c.text}`}>{p.person}</div>
                <div className="font-serif text-2xl mb-3">{mentalisierungLabel(p.qualitaet)}</div>
                <p className="serif-body text-base text-ink-muted">{p.beschreibung}</p>
              </div>
            )
          })}
        </div>
        <div className="bg-bg-surface/50 border border-line/40 rounded-xl p-5 mb-6">
          <div className="label-mono mb-2">When you're just imagining the other</div>
          <p className="serif-body text-base text-ink">{payload.mentalisierung.projektion_statt_modellierung}</p>
        </div>
        <Prose>{payload.mentalisierung.interpretation}</Prose>
        <Evidence zitate={payload.mentalisierung.zitate} colorFor={colorFor} />
      </Section>

      {/* 08 — Meta-communication */}
      <Section
        kicker="08 · Talking about you"
        title={metaLabel(payload.meta_kommunikation.kapazitaet)}
        framework=""
      >
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          <InfoBlock label="Who brings it up">
            <span className={`font-serif text-xl ${colorFor(payload.meta_kommunikation.initiator).text}`}>
              {payload.meta_kommunikation.initiator}
            </span>
          </InfoBlock>
          <InfoBlock label="How it gets deflected" tone="warn">
            {payload.meta_kommunikation.blocker_muster}
          </InfoBlock>
        </div>
        <Prose>{payload.meta_kommunikation.interpretation}</Prose>
        <Evidence zitate={payload.meta_kommunikation.zitate} colorFor={colorFor} />
      </Section>

      {/* 09 — Double-meaning messages */}
      <Section
        kicker="09 · Between the lines"
        title={berneModusLabel(payload.berne.dominanter_modus)}
        framework=""
      >
        <div className="space-y-3 mb-6">
          {payload.berne.ulterior_transactions.map((t, i) => (
            <article key={i} className="bg-bg-surface/70 border border-line/50 rounded-xl p-5 space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <div className="label-mono mb-1">What is said</div>
                  <div className="serif-body text-base text-ink">{t.sozial}</div>
                </div>
                <div>
                  <div className="label-mono mb-1 text-b">What is meant</div>
                  <div className="serif-body text-base text-ink">{t.psychologisch}</div>
                </div>
              </div>
              <SingleQuote zitat={t.beispiel} colorFor={colorFor} />
            </article>
          ))}
        </div>

        {payload.berne.games.length > 0 && (
          <div className="space-y-3 mb-6">
            <div className="label-mono">Recurring patterns</div>
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
      <Section kicker="10 · Unwritten rules" title="Rules nobody ever said out loud.">
        <div className="space-y-3 mb-6">
          {payload.unausgesprochene_regeln.regeln.map((r, i) => (
            <article key={i} className="bg-bg-surface/70 border border-line/50 rounded-xl p-5">
              <div className="font-serif text-xl md:text-2xl mb-2">"{r.regel}"</div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <div className="label-mono mb-1">What this rule does</div>
                  <div className="serif-body text-base text-ink-muted">{r.funktion}</div>
                </div>
                <div>
                  <div className="label-mono mb-1">Where you can see it in the chat</div>
                  <div className="serif-body text-base text-ink-muted">{r.evidenz}</div>
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
            ← Back to profiles
          </button>
        </div>
      )}

      <div className="text-center serif-body text-ink-muted italic pt-6 border-t border-line/40">
        "This is one reading — not the truth. For real questions, always ask a professional."
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

function Prose({ children }: { children: React.ReactNode }) {
  return <p className="serif-body text-lg md:text-xl text-ink leading-snug">{children}</p>
}

function Evidence({
  zitate,
  colorFor,
}: {
  zitate: Zitat[] | undefined
  colorFor: (name: string) => PersonColor
}) {
  const [open, setOpen] = useState(false)
  if (!zitate || zitate.length === 0) return null
  return (
    <div className="mt-6 pt-4 border-t border-line/30">
      <button
        onClick={() => setOpen((v) => !v)}
        className="label-mono text-ink-muted hover:text-ink transition-colors flex items-center gap-2"
      >
        <span>Examples straight from the chat ({zitate.length})</span>
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

function MeterTile({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="bg-bg-surface/70 border border-line/50 rounded-xl p-5">
      <div className="label-mono mb-2">{label}</div>
      <div className="metric-num text-3xl md:text-4xl mb-3">{pct}</div>
      <div className="relative h-[3px] bg-line rounded-full overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-a transition-all duration-1000 ease-out" style={{ width: `${pct}%` }} />
      </div>
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

function AsymmetryBar({ skala, statik }: { skala: number; statik: 'statisch' | 'dynamisch' }) {
  const pct = Math.max(0, Math.min(100, skala))
  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <div className="label-mono">Overall asymmetry</div>
        <div className="flex items-baseline gap-3">
          <span className="metric-num text-3xl md:text-4xl text-ink">{pct}</span>
          <span className="label-mono text-ink-muted">
            {statik === 'statisch' ? '· static, no swing' : '· dynamic, swings'}
          </span>
        </div>
      </div>
      <div className="relative h-[6px] bg-line rounded-full overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-a transition-all duration-1000 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between font-mono text-[11px] text-ink-faint mt-2 uppercase tracking-widest">
        <span>symmetric</span>
        <span>asymmetric</span>
      </div>
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

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line/40 pb-2 last:border-b-0 last:pb-0">
      <span className="label-mono">{label}</span>
      <span className="font-serif text-lg">{value}</span>
    </div>
  )
}

function BidPair({
  bid,
  antwort,
  klasse,
  colorFor,
}: {
  bid: Zitat
  antwort: Zitat
  klasse: BidResponse
  colorFor: (name: string) => PersonColor
}) {
  const cb = colorFor(bid.person)
  const ca = colorFor(antwort.person)
  const toneClass =
    klasse === 'turning_toward'
      ? 'border-a/50 bg-a/5'
      : klasse === 'turning_away'
        ? 'border-line/60 bg-bg-surface/70'
        : 'border-b/50 bg-b/5'
  return (
    <article className={`border ${toneClass} rounded-xl p-5 space-y-3`}>
      <div className="flex items-center justify-between gap-3">
        <span className="label-mono">Offer → response</span>
        <span className="label-mono text-ink-muted border border-line/60 rounded-full px-2 py-0.5">
          {bidResponseLabel(klasse)}
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

function HorsemenPanel({ praesenz, dominierend }: { praesenz: Horseman[]; dominierend: Horseman | null }) {
  const ALL: Horseman[] = ['kritik', 'verachtung', 'abwehr', 'stonewalling']
  if (praesenz.length === 0) {
    return <div className="font-serif text-xl text-ink-muted">None of the four warning signs visible.</div>
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
            {horsemanLabel(h)}
          </span>
        )
      })}
    </div>
  )
}

// --- Labels ---

function dyadLabel(d: AttachmentDyad): string {
  return {
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
  }[d]
}

function bidResponseLabel(r: BidResponse): string {
  return {
    turning_toward: 'Turning toward · engagement',
    turning_away: 'Turning away · ignoring',
    turning_against: 'Turning against · rejection',
  }[r]
}

function bidFreqLabel(f: 'selten' | 'mittel' | 'hoch'): string {
  return { selten: 'Rarely', mittel: 'Sometimes', hoch: 'Often' }[f]
}

function demandWithdrawLabel(dw: DemandWithdraw, participants: string[]): string {
  const [a, b] = participants
  return {
    a_demand_b_withdraw: `${a ?? 'A'} pushes · ${b ?? 'B'} pulls back`,
    b_demand_a_withdraw: `${b ?? 'B'} pushes · ${a ?? 'A'} pulls back`,
    symmetrisch_demand: 'Both push · neither pulls back',
    symmetrisch_withdraw: 'Both pull back · nobody pushes',
    kein_muster: 'No clear push/pull pattern',
  }[dw]
}

function horsemanLabel(h: Horseman): string {
  return { kritik: 'Criticism', verachtung: 'Contempt', abwehr: 'Defensiveness', stonewalling: 'Stonewalling' }[h]
}

function mentalisierungLabel(q: 'hoch' | 'mittel' | 'niedrig' | 'ungleichmäßig'): string {
  return { hoch: 'High', mittel: 'Medium', niedrig: 'Low', ungleichmäßig: 'Uneven' }[q]
}

function metaLabel(k: 'hoch' | 'mittel' | 'niedrig' | 'blockiert'): string {
  return {
    hoch: 'You can talk about the relationship.',
    mittel: 'Meta-talk happens, but it takes effort.',
    niedrig: 'You barely talk about the relationship.',
    blockiert: 'Meta-talk is blocked.',
  }[k]
}

function levelLabel(l: 'niedrig' | 'mittel' | 'hoch'): string {
  return { niedrig: 'Low', mittel: 'Medium', hoch: 'High' }[l]
}

function berneModusLabel(m: 'oberflächlich_parallel' | 'verdeckt_doppelbödig' | 'wiederkehrendes_spiel' | 'gemischt'): string {
  return {
    oberflächlich_parallel: 'Surface-level, running parallel',
    verdeckt_doppelbödig: 'Covert, double-layered',
    wiederkehrendes_spiel: 'Recurring pattern',
    gemischt: 'Mixed',
  }[m]
}
