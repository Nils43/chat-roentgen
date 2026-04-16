// Terminal-Simulation: Parsed einen Chat und rendert die Analyse als CLI-Output,
// so wie die App es im Browser zeigen würde. Macht die UI-Logik sichtbar ohne Browser.

import { readFileSync } from 'node:fs'
import { parseWhatsApp } from '../src/parser/whatsapp.ts'
import { analyzeHardFacts, formatDuration } from '../src/analysis/hardFacts.ts'
import { interpretHardFacts } from '../src/analysis/interpretation.ts'

const FILE = process.argv[2] ?? 'sample-big.txt'
const raw = readFileSync(FILE, 'utf-8')

// ANSI helpers
const A = '\x1b[38;2;127;224;196m' // mint
const B = '\x1b[38;2;255;154;139m' // coral
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const ITAL = '\x1b[3m'
const RESET = '\x1b[0m'
const MUTED = '\x1b[38;2;139;149;161m'
const GREEN_BG = '\x1b[48;2;31;74;63m'

const hr = (char = '─') => DIM + char.repeat(64) + RESET

function kicker(s: string) {
  return `${A}${s.toUpperCase()}${RESET}`
}
function title(s: string) {
  return `${BOLD}${s}${RESET}`
}
function serif(s: string) {
  return `${ITAL}${s}${RESET}`
}

console.log()
console.log(`${A}●${RESET} ${MUTED}Lokal · Parser läuft im Browser · kein Upload${RESET}`)
console.log()

const chat = parseWhatsApp(raw)
if (chat.warnings.length) {
  for (const w of chat.warnings) console.log(`${B}⚠ ${w}${RESET}`)
}

console.log(hr())
console.log(`${kicker('Scan läuft')}`)
console.log()
console.log(`  Nachrichten erkannt  ${BOLD}${chat.messages.length.toLocaleString('de-DE')}${RESET}`)
console.log(`  Teilnehmer           ${BOLD}${chat.participants.length}${RESET}  ${DIM}(${chat.participants.join(', ')})${RESET}`)
const span = chat.messages
const days = Math.ceil((+span[span.length - 1].ts - +span[0].ts) / 86400000)
console.log(`  Zeitraum             ${BOLD}${days} Tage${RESET}`)
console.log(`  Locale               ${BOLD}${chat.locale}${RESET}`)
console.log(`  ${A}Analyse läuft${RESET}`)
console.log()

const facts = analyzeHardFacts(chat)
const interp = interpretHardFacts(facts)

// Find per-person color
const colorFor = (i: number) => [A, B, '\x1b[38;2;137;180;244m', '\x1b[38;2;251;189;92m'][i % 4]

console.log(hr('═'))
console.log()
console.log(`${kicker('Modul 01 · Hard Facts · lokal')}`)
console.log()
console.log(`${BOLD}Was die Zahlen ${ITAL}sagen.${RESET}`)
console.log()
console.log(MUTED + `${facts.totalMessages.toLocaleString('de-DE')} Nachrichten über ${facts.durationDays} Tage.` + RESET)
console.log()

// Topline tiles
const tiles = [
  ['Nachrichten', facts.totalMessages.toLocaleString('de-DE')],
  ['Wörter', facts.totalWords.toLocaleString('de-DE')],
  ['Aktive Tage', `${facts.activeDays} / ${facts.durationDays}`],
  ['Emojis', facts.totalEmojis.toLocaleString('de-DE')],
]
console.log(tiles.map(([l, v]) => `${MUTED}${l.padEnd(13)}${RESET}${BOLD}${String(v).padStart(7)}${RESET}`).join('   '))
console.log()

// 01 Verteilung
console.log(hr())
console.log(`${kicker('01 · Verteilung')}`)
console.log(`${BOLD}Wer schreibt mehr?${RESET}`)
console.log()
// SplitBar ascii: 60 chars wide
const WIDTH = 56
const bar = facts.perPerson
  .map((p, i) => {
    const w = Math.round((p.sharePct / 100) * WIDTH)
    const col = colorFor(i)
    return `${col}${'█'.repeat(w)}${RESET}`
  })
  .join('')
console.log('  ' + bar)
console.log()
facts.perPerson.forEach((p, i) => {
  console.log(`  ${colorFor(i)}${BOLD}${p.sharePct.toFixed(0).padStart(3)}%${RESET}  ${MUTED}${p.author}${RESET}  ${DIM}· ${p.messages} msgs · ${p.words.toLocaleString('de-DE')} Wörter · Ø ${p.avgWords.toFixed(1)} Wörter/msg${RESET}`)
})
console.log()
const shareI = interp.find((x) => x.metric === 'share')
if (shareI) console.log(`  ${serif(shareI.body)}`)
console.log()

// 02 Geschwindigkeit
console.log(hr())
console.log(`${kicker('02 · Geschwindigkeit')}`)
console.log(`${BOLD}Wer reagiert wie schnell?${RESET}`)
console.log()
facts.perPerson.forEach((p, i) => {
  console.log(`  ${colorFor(i)}${BOLD}${formatDuration(p.medianReplyMs).padEnd(6)}${RESET}  ${MUTED}Median · ${p.author}${RESET}`)
})
console.log()
facts.perPerson.forEach((p, i) => {
  const total = p.replyBuckets.under5m + p.replyBuckets.under1h + p.replyBuckets.under1d + p.replyBuckets.over1d || 1
  const row = [
    ['< 5m', p.replyBuckets.under5m],
    ['< 1h', p.replyBuckets.under1h],
    ['< 1d', p.replyBuckets.under1d],
    ['> 1d', p.replyBuckets.over1d],
  ]
    .map(([l, v]) => {
      const pct = ((v as number) / total) * 100
      return `${l} ${colorFor(i)}${pct.toFixed(0).padStart(2)}%${RESET}`
    })
    .join('   ')
  console.log(`  ${MUTED}${p.author.padEnd(8)}${RESET} ${row}`)
})
console.log()
const replyI = interp.find((x) => x.metric.startsWith('reply:'))
if (replyI) console.log(`  ${serif(replyI.body)}`)
console.log()

// 03 Initiative
console.log(hr())
console.log(`${kicker('03 · Initiative')}`)
console.log(`${BOLD}Wer denkt an den anderen?${RESET}`)
console.log()
const totalInit = facts.perPerson.reduce((s, p) => s + p.initiations, 0)
facts.perPerson.forEach((p, i) => {
  const pct = p.initiationShare * 100
  const w = Math.round((pct / 100) * WIDTH)
  console.log(`  ${colorFor(i)}${'█'.repeat(w)}${RESET}${DIM}${'·'.repeat(WIDTH - w)}${RESET}  ${colorFor(i)}${BOLD}${pct.toFixed(0)}%${RESET} ${MUTED}${p.author} · ${p.initiations}/${totalInit}${RESET}`)
})
console.log()
facts.perPerson.forEach((p, i) => {
  console.log(`  ${MUTED}Fragen-Ratio · ${p.author}:${RESET} ${colorFor(i)}${BOLD}${(p.questionRatio * 100).toFixed(0)}%${RESET}`)
})
console.log()
const initI = interp.find((x) => x.metric.startsWith('init:'))
if (initI) console.log(`  ${serif(initI.body)}`)
console.log()

// 04 Sprachliche Signale
console.log(hr())
console.log(`${kicker('04 · Sprachliche Signale')}`)
console.log(`${BOLD}Hedges, Emojis, Länge${RESET}`)
console.log()
facts.perPerson.forEach((p, i) => {
  const c = colorFor(i)
  console.log(`  ${c}${BOLD}${p.author}${RESET}`)
  console.log(`    ${MUTED}Ø Wörter/Nachricht ${RESET}${BOLD}${p.avgWords.toFixed(1)}${RESET}`)
  console.log(`    ${MUTED}Hedge-Rate          ${RESET}${BOLD}${(p.hedgeRatio * 100).toFixed(0)}%${RESET}  ${DIM}(${p.hedgeCount} Wörter)${RESET}`)
  console.log(`    ${MUTED}Emojis/Nachricht    ${RESET}${BOLD}${p.emojiPerMsg.toFixed(2)}${RESET}`)
  if (p.topEmojis.length) {
    console.log(`    ${MUTED}Top-Emojis          ${RESET}${p.topEmojis.map((e) => `${e.emoji}${DIM}×${e.count}${RESET}`).join(' ')}`)
  }
})
console.log()
const hedgeI = interp.find((x) => x.metric.startsWith('hedge:'))
if (hedgeI) console.log(`  ${serif(hedgeI.body)}`)
console.log()

// 05 Heatmap
console.log(hr())
console.log(`${kicker('05 · Rhythmus · Wochentag × Stunde')}`)
console.log()
const max = Math.max(1, ...facts.heatmap.flat())
const blocks = ['·', '░', '▒', '▓', '█']
const days_labels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
console.log(`     ${DIM}0     6     12    18    23${RESET}`)
facts.heatmap.forEach((row, i) => {
  const line = row.map((v) => {
    const idx = Math.round((v / max) * (blocks.length - 1))
    const intensity = v / max
    if (v === 0) return DIM + blocks[0] + RESET
    const col = intensity > 0.66 ? A : intensity > 0.33 ? '\x1b[38;2;95;180;155m' : '\x1b[38;2;60;130;110m'
    return col + blocks[idx] + RESET
  }).join('')
  console.log(`  ${MUTED}${days_labels[i]}${RESET}  ${line}`)
})
console.log()
console.log(`  ${MUTED}Peak: ${facts.peakDay.date} mit ${facts.peakDay.count} Nachrichten${RESET}`)
console.log()

// 06 Engagement curve (sparkline per person)
console.log(hr())
console.log(`${kicker('06 · Verlauf · wöchentliches Engagement')}`)
console.log()
const spark = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
const globalMax = Math.max(...facts.weekly.map((w) => w.count))
facts.perPerson.forEach((p, i) => {
  const line = facts.weekly
    .map((w) => {
      const v = w.perPerson[p.author] ?? 0
      const idx = Math.round((v / globalMax) * (spark.length - 1))
      return colorFor(i) + spark[idx] + RESET
    })
    .join('')
  console.log(`  ${colorFor(i)}${p.author.padEnd(6)}${RESET} ${line}`)
})
const total = facts.weekly
  .map((w) => {
    const idx = Math.round((w.count / globalMax) * (spark.length - 1))
    return spark[idx]
  })
  .join('')
console.log(`  ${MUTED}gesamt${RESET} ${total}`)
console.log(`  ${DIM}${facts.weekly[0].weekStart.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })}${' '.repeat(facts.weekly.length - 12)}${facts.weekly[facts.weekly.length - 1].weekStart.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })}${RESET}`)
console.log()

// 07 Power / Investment Delta
console.log(hr())
console.log(`${kicker('07 · Investment-Delta · Principle of Least Interest')}`)
console.log()
const ranked = [...facts.perPerson].sort((a, b) => b.powerScore - a.powerScore)
ranked.forEach((p) => {
  const idx = facts.perPerson.indexOf(p)
  const c = colorFor(idx)
  const bar = '█'.repeat(Math.round(p.powerScore / 2)) // 50 max width
  console.log(`  ${c}${BOLD}${String(p.powerScore).padStart(3)}${RESET}  ${c}${bar}${RESET}  ${MUTED}${p.author}${RESET}`)
})
console.log()
console.log(`  ${BOLD}Delta: ${facts.investmentDelta}${RESET}`)
console.log()
const deltaI = interp.find((x) => x.metric === 'delta')
if (deltaI) console.log(`  ${serif(deltaI.body)}`)
console.log()

// Paywall teaser
console.log(hr('═'))
console.log()
console.log(`${B}Modul 02–06 · AI-Analyse${RESET}`)
console.log(`${BOLD}Die Zahlen sind die Haut. ${ITAL}Das Skelett kommt jetzt.${RESET}`)
console.log()
console.log(`  ${DIM}░░░░░${RESET} ${DIM}${facts.perPerson[0].author} operiert überwiegend aus dem Erwachsenen-Ich…${RESET}`)
console.log(`  ${DIM}░░░░░${RESET} ${DIM}Bindungsstil-Tendenz: ängstlich-ambivalent. Das Muster zeigt…${RESET}`)
console.log(`  ${DIM}░░░░░${RESET} ${DIM}Kompensationsmuster nach Adler: ${facts.perPerson[1].author} reagiert auf…${RESET}`)
console.log()
console.log(`  ${GREEN_BG}${BOLD}  AI-Analyse freischalten · €4,99  ${RESET}  ${DIM}(bald)${RESET}`)
console.log()
