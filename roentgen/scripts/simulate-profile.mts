// Zeigt wie das Profil-UI aussieht, indem es eine Mock-Antwort vom Modell
// durch die restoreNames-Pipeline schickt. Keine API calls.

import type { PersonProfile } from '../src/ai/types.ts'
import { buildPseudonymMap, restoreNamesDeep } from '../src/ai/pseudonymize.ts'

const A = '\x1b[38;2;127;224;196m'
const B = '\x1b[38;2;255;154;139m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const ITAL = '\x1b[3m'
const MUTED = '\x1b[38;2;139;149;161m'
const RESET = '\x1b[0m'

const map = buildPseudonymMap(['Lena', 'Max'])

// Fake what Claude might return for Lena
const lenaPseudo: PersonProfile = {
  person: 'Person A',
  kommunikationsstil: {
    achsen: {
      direktIndirekt: 4,
      emotionalSachlich: -7,
      ausfuehrlichKnapp: -6,
      initiierendReagierend: -8,
    },
    beschreibung:
      'Person A schreibt emotional, häufig ausführlich und fast immer als erste. Hedges mildern die Aussagen ab, Fragen öffnen Raum für Person B. Unter der Oberfläche pulsiert ein Bedürfnis nach Bestätigung.',
  },
  horney: {
    orientierung: 'zu_menschen',
    interpretation:
      'Person A bewegt sich klar auf Person B zu. Nähe-Suche dominiert — Fragen, Rückversicherungen, Emojis, lange Textnachrichten sind die Vehikel. Wenn Distanz entsteht, verstärkt Person A die Bewegung statt sich zurückzuziehen.',
    evidenz: [
      '„Ich vermiss dich manchmal"',
      '„Ist alles ok bei dir?"',
      'Wiederholte Fragen nach Zustimmung',
    ],
  },
  berne: {
    dominanter_zustand: 'kind_ich',
    nuance: 'angepasst',
    interpretation:
      'Person A operiert überwiegend aus dem angepassten Kind-Ich — spürbar in den Hedges, den vorsichtigen Formulierungen, dem Warten auf Reaktion. Gelegentlich bricht das freie Kind durch (Emojis, spontane Wärme).',
    evidenz: ['„Vielleicht sollten wir reden?"', '„Ich glaub ich bin zu viel"'],
  },
  bowlby: {
    tendenz: 'aengstlich_ambivalent',
    sicherheit: 'mittel',
    interpretation:
      'Das Muster zeigt klassische Merkmale ängstlich-ambivalenter Bindung: Suchverhalten bei wahrgenommener Distanz, Protest bei ausbleibender Reaktion, sofortige Rückkehr zu Zuneigungsausdrücken. Die Sicherheit der Einordnung liegt im mittleren Bereich — die Signale sind stark, aber ein Chat ist keine klinische Bindungsdiagnostik.',
    evidenz: ['Protest nach Schweigephasen', 'Schnelle Deeskalation nach Konflikten'],
  },
  adler: {
    kompensation: 'Überinvestition als Schutz vor Kontrollverlust',
    interpretation:
      'Das Überangebot an Kommunikation lässt sich als Adlersches Kompensationsmuster lesen: Wer viel gibt, fühlt sich weniger abhängig von dem, was kommt. Paradox — die Investition erzeugt die Asymmetrie die sie vermeiden wollte.',
    evidenz: ['Mehrfach-Nachrichten nach Stille', 'Sweet-Notes als Puffer'],
  },
  goffman: {
    front_stage: 'Warm, neugierig, offen — will gesehen werden als jemand der Beziehung ernst nimmt.',
    back_stage_durchbrueche: 'Spätabends und nach Verletzungen kippt der Ton: „Ich bin zu viel", „Ich weiß nicht ob das gut geht". Die Performance fällt.',
    interpretation:
      'Die öffentliche Person A ist die warme, gebende Partnerin. Die Back-Stage-Momente offenbaren Selbstzweifel und die Angst, zu viel zu sein.',
    evidenz: ['22:30-Nachricht: „Sorry das war viel"', '„Bin halt grad emotional"'],
  },
  sprachliche_fingerabdruecke: {
    lieblings_formulierungen: ['vielleicht', 'eigentlich', 'irgendwie', 'ich glaub', 'manchmal'],
    wiederkehrende_satzanfaenge: ['Ich …', 'Hab grad …', 'Manchmal …', 'Ich hoff …'],
    zeichensetzung:
      'Wenig Punkte, viele offene Enden. Fragezeichen häufig am Anfang von Nachrichten. Emojis als emotionale Anker, besonders 💕 und 😊.',
  },
  kern_insight:
    'Person A gibt alles, was Person A fürchtet nie zurückzubekommen — und merkt nicht, dass genau dieses Geben die Balance kippt.',
}

// Fake Max
const maxPseudo: PersonProfile = {
  person: 'Person B',
  kommunikationsstil: {
    achsen: {
      direktIndirekt: 7,
      emotionalSachlich: 6,
      ausfuehrlichKnapp: 8,
      initiierendReagierend: 7,
    },
    beschreibung:
      'Person B antwortet knapp, oft mit einem Wort. Wenig Emojis, wenig Ausschmückung. Kommunikation ist funktional, nicht emotional beladen — eine Strategie, Distanz zu halten, ohne sie auszusprechen.',
  },
  horney: {
    orientierung: 'von_menschen',
    interpretation:
      'Person B bewegt sich weg. Nicht konfrontativ, nicht aggressiv — schlicht distanzierend. Die Reduktion ist das Signal.',
    evidenz: ['„jo"', '„später"', '„bin grad beschäftigt"'],
  },
  berne: {
    dominanter_zustand: 'erwachsenen_ich',
    nuance: 'sachlich_rational',
    interpretation:
      'Person B hält das Erwachsenen-Ich hoch, um emotionale Eskalation zu vermeiden. Das wirkt reif, ist aber auch ein Schutzmechanismus — wer keine Emotion sendet, muss auch keine empfangen.',
    evidenz: ['„läuft doch"', '„ich glaub du überdenkst das"'],
  },
  bowlby: {
    tendenz: 'vermeidend',
    sicherheit: 'mittel',
    interpretation:
      'Vermeidende Tendenz: Distanzregulation durch Verzögerung und Minimalantworten, Deflection bei emotionalen Themen. Person B hält Nähe niedrig dosiert — genug, um nicht wegzugehen, zu wenig, um anzukommen.',
    evidenz: ['Antworten mit 24h+ Verzögerung', 'Themenwechsel bei Gefühlsthemen'],
  },
  adler: {
    kompensation: 'Unterengagement als Überlegenheitsposition',
    interpretation:
      'Durch das Minimum an Investition hält Person B eine strukturelle Überlegenheit. Wer weniger braucht, braucht weniger. Das ist keine Bosheit — es ist ein früh gelerntes Muster, sich nicht angreifbar zu machen.',
    evidenz: ['„nicht heute bitte"', 'Keine Gegenfragen'],
  },
  goffman: {
    front_stage: 'Entspannt, easy, unaufgeregt — jemand der „nicht kompliziert" ist.',
    back_stage_durchbrueche: 'Seltene Wärme-Momente („du bist süß") die nie ausgebaut werden. Der Rückfall in die Front Stage ist sofort.',
    interpretation:
      'Die Performance: „Ich bin easy." Die Kehrseite: Die Nähe-Momente bleiben einzeln, werden nicht verkettet zu einer Beziehungs-Erzählung.',
    evidenz: ['„du bist süß" (einmalig, ohne Fortsetzung)'],
  },
  sprachliche_fingerabdruecke: {
    lieblings_formulierungen: ['ok', 'klar', 'passt', 'läuft', 'jo'],
    wiederkehrende_satzanfaenge: ['sorry …', 'war …', 'hab …'],
    zeichensetzung: 'Kein Punkt, keine Fragezeichen. Kleinschreibung. Keine Emojis.',
  },
  kern_insight:
    'Person B hat gelernt, dass Unverbindlichkeit der sicherste Ort ist — und zahlt dafür den Preis, nie wirklich anzukommen.',
}

// Restore real names
const lena = restoreNamesDeep(lenaPseudo, map)
const max = restoreNamesDeep(maxPseudo, map)
lena.person = 'Lena'
max.person = 'Max'

function renderProfile(p: PersonProfile, color: string) {
  const hr = () => DIM + '─'.repeat(68) + RESET
  console.log(hr())
  console.log()
  console.log(`  ${color}${BOLD}${p.person}${RESET}`)
  console.log()
  console.log(`  ${color}${ITAL}"${p.kern_insight}"${RESET}`)
  console.log()
  console.log(`  ${MUTED}KOMMUNIKATIONSSTIL${RESET}`)
  console.log(`  ${p.kommunikationsstil.beschreibung}`)
  console.log()
  for (const [label, r, v] of [
    ['Direkt', 'Indirekt', p.kommunikationsstil.achsen.direktIndirekt],
    ['Emotional', 'Sachlich', p.kommunikationsstil.achsen.emotionalSachlich],
    ['Ausführlich', 'Knapp', p.kommunikationsstil.achsen.ausfuehrlichKnapp],
    ['Initiierend', 'Reagierend', p.kommunikationsstil.achsen.initiierendReagierend],
  ] as [string, string, number][]) {
    const pct = ((v + 10) / 20) * 40
    const pos = Math.round(pct)
    const line = ' '.repeat(40).split('').map((_, i) => (i === pos ? color + '●' + RESET : i === 20 ? DIM + '│' + RESET : DIM + '·' + RESET)).join('')
    console.log(`  ${(label as string).padEnd(12)} ${line}  ${r}`)
  }
  console.log()

  const renderSection = (title: string, tag: string, text: string, evidenz: string[]) => {
    console.log(`  ${MUTED}${title.toUpperCase()}${RESET}  ${color}${tag}${RESET}`)
    console.log(`  ${text}`)
    if (evidenz.length) {
      console.log(`  ${DIM}Evidenz:${RESET}`)
      for (const e of evidenz) console.log(`    ${DIM}│ ${RESET}${MUTED}${e}${RESET}`)
    }
    console.log()
  }
  renderSection(
    'Karen Horney · Interpersonelle Orientierung',
    p.horney.orientierung.replace(/_/g, ' '),
    p.horney.interpretation,
    p.horney.evidenz,
  )
  renderSection(
    'Eric Berne · Ich-Zustände',
    `${p.berne.dominanter_zustand.replace(/_/g, ' ')}${p.berne.nuance ? ` · ${p.berne.nuance.replace(/_/g, ' ')}` : ''}`,
    p.berne.interpretation,
    p.berne.evidenz,
  )
  renderSection(
    `John Bowlby · Bindungsstil  (Sicherheit: ${p.bowlby.sicherheit})`,
    p.bowlby.tendenz.replace(/_/g, '-'),
    p.bowlby.interpretation,
    p.bowlby.evidenz,
  )
  renderSection('Alfred Adler · Kompensation', p.adler.kompensation, p.adler.interpretation, p.adler.evidenz)
  console.log(`  ${MUTED}ERVING GOFFMAN · FRONT STAGE / BACK STAGE${RESET}`)
  console.log(`  ${color}Front${RESET} ${p.goffman.front_stage}`)
  console.log(`  ${color}Back${RESET}  ${p.goffman.back_stage_durchbrueche}`)
  console.log(`  ${p.goffman.interpretation}`)
  console.log()
  console.log(`  ${MUTED}SPRACHLICHE FINGERABDRÜCKE${RESET}`)
  console.log(`  Lieblings-Formulierungen: ${p.sprachliche_fingerabdruecke.lieblings_formulierungen.map((x) => color + x + RESET).join(', ')}`)
  console.log(`  Satzanfänge: ${p.sprachliche_fingerabdruecke.wiederkehrende_satzanfaenge.map((x) => color + x + RESET).join(', ')}`)
  console.log(`  ${DIM}${p.sprachliche_fingerabdruecke.zeichensetzung}${RESET}`)
  console.log()
}

console.log()
console.log(`${B}MODUL 02 · PERSÖNLICHE PROFILE · AI${RESET}  ${DIM}(mocked response, no API call)${RESET}`)
console.log(`${BOLD}Wer ${ITAL}hier${RESET}${BOLD} spricht.${RESET}`)
console.log()

renderProfile(lena, A)
renderProfile(max, B)

console.log(DIM + '─'.repeat(68) + RESET)
console.log()
console.log(`  ${ITAL}${MUTED}"Diese Analyse basiert auf Kommunikationsmustern und ist keine klinische Diagnostik.${RESET}`)
console.log(`  ${ITAL}${MUTED}Sie ersetzt keine therapeutische Beratung."${RESET}`)
console.log()
