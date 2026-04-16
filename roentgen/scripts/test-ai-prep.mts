// Verifies the AI preparation pipeline without calling the network.
// Shows exactly what gets pseudonymized and what would be sent.

import { readFileSync } from 'node:fs'
import { parseWhatsApp } from '../src/parser/whatsapp.ts'
import { prepareAnalysis } from '../src/ai/profile.ts'
import { pseudonymizeMessages } from '../src/ai/pseudonymize.ts'

const raw = readFileSync(process.argv[2] ?? 'sample-big.txt', 'utf-8')
const chat = parseWhatsApp(raw)
const prepared = prepareAnalysis(chat)

const A = '\x1b[38;2;127;224;196m'
const B = '\x1b[38;2;255;154;139m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

console.log()
console.log(`${A}${BOLD}AI PREP · dry run · keine API calls${RESET}`)
console.log(`${DIM}────────────────────────────────────────────────────${RESET}`)
console.log()
console.log(`Chat gesamt:           ${BOLD}${chat.messages.length}${RESET} Nachrichten`)
console.log(`Sample für AI:         ${BOLD}${prepared.messagesSent}${RESET} Nachrichten  ${DIM}(${((prepared.messagesSent / chat.messages.length) * 100).toFixed(1)}%)${RESET}`)
console.log(`Tokens geschätzt:      ${BOLD}~${prepared.approxTokensPerCall.toLocaleString('de-DE')}${RESET} pro Person`)
console.log(`API-Calls:             ${BOLD}${prepared.totalCalls}${RESET}  ${DIM}(ein Call pro Person)${RESET}`)
console.log()
console.log(`${DIM}Sample-Strategie:${RESET}`)
console.log(`  Anfang:              ${prepared.sample.strategy.start}`)
console.log(`  Ende:                ${prepared.sample.strategy.end}`)
console.log(`  Lang:                ${prepared.sample.strategy.longTail}`)
console.log(`  Nachtstunden:        ${prepared.sample.strategy.offHours}`)
console.log(`  Kipppunkte × 7:      ${prepared.sample.strategy.kipppunkte}`)
console.log(`  Random-Mitte:        ${prepared.sample.strategy.random}`)
console.log()
console.log(`${DIM}Pseudonym-Map:${RESET}`)
for (const { real, pseudonym } of prepared.pseudonymMap.participants) {
  console.log(`  ${B}${real}${RESET}  →  ${A}${pseudonym}${RESET}`)
}
console.log()

const pseudoMessages = pseudonymizeMessages(prepared.sample.messages, prepared.pseudonymMap)
console.log(`${DIM}Erste 5 Nachrichten (pseudonymisiert — so geht es raus):${RESET}`)
for (const m of pseudoMessages.slice(0, 5)) {
  const ts = m.ts.toISOString().slice(0, 16).replace('T', ' ')
  const col = m.author === 'Person A' ? A : B
  console.log(`  ${DIM}${ts}${RESET}  ${col}${m.author}${RESET}: ${m.text.slice(0, 80)}`)
}
console.log()
console.log(`${DIM}Letzte 5 Nachrichten:${RESET}`)
for (const m of pseudoMessages.slice(-5)) {
  const ts = m.ts.toISOString().slice(0, 16).replace('T', ' ')
  const col = m.author === 'Person A' ? A : B
  console.log(`  ${DIM}${ts}${RESET}  ${col}${m.author}${RESET}: ${m.text.slice(0, 80)}`)
}
console.log()

// Scan: any of the real names still present in pseudonymized text?
let leaked = 0
for (const m of pseudoMessages) {
  for (const p of chat.participants) {
    const firstName = p.split(/\s+/)[0]
    if (firstName.length < 2) continue
    const re = new RegExp(`\\b${firstName}\\b`, 'i')
    if (re.test(m.text)) leaked++
  }
}
if (leaked > 0) {
  console.log(`${B}⚠ Warnung: ${leaked} potentielle Namens-Leaks im pseudonymisierten Text${RESET}`)
} else {
  console.log(`${A}✓ Keine echten Namen im pseudonymisierten Text gefunden${RESET}`)
}
console.log()
