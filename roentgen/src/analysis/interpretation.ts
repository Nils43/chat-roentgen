import type { HardFacts, PerPersonStats } from './hardFacts'
import type { Locale } from '../i18n'

// Template-based interpretation snippets for Hard Facts.
// Both English and German variants — picked by metric value, not random.

export interface Interpretation {
  metric: string
  body: string
}

function pickShareInterpretation(p: PerPersonStats, locale: Locale): string {
  const s = p.sharePct
  if (locale === 'de') {
    if (s >= 70) return `${p.author} schreibt ${s.toFixed(0)}% aller Messages. Klares Gefälle — eine:r gibt deutlich mehr als die andere Seite.`
    if (s >= 60) return `${p.author} steuert ${s.toFixed(0)}% der Wörter bei. Spürbar ungleich, aber noch im Rahmen wenn eine Person gesprächiger ist.`
    if (s >= 55) return `${p.author} schreibt mit ${s.toFixed(0)}% etwas mehr. Kleine Unwucht, wie man sie bei der gesprächigeren Person erwartet.`
    if (s >= 45) return `Beide schreiben ungefähr gleich viel. Der Effort ist verteilt — auf beiden Seiten ähnliches Engagement.`
    return ''
  }
  if (s >= 70) return `${p.author} writes ${s.toFixed(0)}% of all messages. A clear gap — one of them is giving much more than the other.`
  if (s >= 60) return `${p.author} puts in ${s.toFixed(0)}% of the words. Noticeably uneven, but still within the normal range when one person is chattier.`
  if (s >= 55) return `${p.author} writes a bit more at ${s.toFixed(0)}%. Small imbalance, the kind you'd expect when one person is just more talkative.`
  if (s >= 45) return `Both write roughly the same amount. The giving is spread out — a sign of similar engagement on both sides.`
  return ''
}

function pickInitiationInterpretation(p: PerPersonStats, locale: Locale): string {
  const share = p.initiationShare * 100
  if (locale === 'de') {
    if (share >= 75) return `${p.author} macht nach Pausen in ${share.toFixed(0)}% der Fälle den ersten Move. Wer nach der Stille zuerst schreibt, denkt zuerst an die andere Person.`
    if (share >= 60) return `${p.author} schreibt nach Pausen überdurchschnittlich oft zuerst (${share.toFixed(0)}%). Liest sich wie aktives Interesse.`
    return ''
  }
  if (share >= 75) return `${p.author} makes the first move after pauses in ${share.toFixed(0)}% of cases. Whoever writes first after silence is thinking of the other first.`
  if (share >= 60) return `${p.author} is the first to write after pauses above average (${share.toFixed(0)}%). That reads as active interest.`
  return ''
}

function pickReplyInterpretation(p: PerPersonStats, locale: Locale): string {
  const ms = p.medianReplyMs
  if (ms == null) return ''
  const min = ms / 60000
  if (locale === 'de') {
    if (min < 2) return `${p.author} antwortet meistens in unter 2 Minuten. High availability — zeitlich oder emotional.`
    if (min < 10) return `${p.author} antwortet meistens innerhalb von ${Math.round(min)} Minuten. Schnell und präsent.`
    if (min < 60) return `${p.author} antwortet typischerweise nach ${Math.round(min)} Minuten.`
    if (min < 240) return `${p.author} braucht etwa ${Math.round(min / 60)} Stunden zum Antworten. Kann Absicht sein, kann einfach Alltag sein.`
    return `${p.author} antwortet erst nach ${Math.round(min / 60)} Stunden. In enger Bindung klares Distanz-Signal — in losem Kontakt völlig normal.`
  }
  if (min < 2) return `${p.author} usually replies in under 2 minutes. A sign of high availability — either in time or emotionally.`
  if (min < 10) return `${p.author} usually replies within ${Math.round(min)} minutes. Quick and present.`
  if (min < 60) return `${p.author} typically answers after ${Math.round(min)} minutes.`
  if (min < 240) return `${p.author} takes around ${Math.round(min / 60)} hours to reply. Could be intentional distance, could just be life.`
  return `${p.author} only replies after ${Math.round(min / 60)} hours. In a close bond that's a clear distance signal — in a loose contact, totally normal.`
}

function pickQuestionInterpretation(p: PerPersonStats, locale: Locale): string {
  const r = p.questionRatio * 100
  if (locale === 'de') {
    if (r >= 30) return `Fast jede dritte Message von ${p.author} endet mit Fragezeichen (${r.toFixed(0)}%). Starkes Interesse — ${p.author} lässt Raum für die andere Person.`
    if (r >= 18) return `${p.author} stellt in ${r.toFixed(0)}% der Messages Fragen. Offen, aufmerksam, neugierig.`
    if (r < 8) return `Nur ${r.toFixed(0)}% der Messages von ${p.author} sind Fragen. Wenig Fragen — kann Confidence sein, kann Desinteresse sein, kann einfach Style sein.`
    return ''
  }
  if (r >= 30) return `Almost every third message from ${p.author} ends with a question mark (${r.toFixed(0)}%). Strong interest in the other person — ${p.author} leaves room for the other to talk.`
  if (r >= 18) return `${p.author} asks questions in ${r.toFixed(0)}% of messages. Open, attentive, curious.`
  if (r < 8) return `Only ${r.toFixed(0)}% of ${p.author}'s messages are questions. Not a lot of asking — could be confidence, could be disinterest, could just be a different style.`
  return ''
}

function pickHedgeInterpretation(p: PerPersonStats, locale: Locale): string {
  const r = p.hedgeRatio * 100
  if (locale === 'de') {
    if (r >= 40) return `${p.author} weicht ${r.toFixed(0)}% der Messages ab ("vielleicht", "eigentlich", "irgendwie"). Deutet auf Unsicherheit, Angst vor Ablehnung oder diplomatischen Ton.`
    if (r >= 20) return `${p.author} nutzt regelmäßig weiche Wörter wie "vielleicht" oder "eigentlich" (${r.toFixed(0)}%). Vorsichtig-abwägender Style.`
    return ''
  }
  if (r >= 40) return `${p.author} softens ${r.toFixed(0)}% of messages ("maybe", "actually", "kind of"). That points to uncertainty, wariness of rejection, or a diplomatic tone.`
  if (r >= 20) return `${p.author} regularly uses soft words like "maybe" or "actually" (${r.toFixed(0)}%). A careful, weighing style.`
  return ''
}

function pickEmojiInterpretation(p: PerPersonStats, locale: Locale): string {
  const e = p.emojiPerMsg
  if (locale === 'de') {
    if (e >= 1.5) return `${p.author} schickt im Schnitt ${e.toFixed(1)} Emojis pro Message. Ausdrucksstark, emotional direkt.`
    if (e < 0.15) return `${p.author} nutzt fast nie Emojis (${e.toFixed(2)} pro Message). Eher sachlich, text-first.`
    return ''
  }
  if (e >= 1.5) return `${p.author} sends ${e.toFixed(1)} emojis per message on average. Expressive and emotionally direct.`
  if (e < 0.15) return `${p.author} almost never uses emojis (${e.toFixed(2)} per message). More matter-of-fact, text-first style.`
  return ''
}

export function interpretHardFacts(facts: HardFacts, locale: Locale = 'en'): Interpretation[] {
  const out: Interpretation[] = []

  const primary = [...facts.perPerson].sort((a, b) => b.sharePct - a.sharePct)[0]
  if (primary) {
    const share = pickShareInterpretation(primary, locale)
    if (share) out.push({ metric: 'share', body: share })
  }

  for (const p of facts.perPerson) {
    const init = pickInitiationInterpretation(p, locale)
    if (init) out.push({ metric: `init:${p.author}`, body: init })
    const reply = pickReplyInterpretation(p, locale)
    if (reply) out.push({ metric: `reply:${p.author}`, body: reply })
    const q = pickQuestionInterpretation(p, locale)
    if (q) out.push({ metric: `question:${p.author}`, body: q })
    const h = pickHedgeInterpretation(p, locale)
    if (h) out.push({ metric: `hedge:${p.author}`, body: h })
    const e = pickEmojiInterpretation(p, locale)
    if (e) out.push({ metric: `emoji:${p.author}`, body: e })
  }

  if (facts.perPerson.length >= 2 && facts.investmentDelta >= 20) {
    const sorted = [...facts.perPerson].sort((a, b) => b.powerScore - a.powerScore)
    out.push({
      metric: 'delta',
      body:
        locale === 'de'
          ? `Der Effort ist klar ungleich. ${sorted[1].author} gibt durchgehend mehr — in Volume, beim ersten Move, in der Reply-Speed. Die relaxte Position gehört meistens der Seite, die weniger gibt.`
          : `The effort is clearly uneven. ${sorted[1].author} gives more across the board — in volume, in making the first move, in how fast they reply. Usually the more relaxed position belongs to whoever gives less.`,
    })
  }

  return out
}
