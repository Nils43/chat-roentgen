import { useState } from 'react'
import type {
  BerneTransaction,
  CialdiniPrinciple,
  ConflictStyle,
  PowerLead,
  RelationshipResult,
} from '../ai/types'

interface Props {
  result: RelationshipResult
  participants: string[]
  onBack?: () => void
}

// Person colors follow the app-wide A/B convention set in ProfileView.
const PERSON_COLORS = [
  { text: 'text-a', bg: 'bg-a', border: 'border-a', dim: 'text-a/60', glow: 'bg-a/10', soft: 'bg-a/20' },
  { text: 'text-b', bg: 'bg-b', border: 'border-b', dim: 'text-b/60', glow: 'bg-b/10', soft: 'bg-b/20' },
  { text: 'text-blue-400', bg: 'bg-blue-400', border: 'border-blue-400', dim: 'text-blue-400/60', glow: 'bg-blue-400/10', soft: 'bg-blue-400/20' },
  { text: 'text-orange-400', bg: 'bg-orange-400', border: 'border-orange-400', dim: 'text-orange-400/60', glow: 'bg-orange-400/10', soft: 'bg-orange-400/20' },
]

export function RelationshipView({ result, participants, onBack }: Props) {
  const { payload } = result

  // Map pseudonyms ("Person A") to real names in payload AND back to color index.
  // restoreNamesDeep already replaced pseudonyms with real names in strings, but
  // the `teilnehmer` array is the source of truth for ordering.
  const colorFor = (name: string): (typeof PERSON_COLORS)[number] => {
    const idx = participants.indexOf(name)
    if (idx === -1) return PERSON_COLORS[0]
    return PERSON_COLORS[idx % PERSON_COLORS.length]
  }

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 pt-12 pb-24 space-y-16">
      <header className="space-y-6">
        <div className="label-mono text-b">Modul 03 · Beziehungsebene · AI</div>
        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
          Was zwischen euch <span className="italic text-ink-muted">passiert.</span>
        </h2>
        <p className="serif-body text-lg md:text-xl text-ink-muted max-w-2xl">
          Eine Lesart der Dynamik, nicht der Einzelpersonen. Wer führt, wer folgt, wer sucht Nähe, wer reguliert
          Distanz — und welche Regeln nie ausgesprochen wurden.
        </p>
      </header>

      {/* Kern-Insight — groß, ruhig, oben */}
      <blockquote className="relative font-serif italic text-2xl md:text-4xl leading-snug text-ink pl-6 border-l-2 border-b">
        „{payload.kern_insight}"
      </blockquote>

      {/* Machtgefälle — zwei Achsen */}
      <Section kicker="01 · Machtgefälle" title="Wer führt, wer taktet.">
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <PowerCard
            label="Inhaltlich"
            sublabel="Wer setzt die Themen?"
            lead={payload.machtgefaelle.inhaltlich}
            participants={participants}
            colorFor={colorFor}
          />
          <PowerCard
            label="Strukturell"
            sublabel="Wer bestimmt wann und wie?"
            lead={payload.machtgefaelle.strukturell}
            participants={participants}
            colorFor={colorFor}
          />
        </div>
        <Prose>{payload.machtgefaelle.interpretation}</Prose>
        <Evidence items={payload.machtgefaelle.evidenz} />
      </Section>

      {/* Investment-Delta */}
      <Section kicker="02 · Investment-Delta" title="Wer trägt mehr.">
        <DeltaScale
          skala={payload.investment_delta.skala}
          richtung={payload.investment_delta.richtung}
          statik={payload.investment_delta.statik}
          participants={participants}
          colorFor={colorFor}
        />
        <Prose>{payload.investment_delta.interpretation}</Prose>
        <Evidence items={payload.investment_delta.evidenz} />
      </Section>

      {/* Berne */}
      <Section kicker="03 · Berne · Transaktionsmuster" title={berneLabel(payload.berne.dominant)}>
        <Prose>{payload.berne.interpretation}</Prose>
        {payload.berne.beispiele.length > 0 && (
          <div className="mt-6 space-y-2">
            <div className="label-mono">Beispiele aus dem Chat</div>
            {payload.berne.beispiele.map((b, i) => (
              <div key={i} className="font-mono text-sm text-ink-muted pl-3 border-l border-line">
                „{b}"
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Konfliktstil */}
      <Section
        kicker="04 · Konfliktstil"
        title={`Dominant: ${conflictLabel(payload.konfliktstil.dominant)}`}
      >
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {payload.konfliktstil.pro_person.map((p) => {
            const c = colorFor(p.person)
            return (
              <div key={p.person} className="bg-bg-surface/70 border border-line/50 rounded-xl p-5">
                <div className={`label-mono mb-2 ${c.text}`}>{p.person}</div>
                <div className="font-serif text-2xl leading-tight">{conflictLabel(p.stil)}</div>
              </div>
            )
          })}
        </div>
        <Prose>{payload.konfliktstil.interpretation}</Prose>
        <Evidence items={payload.konfliktstil.evidenz} />
      </Section>

      {/* Nähe-Distanz */}
      <Section kicker="05 · Nähe & Distanz" title={payload.naehe_distanz.muster}>
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <RoleCard
            role="Nähe-Suche"
            person={payload.naehe_distanz.naeheSucher}
            color={colorFor(payload.naehe_distanz.naeheSucher)}
          />
          <RoleCard
            role="Distanz-Regulation"
            person={payload.naehe_distanz.distanzRegulierer}
            color={colorFor(payload.naehe_distanz.distanzRegulierer)}
          />
        </div>
        <Prose>{payload.naehe_distanz.interpretation}</Prose>
        <Evidence items={payload.naehe_distanz.evidenz} />
      </Section>

      {/* Cialdini */}
      <Section kicker="06 · Einfluss-Taktiken (Cialdini)" title="Wer benutzt was, meist unbewusst.">
        <div className="space-y-3 mb-6">
          {payload.cialdini.taktiken.map((t, i) => {
            const c = colorFor(t.von)
            return (
              <article key={i} className="bg-bg-surface/70 border border-line/50 rounded-xl p-5">
                <div className="flex items-baseline justify-between gap-4 flex-wrap mb-2">
                  <div className="font-serif text-xl md:text-2xl">{cialdiniLabel(t.prinzip)}</div>
                  <div className={`label-mono ${c.text}`}>{t.von}</div>
                </div>
                <div className="font-mono text-sm text-ink-muted mb-2 pl-3 border-l border-line">
                  „{t.beispiel}"
                </div>
                <div className="serif-body text-base text-ink">{t.wirkung}</div>
              </article>
            )
          })}
        </div>
        <Prose>{payload.cialdini.interpretation}</Prose>
      </Section>

      {/* Unausgesprochene Regeln */}
      <Section kicker="07 · Unausgesprochene Regeln" title="Die Regeln die nie verhandelt wurden.">
        <div className="space-y-3 mb-6">
          {payload.unausgesprochene_regeln.regeln.map((r, i) => (
            <article key={i} className="bg-bg-surface/70 border border-line/50 rounded-xl p-5">
              <div className="font-serif text-xl md:text-2xl mb-2">„{r.regel}"</div>
              <div className="serif-body text-base text-ink-muted">{r.evidenz}</div>
            </article>
          ))}
        </div>
        <Prose>{payload.unausgesprochene_regeln.interpretation}</Prose>
      </Section>

      {onBack && (
        <div className="pt-8 border-t border-line/40">
          <button
            onClick={onBack}
            className="label-mono text-ink-muted hover:text-ink transition-colors"
          >
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

function Section({
  kicker,
  title,
  children,
}: {
  kicker: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-6">
      <div>
        <div className="label-mono text-a mb-3">{kicker}</div>
        <h3 className="font-serif text-2xl md:text-4xl leading-tight tracking-tight">{title}</h3>
      </div>
      <div className="card">{children}</div>
    </section>
  )
}

function Prose({ children }: { children: React.ReactNode }) {
  return <p className="serif-body text-lg md:text-xl text-ink leading-snug">{children}</p>
}

function Evidence({ items }: { items: string[] }) {
  const [open, setOpen] = useState(false)
  if (!items?.length) return null
  return (
    <div className="mt-6 pt-4 border-t border-line/30">
      <button
        onClick={() => setOpen((v) => !v)}
        className="label-mono text-ink-muted hover:text-ink transition-colors flex items-center gap-2"
      >
        <span>Evidenz im Chat ({items.length})</span>
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2 animate-fade-in">
          {items.map((e, i) => (
            <div key={i} className="font-mono text-sm text-ink-muted pl-3 border-l border-line">
              „{e}"
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PowerCard({
  label,
  sublabel,
  lead,
  participants,
  colorFor,
}: {
  label: string
  sublabel: string
  lead: PowerLead
  participants: string[]
  colorFor: (name: string) => (typeof PERSON_COLORS)[number]
}) {
  const target = powerLeadTarget(lead, participants)
  const color = target ? colorFor(target) : null

  return (
    <div className="bg-bg-surface/70 border border-line/50 rounded-xl p-5">
      <div className="label-mono mb-1">{label}</div>
      <div className="font-mono text-[11px] text-ink-faint mb-3">{sublabel}</div>
      {target && color ? (
        <div className={`font-serif text-3xl ${color.text} leading-tight`}>{target}</div>
      ) : (
        <div className="font-serif text-3xl text-ink leading-tight">{powerLeadLabel(lead)}</div>
      )}
    </div>
  )
}

function DeltaScale({
  skala,
  richtung,
  statik,
  participants,
  colorFor,
}: {
  skala: number
  richtung: PowerLead
  statik: 'statisch' | 'dynamisch'
  participants: string[]
  colorFor: (name: string) => (typeof PERSON_COLORS)[number]
}) {
  const target = powerLeadTarget(richtung, participants)
  const color = target ? colorFor(target) : PERSON_COLORS[0]
  const pct = Math.max(0, Math.min(100, skala))

  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-3 gap-4 flex-wrap">
        <div>
          <div className="metric-num text-4xl md:text-5xl text-ink">{pct}</div>
          <div className="label-mono text-ink-muted">von 100 · Asymmetrie</div>
        </div>
        <div className="text-right">
          {target && (
            <div className={`font-serif text-xl ${color.text}`}>{target} investiert mehr</div>
          )}
          <div className="label-mono text-ink-muted">
            {statik === 'statisch' ? 'statisch · pendelt nicht' : 'dynamisch · pendelt'}
          </div>
        </div>
      </div>
      <div className="relative h-[6px] bg-line rounded-full overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 ${color.bg} transition-all duration-1000 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between font-mono text-[11px] text-ink-faint mt-2 uppercase tracking-widest">
        <span>symmetrisch</span>
        <span>asymmetrisch</span>
      </div>
    </div>
  )
}

function RoleCard({
  role,
  person,
  color,
}: {
  role: string
  person: string
  color: (typeof PERSON_COLORS)[number]
}) {
  return (
    <div className="bg-bg-surface/70 border border-line/50 rounded-xl p-5">
      <div className="label-mono mb-2">{role}</div>
      <div className={`font-serif text-3xl ${color.text}`}>{person}</div>
    </div>
  )
}

function powerLeadTarget(lead: PowerLead, participants: string[]): string | null {
  if (lead === 'person_a') return participants[0] ?? null
  if (lead === 'person_b') return participants[1] ?? null
  return null
}

function powerLeadLabel(lead: PowerLead): string {
  return lead === 'balanced' ? 'Ausgeglichen' : lead === 'mixed' ? 'Gemischt' : ''
}

function berneLabel(t: BerneTransaction): string {
  return {
    erwachsenen_erwachsenen: 'Erwachsenen ↔ Erwachsenen',
    eltern_kind: 'Eltern → Kind',
    kind_eltern: 'Kind → Eltern',
    kind_kind: 'Kind ↔ Kind',
    eltern_eltern: 'Eltern ↔ Eltern',
    gemischt: 'Gemischte Transaktionen',
  }[t]
}

function conflictLabel(s: ConflictStyle): string {
  return {
    direkte_ansprache: 'Direkte Ansprache',
    vermeidung: 'Vermeidung',
    humor_deflection: 'Humor als Deflection',
    passiv_aggressiv: 'Passiv-aggressiv',
    eskalation: 'Eskalation',
    repair_oriented: 'Repair-orientiert',
    gemischt: 'Gemischt',
  }[s]
}

function cialdiniLabel(p: CialdiniPrinciple): string {
  return {
    reciprocity: 'Reziprozität',
    scarcity: 'Knappheit',
    social_proof: 'Social Proof',
    authority: 'Autorität',
    commitment_consistency: 'Commitment & Consistency',
    liking: 'Sympathie',
    unity: 'Zugehörigkeit',
  }[p]
}
