import type { HardFacts, PerPersonStats } from './hardFacts'
import type { Locale } from '../i18n'

// Local-only "spicy takes" — short, sharp, brand-voice interpretive lines
// derived from the Hard Facts purely by threshold rules. No AI call. The
// same gen-z voice the AI prompts use, just shaped by code.
//
// Output is keyed by room id so HardFactsView can pull `takes.split`,
// `takes.pace` etc. and render them as pull quotes inside each section.
// First sentence is always the punch (renders larger); remaining text
// grounds it.
//
// Threshold rule: each function returns null when nothing notable shows
// up — better an empty section than a vague filler line.

export interface SpicyTakes {
  share: string | null
  pace: string | null
  initiation: string | null
  nights: string | null
  bursts: string | null
  silence: string | null
  hedge: string | null
  questions: string | null
  emoji: string | null
  arc: string | null
  delta: string | null
}

export function spicyTakes(facts: HardFacts, locale: Locale = 'de'): SpicyTakes {
  return {
    share: takeShare(facts, locale),
    pace: takePace(facts, locale),
    initiation: takeInitiation(facts, locale),
    nights: takeNights(facts, locale),
    bursts: takeBursts(facts, locale),
    silence: takeSilence(facts, locale),
    hedge: takeHedge(facts, locale),
    questions: takeQuestions(facts, locale),
    emoji: takeEmoji(facts, locale),
    arc: takeArc(facts, locale),
    delta: takeDelta(facts, locale),
  }
}

// --- per-metric takes -----------------------------------------------------

function takeShare(facts: HardFacts, locale: Locale): string | null {
  const sorted = [...facts.perPerson].sort((a, b) => b.sharePct - a.sharePct)
  const top = sorted[0]
  if (!top) return null
  const pct = Math.round(top.sharePct)
  if (locale === 'de') {
    if (pct >= 70) return `${top.author} trägt das Gespräch fast allein — ${pct} %. Solo-Auftritt, kein Co-Star. Wer so viel schreibt, hält die Verbindung am Leben.`
    if (pct >= 60) return `${top.author} schreibt ${pct} %. Spürbar mehr. Meistens hängt das daran, wer die Stille schlechter aushält.`
    if (pct >= 55) return `${top.author} schreibt minimal mehr (${pct} %). Liegt im Rauschen — eine Person ist halt gesprächiger.`
    if (pct >= 45) return `Beide schreiben ungefähr gleich viel. Niemand zieht allein, niemand hängt zurück.`
    return null
  }
  if (pct >= 70) return `${top.author} carries the chat almost alone — ${pct}%. Solo act, no co-star. Whoever writes that much keeps the line open.`
  if (pct >= 60) return `${top.author} writes ${pct}%. Noticeably more. Usually that comes down to who can't sit with silence.`
  if (pct >= 55) return `${top.author} writes a touch more (${pct}%). Within the noise — one of you is just chattier.`
  if (pct >= 45) return `Both write roughly the same. Nobody is carrying it alone, nobody is hanging back.`
  return null
}

function takePace(facts: HardFacts, locale: Locale): string | null {
  const withTime = facts.perPerson.filter((p): p is PerPersonStats & { medianReplyMs: number } => p.medianReplyMs != null)
  if (withTime.length < 2) return null
  const sorted = [...withTime].sort((a, b) => a.medianReplyMs - b.medianReplyMs)
  const fast = sorted[0]
  const slow = sorted[sorted.length - 1]
  const fastMin = fast.medianReplyMs / 60000
  const slowMin = slow.medianReplyMs / 60000
  const ratio = slowMin / Math.max(1, fastMin)
  // Same person — skip.
  if (fast.author === slow.author) return null
  if (locale === 'de') {
    if (ratio >= 10) {
      return `${fast.author} antwortet in ${formatTime(fastMin, 'de')} — ${slow.author} braucht ${formatTime(slowMin, 'de')}. Verschiedene Sportarten. Wer länger wartet, sitzt am längeren Hebel.`
    }
    if (ratio >= 3) {
      return `${fast.author} ist deutlich schneller (${formatTime(fastMin, 'de')}) als ${slow.author} (${formatTime(slowMin, 'de')}). Klares Tempo-Gefälle.`
    }
    return `Beide antworten in einem ähnlichen Takt — irgendwo zwischen ${formatTime(fastMin, 'de')} und ${formatTime(slowMin, 'de')}. Match.`
  }
  if (ratio >= 10) {
    return `${fast.author} replies in ${formatTime(fastMin, 'en')} — ${slow.author} takes ${formatTime(slowMin, 'en')}. Different sports. Whoever waits longer holds the longer lever.`
  }
  if (ratio >= 3) {
    return `${fast.author} is noticeably faster (${formatTime(fastMin, 'en')}) than ${slow.author} (${formatTime(slowMin, 'en')}). Clear pace gap.`
  }
  return `Both reply at a similar tempo — somewhere between ${formatTime(fastMin, 'en')} and ${formatTime(slowMin, 'en')}. Matched.`
}

function takeInitiation(facts: HardFacts, locale: Locale): string | null {
  const sorted = [...facts.perPerson].sort((a, b) => b.initiationShare - a.initiationShare)
  const top = sorted[0]
  if (!top) return null
  const pct = Math.round(top.initiationShare * 100)
  if (locale === 'de') {
    if (pct >= 75) return `${top.author} bricht die Stille in 3 von 4 Fällen zuerst. Wer den Faden nach einer Pause wieder aufnimmt, denkt zuerst an die andere Person.`
    if (pct >= 60) return `${top.author} schreibt nach Pausen öfter zuerst (${pct} %). Liest sich wie aktives Halten.`
    return null
  }
  if (pct >= 75) return `${top.author} breaks the silence first 3 out of 4 times. Whoever picks up the thread after a pause is thinking about the other person first.`
  if (pct >= 60) return `${top.author} is more often the one writing first after a lull (${pct}%). Reads as actively holding it.`
  return null
}

function takeNights(facts: HardFacts, locale: Locale): string | null {
  const sorted = [...facts.perPerson].sort((a, b) => b.lateNightCount - a.lateNightCount)
  const top = sorted[0]
  if (!top || top.lateNightCount < 5) return null
  const ratio = Math.round(top.lateNightRatio * 100)
  if (locale === 'de') {
    if (top.lateNightCount >= 50 || ratio >= 25) {
      return `${top.author} schreibt ${top.lateNightCount}× zwischen 23 und 5 Uhr. Das sind nicht die Nachrichten von 14 Uhr — wenn die Filter unten sind, kommt anderes.`
    }
    return `${top.author} ist ${top.lateNightCount}× nachts unterwegs gewesen. Selten genug, um aufzufallen — oft genug, um Muster zu sein.`
  }
  if (top.lateNightCount >= 50 || ratio >= 25) {
    return `${top.author} writes ${top.lateNightCount}× between 11 PM and 5 AM. Not the same messages 2 PM would write — when the filter drops, something else comes through.`
  }
  return `${top.author} sent ${top.lateNightCount} late-night messages. Rare enough to notice, frequent enough to call a pattern.`
}

function takeBursts(facts: HardFacts, locale: Locale): string | null {
  const sorted = [...facts.perPerson].sort((a, b) => b.longestBurst - a.longestBurst)
  const top = sorted[0]
  if (!top || top.longestBurst < 6) return null
  if (locale === 'de') {
    return `${top.author} hat einen Lauf von ${top.longestBurst} Nachrichten ohne Antwort hingelegt. Wer monologisiert, wartet auf etwas Bestimmtes.`
  }
  return `${top.author} once sent ${top.longestBurst} messages in a row without a reply. People monologue when they're waiting for one specific thing.`
}

function takeSilence(facts: HardFacts, locale: Locale): string | null {
  const days = facts.longestSilenceDays
  if (days < 4) return null
  if (locale === 'de') {
    if (days >= 14) return `${days} Tage Funkstille. Niemand hat angefangen — niemand hat aufgehört. Schlimmer als ein Streit ist meistens das Schweigen, das niemand benennt.`
    if (days >= 7) return `Eine Woche Pause (${days} Tage). Lang genug, um sich zu fragen, ob's noch geht.`
    return `${days} Tage am Stück nichts. Eine Pause, die zu kurz ist für einen Streit, zu lang für Zufall.`
  }
  if (days >= 14) return `${days} days of silence. Nobody started it — nobody ended it. The fight nobody names usually does more damage than the one they have.`
  if (days >= 7) return `A week-long gap (${days} days). Long enough to make either of you wonder.`
  return `${days} days with nothing. Too short for a fight, too long to be coincidence.`
}

function takeHedge(facts: HardFacts, locale: Locale): string | null {
  const sorted = [...facts.perPerson].sort((a, b) => b.hedgeRatio - a.hedgeRatio)
  const top = sorted[0]
  if (!top) return null
  const pct = Math.round(top.hedgeRatio * 100)
  if (locale === 'de') {
    if (pct >= 30) return `${top.author} packt fast jede Aussage in ein Vielleicht (${pct} %). Der Default-Modus ist Vorsicht — die Sicherheit, die das Vielleicht verspricht, hat einen Preis.`
    if (pct >= 18) return `${top.author} weicht in ${pct} % der Nachrichten aus. Diplomatisch — oder unsicher, je nachdem, wo du hinschaust.`
    return null
  }
  if (pct >= 30) return `${top.author} tucks almost every statement into a maybe (${pct}%). The default mode is caution — and the safety the maybe promises has a price.`
  if (pct >= 18) return `${top.author} hedges ${pct}% of messages. Diplomatic — or uncertain, depending on where you look.`
  return null
}

function takeQuestions(facts: HardFacts, locale: Locale): string | null {
  const sorted = [...facts.perPerson].sort((a, b) => b.questionRatio - a.questionRatio)
  const high = sorted[0]
  const low = sorted[sorted.length - 1]
  if (!high || !low) return null
  const highPct = Math.round(high.questionRatio * 100)
  const lowPct = Math.round(low.questionRatio * 100)
  if (high.author === low.author) return null
  if (locale === 'de') {
    if (highPct - lowPct >= 15) {
      return `${high.author} fragt (${highPct} %), ${low.author} antwortet (${lowPct} %). Wer fragt, hält den Raum offen — und wer wenig fragt, hat oft schon entschieden.`
    }
    if (highPct >= 25) {
      return `${high.author} stellt in ${highPct} % der Nachrichten Fragen. Hält den Raum aktiv für die andere Person offen.`
    }
    return null
  }
  if (highPct - lowPct >= 15) {
    return `${high.author} asks (${highPct}%), ${low.author} answers (${lowPct}%). Whoever asks holds the room open — whoever rarely asks has often already decided.`
  }
  if (highPct >= 25) {
    return `${high.author} asks questions in ${highPct}% of messages. Actively keeping the room open for the other person.`
  }
  return null
}

function takeEmoji(facts: HardFacts, locale: Locale): string | null {
  const withEmoji = facts.perPerson.filter((p) => p.emojiPerMsg > 0)
  if (withEmoji.length < 2) return null
  const sorted = [...facts.perPerson].sort((a, b) => b.emojiPerMsg - a.emojiPerMsg)
  const high = sorted[0]
  const low = sorted[sorted.length - 1]
  if (high.author === low.author) return null
  const ratio = high.emojiPerMsg / Math.max(0.05, low.emojiPerMsg)
  if (locale === 'de') {
    if (ratio >= 4) {
      return `${high.author} schickt deutlich mehr Emojis (${high.emojiPerMsg.toFixed(1)} pro Nachricht) als ${low.author} (${low.emojiPerMsg.toFixed(1)}). Verschiedene emotionale Lautstärken — und meistens versteht eine Seite die andere falsch.`
    }
    if (high.emojiPerMsg >= 1.5) {
      return `${high.author} schickt ${high.emojiPerMsg.toFixed(1)} Emojis pro Nachricht. Emotional direkt, kein Camouflage.`
    }
    return null
  }
  if (ratio >= 4) {
    return `${high.author} sends way more emojis (${high.emojiPerMsg.toFixed(1)} per message) than ${low.author} (${low.emojiPerMsg.toFixed(1)}). Different emotional volumes — and usually one side is misreading the other.`
  }
  if (high.emojiPerMsg >= 1.5) {
    return `${high.author} sends ${high.emojiPerMsg.toFixed(1)} emojis per message. Emotionally direct, no camouflage.`
  }
  return null
}

function takeArc(facts: HardFacts, locale: Locale): string | null {
  const weeks = facts.weekly ?? []
  if (weeks.length < 8) return null
  const half = Math.floor(weeks.length / 2)
  const first = weeks.slice(0, half).reduce((s, w) => s + w.count, 0) / Math.max(1, half)
  const second = weeks.slice(half).reduce((s, w) => s + w.count, 0) / Math.max(1, weeks.length - half)
  if (first === 0) return null
  const change = (second - first) / first
  const pct = Math.round(Math.abs(change) * 100)
  if (locale === 'de') {
    if (change >= 0.4) return `Der Chat zieht an. Die zweite Hälfte hat ${pct} % mehr Nachrichten als die erste. Etwas hat sich geöffnet.`
    if (change <= -0.4) return `Der Chat kühlt ab. Die zweite Hälfte hat ${pct} % weniger Nachrichten als die erste. Was vorher leicht war, ist jetzt Aufwand.`
    return null
  }
  if (change >= 0.4) return `The chat is heating up. The second half has ${pct}% more messages than the first. Something opened up.`
  if (change <= -0.4) return `The chat is cooling. The second half has ${pct}% fewer messages than the first. What used to be easy is now effort.`
  return null
}

function takeDelta(facts: HardFacts, locale: Locale): string | null {
  if (facts.perPerson.length < 2) return null
  if (facts.investmentDelta < 18) return null
  const sorted = [...facts.perPerson].sort((a, b) => b.powerScore - a.powerScore)
  const less = sorted[1]
  if (locale === 'de') {
    return `Eine Seite gibt durchgehend mehr — Volumen, erste Moves, Antwort-Tempo. Die entspannte Position gehört in der Regel der Seite, die weniger gibt: ${less.author}.`
  }
  return `One side gives more across the board — volume, first moves, reply speed. The relaxed position usually belongs to whoever gives less: ${less.author}.`
}

// --- helpers --------------------------------------------------------------

function formatTime(min: number, locale: Locale): string {
  if (min < 1) return locale === 'de' ? '< 1 Min.' : '< 1 min'
  if (min < 60) return locale === 'de' ? `${Math.round(min)} Min.` : `${Math.round(min)} min`
  const h = Math.round(min / 60)
  if (h < 24) return locale === 'de' ? `${h} Std.` : `${h}h`
  return locale === 'de' ? `${Math.round(h / 24)} Tg.` : `${Math.round(h / 24)}d`
}
