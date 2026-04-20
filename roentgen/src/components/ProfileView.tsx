import { useState, useSyncExternalStore } from 'react'
import type { ProfileResult } from '../ai/types'
import { chatLibrary } from '../store/chatLibrary'
import { tokenStore, MODULE_COSTS } from '../tokens/store'

interface Props {
  profiles: ProfileResult[]
  chatId: string | null
  onGoToHighlights?: () => void
  onGoToRelationship?: () => void
  onOpenTokens?: () => void
}

const PERSON_COLORS = [
  { text: 'text-a', bg: 'bg-a', ring: 'ring-a', dim: 'text-a/60', glow: 'bg-a/10' },
  { text: 'text-b', bg: 'bg-b', ring: 'ring-b', dim: 'text-b/60', glow: 'bg-b/10' },
  { text: 'text-blue-400', bg: 'bg-blue-400', ring: 'ring-blue-400', dim: 'text-blue-400/60', glow: 'bg-blue-400/10' },
  { text: 'text-orange-400', bg: 'bg-orange-400', ring: 'ring-orange-400', dim: 'text-orange-400/60', glow: 'bg-orange-400/10' },
]

export function ProfileView({ profiles, chatId, onGoToHighlights, onGoToRelationship, onOpenTokens }: Props) {
  // subscribe to chatLibrary so unlock state updates re-render
  const library = useSyncExternalStore(
    (l) => chatLibrary.subscribe(l),
    () => chatLibrary.get(),
    () => chatLibrary.get(),
  )
  const meta = chatId ? library.find((m) => m.id === chatId) : undefined
  const selfPerson = meta?.selfPerson ?? null
  const unlocked = new Set(meta?.unlockedProfiles ?? [])

  const setSelf = (person: string) => {
    if (chatId) chatLibrary.setSelf(chatId, person)
  }

  const unlock = (person: string) => {
    if (!chatId) return
    if (!tokenStore.charge('profiles')) {
      onOpenTokens?.()
      return
    }
    chatLibrary.unlockProfile(chatId, person)
  }

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 pt-12 pb-24 space-y-12">
      <header className="space-y-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">
          files · personal portraits
        </div>
        <h2 className="font-serif text-[14vw] md:text-[120px] leading-[0.85] tracking-tight">
          PROFILES
        </h2>
        <p className="serif-body text-base md:text-lg max-w-2xl mt-2">
          An honest portrait for each person. No labels, no judgement — only what the chat shows. <strong className="not-italic font-bold">Your own profile is free.</strong>
        </p>
      </header>

      {chatId && !selfPerson && profiles.length > 1 && (
        <div className="card" style={{ transform: 'rotate(-0.4deg)', boxShadow: '6px 6px 0 #0A0A0A' }}>
          <span className="exhibit-label">EXHIBIT 00: WHO ARE YOU?</span>
          <p className="serif-body text-base mt-2 mb-4">
            Tell us who you are in this chat. Your own profile is free. The others cost 1 ticket each.
          </p>
          <div className="flex flex-wrap gap-2">
            {profiles.map((p) => (
              <button
                key={p.profile.person}
                onClick={() => setSelf(p.profile.person)}
                className="btn-pop"
              >
                I AM {p.profile.person.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {profiles.map((result, i) => {
        const person = result.profile.person
        const isSelf = selfPerson === person
        const isLocked = selfPerson != null && !isSelf && !unlocked.has(person)
        return (
          <div key={person} className="relative">
            <ProfileCard result={result} colorIdx={i} />
            {isLocked && <ProfileLock person={person} onUnlock={() => unlock(person)} balance={tokenStore.get().balance} />}
            {isSelf && (
              <span
                className="absolute top-4 right-4 sticker sticker-tilt"
                style={{ transform: 'rotate(4deg)' }}
              >
                ✦ THAT'S YOU
              </span>
            )}
          </div>
        )
      })}

      {onGoToRelationship && (
        <section className="card relative overflow-hidden text-center">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-a/10 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="label-mono text-a mb-3">Up next</div>
            <h3 className="font-serif text-3xl md:text-4xl leading-tight mb-3">
              What's <span className="italic text-ink-muted">between</span> you.
            </h3>
            <p className="serif-body text-base text-ink-muted max-w-xl mx-auto mb-6">
              Who gives, who holds back, how you fight, how close you let each other, which rules you've never said out loud — not the individuals, but the space between.
            </p>
            <button
              onClick={onGoToRelationship}
              className="px-6 py-3 bg-a text-bg rounded-full font-sans text-sm tracking-wide hover:bg-a/90 transition-colors"
            >
              Show the dynamic →
            </button>
          </div>
        </section>
      )}

      {onGoToHighlights && (
        <section className="card relative overflow-hidden text-center">
          <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-b/10 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="label-mono text-b mb-3">Later</div>
            <h3 className="font-serif text-3xl md:text-4xl leading-tight mb-3">
              The <span className="italic text-ink-muted">moments</span> that stick.
            </h3>
            <p className="serif-body text-base text-ink-muted max-w-xl mx-auto mb-6">
              The messages that explain everything in hindsight — pulled out, decoded, placed in context.
            </p>
            <button
              onClick={onGoToHighlights}
              className="px-6 py-3 bg-b text-bg rounded-full font-sans text-sm tracking-wide hover:bg-b/90 transition-colors"
            >
              Show highlights →
            </button>
          </div>
        </section>
      )}

      <div className="text-center serif-body text-ink-muted italic pt-6 border-t border-line/40">
        "This is a read of your chat — not a diagnosis. For real questions, always ask a professional."
      </div>
    </div>
  )
}

function ProfileLock({ person, onUnlock, balance }: { person: string; onUnlock: () => void; balance: number }) {
  const cost = MODULE_COSTS.profiles.cost
  const canAfford = balance >= cost
  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-md"
      style={{ background: 'rgba(255, 144, 187, 0.55)' }}
    >
      <div
        className="card max-w-sm mx-4 text-center"
        style={{ transform: 'rotate(-1deg)', boxShadow: '6px 6px 0 #0A0A0A' }}
      >
        <span className="exhibit-label">EXHIBIT · LOCKED</span>
        <div className="font-serif text-3xl mt-3 mb-2 leading-tight">
          {person.toUpperCase()}'S PROFILE
        </div>
        <p className="serif-body text-base mb-5 text-ink/80">
          Who {person} really is — attachment style, communication patterns, what's behind the words. Names hidden locally, shown locally.
        </p>
        <button onClick={onUnlock} className="btn-pop w-full justify-center">
          {canAfford ? `UNLOCK ${person.toUpperCase()}` : 'TOP UP TICKETS'}
          <span className="text-[10px] font-mono opacity-70 ml-2">
            {canAfford ? `· ${cost} TICKET` : `· ${balance}/${cost}`}
          </span>
        </button>
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
          <div className="label-mono mb-2">Portrait</div>
          <h3 className={`font-serif text-5xl md:text-6xl ${c.text} tracking-tight`}>{profile.person}</h3>
        </div>
      </header>

      {/* Key insight */}
      <blockquote className={`relative font-serif italic text-2xl md:text-3xl leading-snug ${c.text} mb-10 pl-6 border-l-2 ${c.bg.replace('bg-', 'border-')}`}>
        "{profile.kern_insight}"
      </blockquote>

      {/* Axes */}
      <section className="mb-10">
        <SectionKicker label="How they write here" />
        <p className="serif-body text-lg text-ink mb-6">{profile.kommunikationsstil.beschreibung}</p>
        <div className="space-y-4">
          <AxisSlider label="Direct" rightLabel="Indirect" value={profile.kommunikationsstil.achsen.direktIndirekt} color={c.bg} />
          <AxisSlider label="Emotional" rightLabel="Matter-of-fact" value={profile.kommunikationsstil.achsen.emotionalSachlich} color={c.bg} />
          <AxisSlider label="Verbose" rightLabel="Terse" value={profile.kommunikationsstil.achsen.ausfuehrlichKnapp} color={c.bg} />
          <AxisSlider label="Initiating" rightLabel="Reacting" value={profile.kommunikationsstil.achsen.initiierendReagierend} color={c.bg} />
        </div>
      </section>

      {/* Frameworks — no theorist labels */}
      <Framework
        thinker=""
        topic="How this person meets others"
        tag={horneyLabel(profile.horney.orientierung)}
        color={c}
        text={profile.horney.interpretation}
        evidence={profile.horney.evidenz}
      />
      <Framework
        thinker=""
        topic="Which inner voice is speaking here"
        tag={berneLabel(profile.berne.dominanter_zustand, profile.berne.nuance)}
        color={c}
        text={profile.berne.interpretation}
        evidence={profile.berne.evidenz}
      />
      <Framework
        thinker=""
        topic="How this person handles closeness"
        tag={bowlbyLabel(profile.bowlby.tendenz)}
        color={c}
        confidenceTag={confidenceLabel(profile.bowlby.sicherheit)}
        text={profile.bowlby.interpretation}
        evidence={profile.bowlby.evidenz}
      />
      <Framework
        thinker=""
        topic="What this person compensates for"
        tag={profile.adler.kompensation}
        color={c}
        text={profile.adler.interpretation}
        evidence={profile.adler.evidenz}
      />
      <Framework
        thinker=""
        topic="The facade — and when it slips"
        tag="Front & backstage"
        color={c}
        text={
          <>
            <p className="mb-3">
              <span className="label-mono mr-2">Front</span>
              {profile.goffman.front_stage}
            </p>
            <p className="mb-3">
              <span className="label-mono mr-2">Behind</span>
              {profile.goffman.back_stage_durchbrueche}
            </p>
            <p>{profile.goffman.interpretation}</p>
          </>
        }
        evidence={profile.goffman.evidenz}
      />

      {/* Fingerprints */}
      <section className="mt-10 pt-8 border-t border-line/40">
        <SectionKicker label="Signature words & patterns" />
        <div className="grid md:grid-cols-2 gap-6">
          <FingerprintBlock
            label="Favorite phrases"
            items={profile.sprachliche_fingerabdruecke.lieblings_formulierungen}
            color={c.text}
          />
          <FingerprintBlock
            label="Typical sentence starts"
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
              <div className="label-mono">Examples straight from the chat</div>
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

function horneyLabel(o: string): string {
  return {
    zu_menschen: 'Moves toward people (seeks closeness)',
    gegen_menschen: 'Moves against people (takes charge)',
    von_menschen: 'Moves away from people (withdraws)',
    gemischt: 'Mixed orientation',
  }[o] ?? o
}

function berneLabel(state: string, nuance: string | null | undefined): string {
  const base = {
    eltern_ich: 'Parent mode',
    erwachsenen_ich: 'Adult mode',
    kind_ich: 'Child mode',
    gemischt: 'Mixed',
  }[state] ?? state
  const nuanceMap: Record<string, string> = {
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

function bowlbyLabel(t: string): string {
  return {
    sicher: 'Secure',
    aengstlich_ambivalent: 'Anxious / ambivalent',
    vermeidend: 'Avoidant',
    desorganisiert: 'Disorganized',
  }[t] ?? t
}

function confidenceLabel(s: string): string {
  return {
    niedrig: 'Confidence: low',
    mittel: 'Confidence: medium',
    hoch: 'Confidence: high',
  }[s] ?? s
}
