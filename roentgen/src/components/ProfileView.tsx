import { useState } from 'react'
import type { ProfileResult } from '../ai/types'
import { t, useLocale, type Locale } from '../i18n'
import { AiDisclosure } from './AiDisclosure'

interface Props {
  profiles: ProfileResult[]
  chatId: string | null
  onGoToRelationship?: () => void
  onRerun?: () => void
}

const PERSON_COLORS = [
  { text: 'text-a', bg: 'bg-a', ring: 'ring-a', dim: 'text-a/60', glow: 'bg-a/10' },
  { text: 'text-b', bg: 'bg-b', ring: 'ring-b', dim: 'text-b/60', glow: 'bg-b/10' },
  { text: 'text-blue-400', bg: 'bg-blue-400', ring: 'ring-blue-400', dim: 'text-blue-400/60', glow: 'bg-blue-400/10' },
  { text: 'text-orange-400', bg: 'bg-orange-400', ring: 'ring-orange-400', dim: 'text-orange-400/60', glow: 'bg-orange-400/10' },
]

export function ProfileView({ profiles, onGoToRelationship, onRerun }: Props) {
  const locale = useLocale()
  const r = (en: string, de: string) => (locale === 'de' ? de : en)
  const result = profiles[0]

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 pt-12 pb-24 space-y-12">
      <header className="space-y-6 relative">
        {onRerun && (
          <button
            onClick={onRerun}
            className="absolute top-0 right-0 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/60 hover:text-ink underline underline-offset-4 decoration-dotted"
          >
            ↻ {t('rerun.cta', locale, { lang: t(`rerun.lang.${locale}`, locale) })}
          </button>
        )}
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">
          {r('files · your portrait', 'akten · dein portrait')}
        </div>
        <AiDisclosure />
        <h2 className="font-serif italic text-[14vw] md:text-[120px] leading-[0.85] tracking-tight">
          {r('you.', 'du.')}
        </h2>
        <p className="serif-body text-base md:text-lg max-w-2xl mt-2">
          {r(
            "An honest read — only for you. The other person didn't sign off on being read, so I don't touch them.",
            'Ein ehrliches Portrait — nur für dich. Die andere Person hat nicht zugestimmt, also lese ich sie nicht.',
          )}
        </p>
      </header>

      {result && <ProfileCard result={result} colorIdx={0} locale={locale} />}

      {onGoToRelationship && (
        <section className="card relative overflow-hidden text-center">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-a/10 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="label-mono text-a mb-3">{r('Up next', 'Als nächstes')}</div>
            <h3 className="font-serif text-3xl md:text-4xl leading-tight mb-3">
              {locale === 'de' ? (
                <>Was <span className="italic text-ink-muted">zwischen</span> euch läuft.</>
              ) : (
                <>What's <span className="italic text-ink-muted">between</span> you.</>
              )}
            </h3>
            <p className="serif-body text-base text-ink-muted max-w-xl mx-auto mb-6">
              {r(
                "Who gives, who holds back, how you fight, how close you let each other, which rules you've never said out loud — not the individuals, but the space between.",
                'Wer gibt, wer hält zurück, wie ihr streitet, wie nah ihr euch lasst, welche Regeln nie ausgesprochen wurden — nicht die einzelnen, sondern der Raum dazwischen.',
              )}
            </p>
            <button
              onClick={onGoToRelationship}
              className="px-6 py-3 bg-a text-bg rounded-full font-sans text-sm tracking-wide hover:bg-a/90 transition-colors"
            >
              {r('Show the dynamic →', 'Zeig die Dynamik →')}
            </button>
          </div>
        </section>
      )}

      <div className="text-center serif-body text-ink-muted italic pt-6 border-t border-line/40">
        "{r('A read, not a diagnosis. For the real stuff, see a professional.', 'Eine Lesart, keine Diagnose. Für die echten Fragen → zu einer Fachperson.')}"
      </div>
    </div>
  )
}

function ProfileCard({ result, colorIdx, locale }: { result: ProfileResult; colorIdx: number; locale: Locale }) {
  const { profile } = result
  const c = PERSON_COLORS[colorIdx % PERSON_COLORS.length]
  const r = (en: string, de: string) => (locale === 'de' ? de : en)

  return (
    <article className={`card relative overflow-hidden`}>
      {/* Ambient glow */}
      <div className={`absolute -top-20 -right-20 w-64 h-64 rounded-full ${c.glow} blur-3xl pointer-events-none`} />

      <header className="relative flex items-baseline justify-between mb-8 pb-6 border-b border-line/40">
        <div>
          <div className="label-mono mb-2">{r('Portrait', 'Portrait')}</div>
          <h3 className={`font-serif text-5xl md:text-6xl ${c.text} tracking-tight`}>{profile.person}</h3>
        </div>
      </header>

      {/* Key insight */}
      <blockquote className={`relative font-serif italic text-2xl md:text-3xl leading-snug ${c.text} mb-10 pl-6 border-l-2 ${c.bg.replace('bg-', 'border-')}`}>
        "{profile.kern_insight}"
      </blockquote>

      {/* How they write — prose only, numeric axis sliders were too clinical. */}
      <section className="mb-10">
        <SectionKicker label={r('How they write here', 'Schreibstil in diesem Chat')} />
        <p className="serif-body text-lg text-ink">{profile.kommunikationsstil.beschreibung}</p>
      </section>

      {/* Frameworks — no theorist labels */}
      <Framework
        thinker=""
        topic={r('How this person meets others', 'Wie diese Person auf andere zugeht')}
        tag={horneyLabel(profile.horney.orientierung, locale)}
        color={c}
        text={profile.horney.interpretation}
        evidence={profile.horney.evidenz}
        locale={locale}
      />
      <Framework
        thinker=""
        topic={r('Which inner voice is speaking here', 'Welche innere Stimme hier spricht')}
        tag={berneLabel(profile.berne.dominanter_zustand, profile.berne.nuance, locale)}
        color={c}
        text={profile.berne.interpretation}
        evidence={profile.berne.evidenz}
        locale={locale}
      />
      <Framework
        thinker=""
        topic={r('How this person handles closeness', 'Wie diese Person mit Nähe umgeht')}
        tag={bowlbyLabel(profile.bowlby.tendenz, locale)}
        color={c}
        text={profile.bowlby.interpretation}
        evidence={profile.bowlby.evidenz}
        locale={locale}
      />
      <Framework
        thinker=""
        topic={r('What this person compensates for', 'Was diese Person kompensiert')}
        tag={profile.adler.kompensation}
        color={c}
        text={profile.adler.interpretation}
        evidence={profile.adler.evidenz}
        locale={locale}
      />
      <Framework
        thinker=""
        topic={r('The facade — and when it slips', 'Die Fassade — und wann sie rutscht')}
        tag={r('Front & backstage', 'Front & Backstage')}
        color={c}
        text={
          <>
            <p className="mb-3">
              <span className="label-mono mr-2">{r('Front', 'Front')}</span>
              {profile.goffman.front_stage}
            </p>
            <p className="mb-3">
              <span className="label-mono mr-2">{r('Behind', 'Dahinter')}</span>
              {profile.goffman.back_stage_durchbrueche}
            </p>
            <p>{profile.goffman.interpretation}</p>
          </>
        }
        evidence={profile.goffman.evidenz}
        locale={locale}
      />

      {/* Fingerprints */}
      <section className="mt-10 pt-8 border-t border-line/40">
        <SectionKicker label={r('Signature words & patterns', 'Signature-Wörter & Patterns')} />
        <div className="grid md:grid-cols-2 gap-6">
          <FingerprintBlock
            label={r('Favorite phrases', 'Lieblings-Phrasen')}
            items={profile.sprachliche_fingerabdruecke.lieblings_formulierungen}
            color={c.text}
          />
          <FingerprintBlock
            label={r('Typical sentence starts', 'Typische Satzanfänge')}
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

function Framework({
  thinker,
  topic,
  tag,
  color,
  confidenceTag,
  text,
  evidence,
  locale,
}: {
  thinker: string
  topic: string
  tag: string
  color: (typeof PERSON_COLORS)[number]
  confidenceTag?: string
  text: React.ReactNode
  evidence: string[]
  locale?: Locale
}) {
  const [open, setOpen] = useState(false)
  const evidenceLabel = locale === 'de' ? 'Direkt aus dem Chat' : 'Straight from the chat'
  return (
    <section className="mt-8 pt-8 border-t border-line/40">
      <button onClick={() => setOpen((v) => !v)} className="w-full text-left group">
        <div className="flex items-baseline justify-between gap-4 mb-3">
          <div>
            <div className="label-mono mb-1">{thinker ? `${thinker} · ${topic}` : topic}</div>
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
              <div className="label-mono">{evidenceLabel}</div>
              {evidence.map((e, i) => (
                <div key={i} className="font-mono text-sm text-ink-muted pl-3 border-l border-line">
                  "{e}"
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

function horneyLabel(o: string, locale?: Locale): string {
  if (locale === 'de') {
    return {
      zu_menschen: 'Geht auf Leute zu (sucht Nähe)',
      gegen_menschen: 'Geht gegen Leute (übernimmt die Führung)',
      von_menschen: 'Geht weg von Leuten (zieht sich zurück)',
      gemischt: 'Gemischte Orientierung',
    }[o] ?? o
  }
  return {
    zu_menschen: 'Moves toward people (seeks closeness)',
    gegen_menschen: 'Moves against people (takes charge)',
    von_menschen: 'Moves away from people (withdraws)',
    gemischt: 'Mixed orientation',
  }[o] ?? o
}

function berneLabel(state: string, nuance: string | null | undefined, locale?: Locale): string {
  const isDe = locale === 'de'
  const base = isDe
    ? ({
        eltern_ich: 'Eltern-Mode',
        erwachsenen_ich: 'Erwachsenen-Mode',
        kind_ich: 'Kind-Mode',
        gemischt: 'Gemischt',
      } as Record<string, string>)[state] ?? state
    : ({
        eltern_ich: 'Parent mode',
        erwachsenen_ich: 'Adult mode',
        kind_ich: 'Child mode',
        gemischt: 'Mixed',
      } as Record<string, string>)[state] ?? state
  const nuanceMap: Record<string, string> = isDe
    ? {
        fürsorglich: 'fürsorglich',
        kritisch: 'kritisch',
        sachlich_rational: 'sachlich',
        spontan: 'spontan',
        angepasst: 'angepasst',
        rebellisch: 'rebellisch',
      }
    : {
        fürsorglich: 'caring',
        kritisch: 'critical',
        sachlich_rational: 'matter-of-fact',
        spontan: 'spontaneous',
        angepasst: 'adaptive',
        rebellisch: 'rebellious',
      }
  const n = nuance ? nuanceMap[nuance] ?? nuance : null
  return n ? `${base} · ${n}` : base
}

function bowlbyLabel(t: string, locale?: Locale): string {
  if (locale === 'de') {
    return {
      sicher: 'Sicher',
      aengstlich_ambivalent: 'Ängstlich / ambivalent',
      vermeidend: 'Vermeidend',
      desorganisiert: 'Desorganisiert',
    }[t] ?? t
  }
  return {
    sicher: 'Secure',
    aengstlich_ambivalent: 'Anxious / ambivalent',
    vermeidend: 'Avoidant',
    desorganisiert: 'Disorganized',
  }[t] ?? t
}

