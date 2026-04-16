import type { HardFacts, PerPersonStats } from './hardFacts'

// Template-based interpretation snippets for Hard Facts.
// Keep the tone clinical-warm: describe patterns, don't moralize.
// Three variants per bucket, picked by metric value — not random.

export interface Interpretation {
  metric: string
  body: string
}

function pickShareInterpretation(p: PerPersonStats): string {
  const s = p.sharePct
  if (s >= 70) return `${p.author} schreibt ${s.toFixed(0)}% aller Nachrichten. Das ist ein starkes Gefälle — ein klarer Indikator für höheres emotionales Investment auf einer Seite.`
  if (s >= 60) return `${p.author} trägt ${s.toFixed(0)}% der Worte bei. Eine spürbare Asymmetrie, aber noch im Rahmen normaler Kommunikationsstile.`
  if (s >= 55) return `${p.author} führt mit ${s.toFixed(0)}% leicht. Kleines Ungleichgewicht, typisch wenn eine Person gesprächiger ist als die andere.`
  if (s >= 45) return `Die Verteilung ist weitgehend symmetrisch. Beide tragen ähnlich viel bei — das deutet auf vergleichbares Engagement hin.`
  return ''
}

function pickInitiationInterpretation(p: PerPersonStats): string {
  const share = p.initiationShare * 100
  if (share >= 75) return `${p.author} initiiert ${share.toFixed(0)}% der Gesprächsphasen. Das ist der härteste Investment-Indikator: Wer denkt an den anderen, wenn Stille herrscht.`
  if (share >= 60) return `${p.author} eröffnet neue Gesprächsphasen überproportional oft (${share.toFixed(0)}%). Deutet auf stärkeres aktives Interesse hin.`
  return ''
}

function pickReplyInterpretation(p: PerPersonStats): string {
  const ms = p.medianReplyMs
  if (ms == null) return ''
  const min = ms / 60000
  if (min < 2) return `${p.author} antwortet im Median nach unter 2 Minuten. Das signalisiert hohe Verfügbarkeit und Priorisierung — emotional oder funktional.`
  if (min < 10) return `${p.author} antwortet im Median in ${Math.round(min)} Minuten. Zügige, präsente Kommunikation.`
  if (min < 60) return `${p.author} antwortet im Median nach ${Math.round(min)} Minuten.`
  if (min < 240) return `${p.author} lässt sich im Median ${Math.round(min / 60)}h Zeit bis zur Antwort. Kann Distanzregulation sein, kann auch schlicht Alltagsrealität sein.`
  return `${p.author} antwortet erst nach ${Math.round(min / 60)}h im Median. Sehr verzögerte Reaktion — ein starkes Distanz-Signal in einer engen Beziehung, normal im lockeren Kontakt.`
}

function pickQuestionInterpretation(p: PerPersonStats): string {
  const r = p.questionRatio * 100
  if (r >= 30) return `Fast jede dritte Nachricht von ${p.author} enthält eine Frage (${r.toFixed(0)}%). Starkes Interesse am Gegenüber — ${p.author} gibt dem anderen die Gesprächsführung.`
  if (r >= 18) return `${p.author} stellt Fragen in ${r.toFixed(0)}% der Nachrichten. Aktives, offenes Gesprächsverhalten.`
  if (r < 8) return `Nur ${r.toFixed(0)}% der Nachrichten von ${p.author} enthalten eine Frage. Wenig explizites Nachfragen — kann Selbstsicherheit, Desinteresse oder schlicht ein anderer Stil sein.`
  return ''
}

function pickHedgeInterpretation(p: PerPersonStats): string {
  const r = p.hedgeRatio * 100
  if (r >= 40) return `${p.author} nutzt in ${r.toFixed(0)}% der Nachrichten abschwächende Formulierungen ("vielleicht", "eigentlich", "irgendwie"). Hohe Hedge-Rate — Unsicherheit, Vorsicht vor Ablehnung, oder diplomatischer Kommunikationsstil.`
  if (r >= 20) return `${p.author} verwendet regelmäßig Hedge-Wörter (${r.toFixed(0)}%). Deutet auf einen vorsichtigen, abwägenden Sprachstil hin.`
  return ''
}

function pickEmojiInterpretation(p: PerPersonStats): string {
  const e = p.emojiPerMsg
  if (e >= 1.5) return `${p.author} verwendet im Schnitt ${e.toFixed(1)} Emojis pro Nachricht. Expressiver, emotional geladener Kommunikationsstil.`
  if (e < 0.15) return `${p.author} verzichtet weitgehend auf Emojis (${e.toFixed(2)} pro Nachricht). Sachlicher oder textfokussierter Stil.`
  return ''
}

export function interpretHardFacts(facts: HardFacts): Interpretation[] {
  const out: Interpretation[] = []

  // Top-line asymmetry read
  const primary = [...facts.perPerson].sort((a, b) => b.sharePct - a.sharePct)[0]
  if (primary) {
    const share = pickShareInterpretation(primary)
    if (share) out.push({ metric: 'share', body: share })
  }

  for (const p of facts.perPerson) {
    const init = pickInitiationInterpretation(p)
    if (init) out.push({ metric: `init:${p.author}`, body: init })
    const reply = pickReplyInterpretation(p)
    if (reply) out.push({ metric: `reply:${p.author}`, body: reply })
    const q = pickQuestionInterpretation(p)
    if (q) out.push({ metric: `question:${p.author}`, body: q })
    const h = pickHedgeInterpretation(p)
    if (h) out.push({ metric: `hedge:${p.author}`, body: h })
    const e = pickEmojiInterpretation(p)
    if (e) out.push({ metric: `emoji:${p.author}`, body: e })
  }

  // Investment delta summary
  if (facts.perPerson.length >= 2 && facts.investmentDelta >= 20) {
    const sorted = [...facts.perPerson].sort((a, b) => b.powerScore - a.powerScore)
    out.push({
      metric: 'delta',
      body: `Das Investment-Gefälle beträgt ${facts.investmentDelta} Punkte. ${sorted[1].author} investiert in allen Dimensionen — Volumen, Initiierung, Antwortgeschwindigkeit — deutlich mehr als ${sorted[0].author}. Nach dem Principle of Least Interest liegt die relationale Macht bei der investierenden Seite weniger.`,
    })
  }

  return out
}
