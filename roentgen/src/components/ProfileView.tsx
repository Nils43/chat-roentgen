import { useState } from 'react'
import type { ProfileResult } from '../ai/types'

interface Props {
  profiles: ProfileResult[]
  onGoToHighlights?: () => void
  onGoToRelationship?: () => void
}

const PERSON_COLORS = [
  { text: 'text-a', bg: 'bg-a', ring: 'ring-a', dim: 'text-a/60', glow: 'bg-a/10' },
  { text: 'text-b', bg: 'bg-b', ring: 'ring-b', dim: 'text-b/60', glow: 'bg-b/10' },
  { text: 'text-blue-400', bg: 'bg-blue-400', ring: 'ring-blue-400', dim: 'text-blue-400/60', glow: 'bg-blue-400/10' },
  { text: 'text-orange-400', bg: 'bg-orange-400', ring: 'ring-orange-400', dim: 'text-orange-400/60', glow: 'bg-orange-400/10' },
]

export function ProfileView({ profiles, onGoToHighlights, onGoToRelationship }: Props) {
  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 pt-12 pb-24 space-y-16">
      <header className="space-y-6">
        <div className="label-mono text-b">Modul 02 · Persönliche Profile · AI</div>
        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
          Wer <span className="italic text-ink-muted">hier</span> spricht.
        </h2>
        <p className="serif-body text-lg md:text-xl text-ink-muted max-w-2xl">
          Ein psychologisches Portrait pro Person, dekodiert über Horney, Berne, Bowlby, Adler, Goffman. Kein
          Etikett — eine Linse.
        </p>
      </header>

      {profiles.map((result, i) => (
        <ProfileCard key={result.profile.person} result={result} colorIdx={i} />
      ))}

      {onGoToRelationship && (
        <section className="card relative overflow-hidden text-center">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-a/10 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="label-mono text-a mb-3">Modul 03 · als Nächstes</div>
            <h3 className="font-serif text-3xl md:text-4xl leading-tight mb-3">
              Was <span className="italic text-ink-muted">zwischen</span> euch passiert.
            </h3>
            <p className="serif-body text-base text-ink-muted max-w-xl mx-auto mb-6">
              Machtgefälle, Investment-Delta, Konfliktstil, Nähe-Distanz, unausgesprochene Regeln — die Dynamik, nicht
              die Einzelnen.
            </p>
            <button
              onClick={onGoToRelationship}
              className="px-6 py-3 bg-a text-bg rounded-full font-sans text-sm tracking-wide hover:bg-a/90 transition-colors"
            >
              Beziehungsebene zeigen →
            </button>
          </div>
        </section>
      )}

      {onGoToHighlights && (
        <section className="card relative overflow-hidden text-center">
          <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-b/10 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="label-mono text-b mb-3">Modul 05 · später</div>
            <h3 className="font-serif text-3xl md:text-4xl leading-tight mb-3">
              Die <span className="italic text-ink-muted">Momente,</span> die bleiben.
            </h3>
            <p className="serif-body text-base text-ink-muted max-w-xl mx-auto mb-6">
              Die psychologisch dichtesten Einzelnachrichten — ausgewählt, dekodiert, verortet.
            </p>
            <button
              onClick={onGoToHighlights}
              className="px-6 py-3 bg-b text-bg rounded-full font-sans text-sm tracking-wide hover:bg-b/90 transition-colors"
            >
              Highlights zeigen →
            </button>
          </div>
        </section>
      )}

      <div className="text-center serif-body text-ink-muted italic pt-6 border-t border-line/40">
        „Diese Analyse basiert auf Kommunikationsmustern und ist keine klinische Diagnostik. Sie ersetzt keine
        therapeutische Beratung."
      </div>
    </div>
  )
}

function ProfileCard({ result, colorIdx }: { result: ProfileResult; colorIdx: number }) {
  const { profile } = result
  const c = PERSON_COLORS[colorIdx % PERSON_COLORS.length]

  return (
    <article className={`card relative overflow-hidden`}>
      {/* Ambient glow */}
      <div className={`absolute -top-20 -right-20 w-64 h-64 rounded-full ${c.glow} blur-3xl pointer-events-none`} />

      <header className="relative flex items-baseline justify-between mb-8 pb-6 border-b border-line/40">
        <div>
          <div className="label-mono mb-2">Profil</div>
          <h3 className={`font-serif text-5xl md:text-6xl ${c.text} tracking-tight`}>{profile.person}</h3>
        </div>
        <div className={`label-mono ${c.dim}`}>
          {result.inputTokens.toLocaleString('de-DE')} tokens
        </div>
      </header>

      {/* Kern-Insight */}
      <blockquote className={`relative font-serif italic text-2xl md:text-3xl leading-snug ${c.text} mb-10 pl-6 border-l-2 ${c.bg.replace('bg-', 'border-')}`}>
        „{profile.kern_insight}"
      </blockquote>

      {/* Axes */}
      <section className="mb-10">
        <SectionKicker label="Kommunikationsstil" />
        <p className="serif-body text-lg text-ink mb-6">{profile.kommunikationsstil.beschreibung}</p>
        <div className="space-y-4">
          <AxisSlider label="Direkt" rightLabel="Indirekt" value={profile.kommunikationsstil.achsen.direktIndirekt} color={c.bg} />
          <AxisSlider label="Emotional" rightLabel="Sachlich" value={profile.kommunikationsstil.achsen.emotionalSachlich} color={c.bg} />
          <AxisSlider label="Ausführlich" rightLabel="Knapp" value={profile.kommunikationsstil.achsen.ausfuehrlichKnapp} color={c.bg} />
          <AxisSlider label="Initiierend" rightLabel="Reagierend" value={profile.kommunikationsstil.achsen.initiierendReagierend} color={c.bg} />
        </div>
      </section>

      {/* Frameworks */}
      <Framework
        thinker="Karen Horney"
        topic="Interpersonelle Orientierung"
        tag={horneyLabel(profile.horney.orientierung)}
        color={c}
        text={profile.horney.interpretation}
        evidence={profile.horney.evidenz}
      />
      <Framework
        thinker="Eric Berne"
        topic="Ich-Zustände"
        tag={berneLabel(profile.berne.dominanter_zustand, profile.berne.nuance)}
        color={c}
        text={profile.berne.interpretation}
        evidence={profile.berne.evidenz}
      />
      <Framework
        thinker="John Bowlby"
        topic="Bindungsstil-Tendenz"
        tag={bowlbyLabel(profile.bowlby.tendenz)}
        color={c}
        confidenceTag={confidenceLabel(profile.bowlby.sicherheit)}
        text={profile.bowlby.interpretation}
        evidence={profile.bowlby.evidenz}
      />
      <Framework
        thinker="Alfred Adler"
        topic="Kompensationsmuster"
        tag={profile.adler.kompensation}
        color={c}
        text={profile.adler.interpretation}
        evidence={profile.adler.evidenz}
      />
      <Framework
        thinker="Erving Goffman"
        topic="Front Stage / Back Stage"
        tag="Performance & Durchbrüche"
        color={c}
        text={
          <>
            <p className="mb-3">
              <span className="label-mono mr-2">Front</span>
              {profile.goffman.front_stage}
            </p>
            <p className="mb-3">
              <span className="label-mono mr-2">Back</span>
              {profile.goffman.back_stage_durchbrueche}
            </p>
            <p>{profile.goffman.interpretation}</p>
          </>
        }
        evidence={profile.goffman.evidenz}
      />

      {/* Fingerprints */}
      <section className="mt-10 pt-8 border-t border-line/40">
        <SectionKicker label="Sprachliche Fingerabdrücke" />
        <div className="grid md:grid-cols-2 gap-6">
          <FingerprintBlock
            label="Lieblings-Formulierungen"
            items={profile.sprachliche_fingerabdruecke.lieblings_formulierungen}
            color={c.text}
          />
          <FingerprintBlock
            label="Typische Satzanfänge"
            items={profile.sprachliche_fingerabdruecke.wiederkehrende_satzanfaenge}
            color={c.text}
          />
        </div>
        <p className="serif-body text-base text-ink-muted mt-5">
          {profile.sprachliche_fingerabdruecke.zeichensetzung}
        </p>
      </section>
    </article>
  )
}

function SectionKicker({ label }: { label: string }) {
  return <div className="label-mono text-ink-muted mb-4">{label}</div>
}

function AxisSlider({ label, rightLabel, value, color }: { label: string; rightLabel: string; value: number; color: string }) {
  // value in -10..10
  const pct = ((value + 10) / 20) * 100
  return (
    <div>
      <div className="flex justify-between text-[11px] font-mono mb-1.5 text-ink-faint uppercase tracking-widest">
        <span className={value < -2 ? 'text-ink' : ''}>{label}</span>
        <span className={value > 2 ? 'text-ink' : ''}>{rightLabel}</span>
      </div>
      <div className="relative h-[3px] bg-line rounded-full">
        <div className="absolute inset-y-0 left-1/2 w-px bg-ink-faint/40" />
        <div
          className={`absolute -top-1.5 w-3 h-3 ${color} rounded-full shadow-lg transition-all duration-1000 ease-out`}
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
    </div>
  )
}

function Framework({
  thinker,
  topic,
  tag,
  color,
  confidenceTag,
  text,
  evidence,
}: {
  thinker: string
  topic: string
  tag: string
  color: (typeof PERSON_COLORS)[number]
  confidenceTag?: string
  text: React.ReactNode
  evidence: string[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <section className="mt-8 pt-8 border-t border-line/40">
      <button onClick={() => setOpen((v) => !v)} className="w-full text-left group">
        <div className="flex items-baseline justify-between gap-4 mb-3">
          <div>
            <div className="label-mono mb-1">{thinker} · {topic}</div>
            <div className={`font-serif text-2xl md:text-3xl ${color.text} leading-tight group-hover:opacity-90 transition-opacity`}>
              {tag}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {confidenceTag && (
              <span className="label-mono text-ink-muted border border-line/60 rounded-full px-2 py-0.5">
                {confidenceTag}
              </span>
            )}
            <span className="label-mono text-ink-faint group-hover:text-ink transition-colors">{open ? '−' : '+'}</span>
          </div>
        </div>
      </button>
      {open && (
        <div className="mt-4 space-y-4 animate-fade-in">
          <div className="serif-body text-lg text-ink">{text}</div>
          {evidence.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-line/30">
              <div className="label-mono">Evidenz im Chat</div>
              {evidence.map((e, i) => (
                <div key={i} className="font-mono text-sm text-ink-muted pl-3 border-l border-line">
                  „{e}"
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function FingerprintBlock({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div>
      <div className="label-mono mb-3">{label}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((it, i) => (
          <span key={i} className={`font-mono text-sm bg-bg-surface/70 border border-line/50 rounded px-2.5 py-1 ${color}`}>
            {it}
          </span>
        ))}
      </div>
    </div>
  )
}

function horneyLabel(o: string): string {
  return {
    zu_menschen: 'Zu den Menschen hin (Nähe-suchend)',
    gegen_menschen: 'Gegen die Menschen (Dominanz)',
    von_menschen: 'Von den Menschen weg (Rückzug)',
    gemischt: 'Gemischte Orientierung',
  }[o] ?? o
}

function berneLabel(state: string, nuance: string | null | undefined): string {
  const base = {
    eltern_ich: 'Eltern-Ich',
    erwachsenen_ich: 'Erwachsenen-Ich',
    kind_ich: 'Kind-Ich',
    gemischt: 'Gemischt',
  }[state] ?? state
  const nuanceMap: Record<string, string> = {
    fürsorglich: 'fürsorglich',
    kritisch: 'kritisch',
    sachlich_rational: 'sachlich-rational',
    spontan: 'spontan',
    angepasst: 'angepasst',
    rebellisch: 'rebellisch',
  }
  const n = nuance ? nuanceMap[nuance] ?? nuance : null
  return n ? `${base} · ${n}` : base
}

function bowlbyLabel(t: string): string {
  return {
    sicher: 'Sicher',
    aengstlich_ambivalent: 'Ängstlich-ambivalent',
    vermeidend: 'Vermeidend',
    desorganisiert: 'Desorganisiert',
  }[t] ?? t
}

function confidenceLabel(s: string): string {
  return {
    niedrig: 'Sicherheit: niedrig',
    mittel: 'Sicherheit: mittel',
    hoch: 'Sicherheit: hoch',
  }[s] ?? s
}
