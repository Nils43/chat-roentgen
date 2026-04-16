import { useState } from 'react'
import type {
  AttachmentDyad,
  BidResponse,
  DemandWithdraw,
  Horseman,
  RelationshipResult,
  Zitat,
} from '../ai/types'

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
        <div className="label-mono text-b">Modul 03 · Beziehungsebene · AI</div>
        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
          Was zwischen euch <span className="italic text-ink-muted">passiert.</span>
        </h2>
        <p className="serif-body text-lg md:text-xl text-ink-muted max-w-2xl">
          Empirisch geerdet — Gottman, Fonagy, Stern, Watzlawick, Berne, Hazan/Shaver. Der Blick gilt der Dyade, nicht
          den Einzelnen.
        </p>
      </header>

      {payload.safety_flag.aktiv && payload.safety_flag.beschreibung && (
        <section className="card border border-b/60 bg-b/5">
          <div className="label-mono text-b mb-2">⚠ Safety-Hinweis</div>
          <p className="serif-body text-lg text-ink">{payload.safety_flag.beschreibung}</p>
        </section>
      )}

      <blockquote className="relative font-serif italic text-2xl md:text-4xl leading-snug text-ink pl-6 border-l-2 border-b">
        „{payload.kern_insight}"
      </blockquote>

      {/* 01 — Kopplung */}
      <Section kicker="01 · Kopplung" title="Schwingt das überhaupt mit?" framework="Stern · Attunement">
        <div className="grid md:grid-cols-3 gap-3 mb-6">
          <MeterTile label="Emotionales Mitschwingen" value={payload.kopplung.attunement} />
          <MeterTile label="Rhythmus-Synchronizität" value={payload.kopplung.rhythmus_synchron} />
          <MeterTile label="Lexikon-Synchronizität" value={payload.kopplung.lexikon_synchron} />
        </div>
        <Prose>{payload.kopplung.interpretation}</Prose>
        <Evidence zitate={payload.kopplung.zitate} colorFor={colorFor} />
      </Section>

      {/* 02 — Machtstruktur 3D */}
      <Section
        kicker="02 · Machtstruktur"
        title="Wer führt — inhaltlich, prozessual, affektiv?"
        framework="Watzlawick · Jackson"
      >
        <div className="grid md:grid-cols-3 gap-3 mb-6">
          <LeadCard
            label="Inhalt"
            sublabel="Wer setzt Themen?"
            lead={payload.machtstruktur.inhalt_lead}
            colorFor={colorFor}
          />
          <LeadCard
            label="Prozess"
            sublabel="Wer rahmt & taktet?"
            lead={payload.machtstruktur.prozess_lead}
            colorFor={colorFor}
          />
          <LeadCard
            label="Affekt"
            sublabel="Wessen Stimmung regelt?"
            lead={payload.machtstruktur.affekt_lead}
            colorFor={colorFor}
          />
        </div>
        <AsymmetryBar skala={payload.machtstruktur.asymmetrie_skala} statik={payload.machtstruktur.statik} />
        <Prose>{payload.machtstruktur.interpretation}</Prose>
        <Evidence zitate={payload.machtstruktur.zitate} colorFor={colorFor} />
      </Section>

      {/* 03 — Bindungsdyade */}
      <Section
        kicker="03 · Bindungsdyade"
        title={dyadLabel(payload.bindungsdyade.konstellation)}
        framework="Hazan & Shaver · Adult Attachment"
        tag={`Sicherheit: ${payload.bindungsdyade.sicherheit}`}
      >
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          <InfoBlock label="Was diese Paarung produziert">
            {payload.bindungsdyade.dyaden_beschreibung}
          </InfoBlock>
          <InfoBlock label="Typisches Risiko dieser Konstellation" tone="warn">
            {payload.bindungsdyade.dyaden_risiko}
          </InfoBlock>
        </div>
        <Prose>{payload.bindungsdyade.interpretation}</Prose>
        <Evidence zitate={payload.bindungsdyade.zitate} colorFor={colorFor} />
      </Section>

      {/* 04 — Bids */}
      <Section
        kicker="04 · Bid-Dynamik"
        title="Wie wird angeboten, wie wird angenommen?"
        framework="Gottman · Emotional Bids"
        tag={bidResponseLabel(payload.bids.dominante_response)}
      >
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          {payload.bids.pro_person.map((p) => {
            const c = colorFor(p.person)
            return (
              <div key={p.person} className="bg-bg-surface/70 border border-line/50 rounded-xl p-5 space-y-3">
                <div className={`label-mono ${c.text}`}>{p.person}</div>
                <MiniRow label="Bid-Frequenz" value={p.bid_haeufigkeit} />
                <MiniRow label="Antwort-Signatur" value={bidResponseLabel(p.antwort_signatur)} />
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
        kicker="05 · Repair-Kapazität"
        title={payload.repair.hat_repair ? 'Brüche werden repariert.' : 'Reparatur findet nicht statt.'}
        framework="Gottman · Repair-Attempts"
      >
        <div className="grid md:grid-cols-3 gap-3 mb-6">
          <InfoBlock label="Wer repariert">
            {payload.repair.wer_repariert.length === 0
              ? '—'
              : payload.repair.wer_repariert.map((p) => (
                  <span key={p} className={`font-serif text-xl ${colorFor(p).text}`}>
                    {p}
                  </span>
                ))}
          </InfoBlock>
          <InfoBlock label="Annahme-Quote">
            <span className="metric-num text-2xl">{levelLabel(payload.repair.annahme_quote)}</span>
          </InfoBlock>
          <InfoBlock label="Typische Form">{payload.repair.typische_form}</InfoBlock>
        </div>
        <Prose>{payload.repair.interpretation}</Prose>
        <Evidence zitate={payload.repair.zitate} colorFor={colorFor} />
      </Section>

      {/* 06 — Konflikt-Signatur */}
      <Section
        kicker="06 · Konflikt-Signatur"
        title="Die Struktur eurer Spannung."
        framework="Gottman · Christensen · Horsemen + Demand-Withdraw"
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
          <div className="label-mono mb-2">Demand–Withdraw</div>
          <div className="font-serif text-2xl">{demandWithdrawLabel(payload.konflikt_signatur.demand_withdraw, participants)}</div>
        </div>

        {payload.konflikt_signatur.flooding_hinweise.length > 0 && (
          <div className="mb-6 space-y-2">
            <div className="label-mono">Flooding-Hinweise</div>
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

      {/* 07 — Mentalisierung */}
      <Section
        kicker="07 · Mentalisierung"
        title="Können sie einander denken?"
        framework="Fonagy · Mentalization-Based"
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
          <div className="label-mono mb-2">Projektion statt Modellierung</div>
          <p className="serif-body text-base text-ink">{payload.mentalisierung.projektion_statt_modellierung}</p>
        </div>
        <Prose>{payload.mentalisierung.interpretation}</Prose>
        <Evidence zitate={payload.mentalisierung.zitate} colorFor={colorFor} />
      </Section>

      {/* 08 — Meta-Kommunikation */}
      <Section
        kicker="08 · Meta-Kommunikation"
        title={metaLabel(payload.meta_kommunikation.kapazitaet)}
        framework="Watzlawick · Bateson"
      >
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          <InfoBlock label="Wer versucht Meta-Talk">
            <span className={`font-serif text-xl ${colorFor(payload.meta_kommunikation.initiator).text}`}>
              {payload.meta_kommunikation.initiator}
            </span>
          </InfoBlock>
          <InfoBlock label="Wie Meta-Talk abgewehrt wird" tone="warn">
            {payload.meta_kommunikation.blocker_muster}
          </InfoBlock>
        </div>
        <Prose>{payload.meta_kommunikation.interpretation}</Prose>
        <Evidence zitate={payload.meta_kommunikation.zitate} colorFor={colorFor} />
      </Section>

      {/* 09 — Berne */}
      <Section
        kicker="09 · Berne-Schicht"
        title={berneModusLabel(payload.berne.dominanter_modus)}
        framework="Berne · Ulterior Transactions + Games"
      >
        <div className="space-y-3 mb-6">
          {payload.berne.ulterior_transactions.map((t, i) => (
            <article key={i} className="bg-bg-surface/70 border border-line/50 rounded-xl p-5 space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <div className="label-mono mb-1">Sozial (gesagt)</div>
                  <div className="serif-body text-base text-ink">{t.sozial}</div>
                </div>
                <div>
                  <div className="label-mono mb-1 text-b">Psychologisch (gemeint)</div>
                  <div className="serif-body text-base text-ink">{t.psychologisch}</div>
                </div>
              </div>
              <SingleQuote zitat={t.beispiel} colorFor={colorFor} />
            </article>
          ))}
        </div>

        {payload.berne.games.length > 0 && (
          <div className="space-y-3 mb-6">
            <div className="label-mono">Spiele (recurring patterns)</div>
            {payload.berne.games.map((g, i) => (
              <article key={i} className="bg-bg-surface/70 border border-line/50 rounded-xl p-5">
                <div className="font-serif text-xl mb-1">„{g.name}"</div>
                <p className="serif-body text-base text-ink-muted mb-3">{g.funktion}</p>
                <SingleQuote zitat={g.beispiel} colorFor={colorFor} />
              </article>
            ))}
          </div>
        )}
        <Prose>{payload.berne.interpretation}</Prose>
      </Section>

      {/* 10 — Unausgesprochene Regeln */}
      <Section kicker="10 · Unausgesprochene Regeln" title="Die Regeln, die nie verhandelt wurden.">
        <div className="space-y-3 mb-6">
          {payload.unausgesprochene_regeln.regeln.map((r, i) => (
            <article key={i} className="bg-bg-surface/70 border border-line/50 rounded-xl p-5">
              <div className="font-serif text-xl md:text-2xl mb-2">„{r.regel}"</div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <div className="label-mono mb-1">Funktion im System</div>
                  <div className="serif-body text-base text-ink-muted">{r.funktion}</div>
                </div>
                <div>
                  <div className="label-mono mb-1">Evidenz</div>
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
            ← Zurück zu den Profilen
          </button>
        </div>
      )}

      <div className="text-center serif-body text-ink-muted italic pt-6 border-t border-line/40">
        „Diese Analyse ist eine Lesart, keine Wahrheit. Sie ersetzt keine therapeutische Begleitung."
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
        <span>Evidenz im Chat ({zitate.length})</span>
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
      <span className="text-ink-muted">„{zitat.text}"</span>
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
        <div className="label-mono">Gesamt-Asymmetrie</div>
        <div className="flex items-baseline gap-3">
          <span className="metric-num text-3xl md:text-4xl text-ink">{pct}</span>
          <span className="label-mono text-ink-muted">
            {statik === 'statisch' ? '· statisch, pendelt nicht' : '· dynamisch, pendelt'}
          </span>
        </div>
      </div>
      <div className="relative h-[6px] bg-line rounded-full overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-a transition-all duration-1000 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between font-mono text-[11px] text-ink-faint mt-2 uppercase tracking-widest">
        <span>symmetrisch</span>
        <span>asymmetrisch</span>
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
        <span className="label-mono">Bid → Antwort</span>
        <span className="label-mono text-ink-muted border border-line/60 rounded-full px-2 py-0.5">
          {bidResponseLabel(klasse)}
        </span>
      </div>
      <div className={`font-mono text-sm pl-3 border-l ${cb.border}`}>
        <span className={`${cb.text} mr-2`}>{bid.person}:</span>
        <span className="text-ink">„{bid.text}"</span>
      </div>
      <div className={`font-mono text-sm pl-3 border-l ${ca.border}`}>
        <span className={`${ca.text} mr-2`}>{antwort.person}:</span>
        <span className="text-ink-muted">„{antwort.text}"</span>
      </div>
    </article>
  )
}

function HorsemenPanel({ praesenz, dominierend }: { praesenz: Horseman[]; dominierend: Horseman | null }) {
  const ALL: Horseman[] = ['kritik', 'verachtung', 'abwehr', 'stonewalling']
  if (praesenz.length === 0) {
    return <div className="font-serif text-xl text-ink-muted">Keine der vier Reiter sichtbar.</div>
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
    secure_secure: 'Sicher ↔ Sicher',
    anxious_avoidant: 'Ängstlich ↔ Vermeidend',
    avoidant_anxious: 'Vermeidend ↔ Ängstlich',
    anxious_anxious: 'Ängstlich ↔ Ängstlich',
    avoidant_avoidant: 'Vermeidend ↔ Vermeidend',
    secure_anxious: 'Sicher ↔ Ängstlich',
    anxious_secure: 'Ängstlich ↔ Sicher',
    secure_avoidant: 'Sicher ↔ Vermeidend',
    avoidant_secure: 'Vermeidend ↔ Sicher',
    disorganisiert_beteiligt: 'Desorganisiert beteiligt',
    unklar: 'Nicht klar einzuordnen',
  }[d]
}

function bidResponseLabel(r: BidResponse): string {
  return {
    turning_toward: 'Turning toward · Engagement',
    turning_away: 'Turning away · Ignorieren',
    turning_against: 'Turning against · Zurückweisung',
  }[r]
}

function demandWithdrawLabel(dw: DemandWithdraw, participants: string[]): string {
  const [a, b] = participants
  return {
    a_demand_b_withdraw: `${a ?? 'A'} fordert · ${b ?? 'B'} zieht sich zurück`,
    b_demand_a_withdraw: `${b ?? 'B'} fordert · ${a ?? 'A'} zieht sich zurück`,
    symmetrisch_demand: 'Beide fordern · keiner zieht sich zurück',
    symmetrisch_withdraw: 'Beide ziehen sich zurück · keiner fordert',
    kein_muster: 'Kein klares Demand–Withdraw-Muster',
  }[dw]
}

function horsemanLabel(h: Horseman): string {
  return { kritik: 'Kritik', verachtung: 'Verachtung', abwehr: 'Abwehr', stonewalling: 'Stonewalling' }[h]
}

function mentalisierungLabel(q: 'hoch' | 'mittel' | 'niedrig' | 'ungleichmäßig'): string {
  return { hoch: 'Hoch', mittel: 'Mittel', niedrig: 'Niedrig', ungleichmäßig: 'Ungleichmäßig' }[q]
}

function metaLabel(k: 'hoch' | 'mittel' | 'niedrig' | 'blockiert'): string {
  return {
    hoch: 'Können über die Beziehung sprechen.',
    mittel: 'Meta-Talk möglich, aber mühsam.',
    niedrig: 'Über die Beziehung wird kaum geredet.',
    blockiert: 'Meta-Talk ist blockiert.',
  }[k]
}

function levelLabel(l: 'niedrig' | 'mittel' | 'hoch'): string {
  return { niedrig: 'Niedrig', mittel: 'Mittel', hoch: 'Hoch' }[l]
}

function berneModusLabel(m: 'oberflächlich_parallel' | 'verdeckt_doppelbödig' | 'wiederkehrendes_spiel' | 'gemischt'): string {
  return {
    oberflächlich_parallel: 'Oberflächlich parallel',
    verdeckt_doppelbödig: 'Verdeckt doppelbödig',
    wiederkehrendes_spiel: 'Wiederkehrendes Spiel',
    gemischt: 'Gemischt',
  }[m]
}
