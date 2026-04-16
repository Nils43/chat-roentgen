// Generiert einen realistischen Situationship-Chat über ~4 Monate.
// Asymmetrisches Investment: Lena investiert stärker, Max reguliert Distanz.
// Output: sample-big.txt im WhatsApp-DE-Format.

import { writeFileSync } from 'node:fs'

const MSGS = []

function push(ts, author, text) {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  const line = `[${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}] ${author}: ${text}`
  MSGS.push(line)
}

// Seed: 2024-01-05 21:00
let t = new Date('2024-01-05T21:00:00').getTime()

const lenaLines = {
  opener: ['Hey :)', 'Wie war dein Tag?', 'Hab grad an dich gedacht', 'Was machst du so?', 'Na?', 'Hey du', 'Ich hoff du hast n schönen Tag', 'Melde mich mal 😊'],
  followup: ['Ist alles ok bei dir?', 'Du bist so still heute', 'Hab ich was gesagt?', 'Ich vermiss dich irgendwie', 'Manchmal verstehe ich dich nicht', 'Ich glaub ich investier hier mehr als du, oder?', 'Sag mal was', 'Ich fühl mich grad etwas alleine'],
  question: ['Was denkst du?', 'Wie siehst du das?', 'Wollen wir uns sehen?', 'Was willst du eigentlich von mir?', 'Bist du noch da?', 'Ist das hier was für dich?'],
  sweet: ['Ich mag das wenn du so bist 💕', 'Du machst mich glücklich', 'Ich hab dich so gern', 'Bei dir fühl ich mich sicher', 'Das mit dir ist besonders'],
  hedge: ['Vielleicht sollten wir reden?', 'Ich weiß nicht ob das gut geht', 'Eigentlich wollt ich dich was fragen', 'Irgendwie fühl ich mich komisch', 'Vielleicht ist das nur meine Interpretation aber', 'Ich glaub ich bin zu viel'],
  long: [
    'Ich hab heute viel über uns nachgedacht. Manchmal weiß ich nicht wo ich stehe. Ich merke dass ich immer die bin die schreibt und ich frag mich ob das ein Problem ist. Ich will dir keinen Druck machen aber ich würde gern wissen was du fühlst.',
    'Hey, ich konnte nicht schlafen weil mir unser Gespräch gestern nicht aus dem Kopf ging. Ich glaub ich hab dir nicht gut vermittelt wie es mir geht. Es ist nicht so dass ich dir nicht vertraue es ist eher dass ich mich manchmal sehr distanziert fühle und dann werde ich unsicher.',
    'Ich hab heut einen blöden Tag. Meine Mutter war wieder anstrengend am Telefon und ich musste kurz danach in ein Meeting und konnte das gar nicht gut verarbeiten. Ich brauch grad glaub ich einfach jemanden der mir sagt dass alles okay ist.',
  ],
}

const maxLines = {
  short: ['hey', 'ja', 'klar', 'ok', 'passt', 'mhm', 'gut', 'jo', 'sorry', 'später', 'bin grad beschäftigt', 'später mehr'],
  delayed: ['sorry hatte viel zu tun', 'war unterwegs', 'hab das verpasst', 'bin grad erst dazu gekommen'],
  medium: ['alles entspannt, wie bei dir?', 'lief ganz ok danke', 'heute war viel los, bin müde', 'nächste woche wird stressig', 'samstag könnten wir uns sehen', 'bis dann'],
  deflect: ['lass das mal nicht zu kompliziert machen', 'ich glaub du überdenkst das', 'warum so schwer', 'läuft doch', 'ist doch alles gut zwischen uns', 'nicht heute bitte'],
  warm: ['du bist süß', 'schön dich zu sehen gestern', 'hab dich auch gern'],
}

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function addMinutes(mins) {
  t += mins * 60 * 1000
}
function addHours(h) {
  t += h * 60 * 60 * 1000
}
function addDays(d) {
  t += d * 24 * 60 * 60 * 1000
}

// Seed randomness deterministic enough
let seed = 42
Math.random = () => {
  seed = (seed * 9301 + 49297) % 233280
  return seed / 233280
}

// Phase 1: Kennenlernen (Woche 1–3) — ausgeglichen, viel Energie
for (let day = 0; day < 18; day++) {
  const msgsToday = 6 + Math.floor(Math.random() * 8)
  const startHour = 19 + Math.floor(Math.random() * 3)
  t = new Date(`2024-01-${String(5 + day).padStart(2, '0')}T${startHour}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`).getTime()
  for (let i = 0; i < msgsToday; i++) {
    const lenaFirst = Math.random() > 0.4
    const author = i === 0 ? (lenaFirst ? 'Lena' : 'Max') : Math.random() > 0.45 ? 'Lena' : 'Max'
    let text
    if (author === 'Lena') {
      const pool = [lenaLines.opener, lenaLines.sweet, lenaLines.question]
      text = rand(pool[Math.floor(Math.random() * pool.length)])
    } else {
      const pool = [maxLines.medium, maxLines.short, maxLines.warm]
      text = rand(pool[Math.floor(Math.random() * pool.length)])
    }
    push(t, author, text)
    addMinutes(2 + Math.floor(Math.random() * 15))
  }
}

// Phase 2: Plateau / leichte Distanz (Woche 4–8) — Asymmetrie wächst
for (let day = 0; day < 28; day++) {
  if (day % 3 === 2) continue // 1 Tag Stille
  const lenaCount = 3 + Math.floor(Math.random() * 5)
  const maxCount = 1 + Math.floor(Math.random() * 2)
  t = new Date(`2024-02-${String(1 + day).padStart(2, '0')}T${19 + Math.floor(Math.random() * 4)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`).getTime()
  // Lena schickt mehrere Nachrichten hintereinander (Double Texting)
  for (let i = 0; i < lenaCount; i++) {
    const pool = i === 0 ? lenaLines.opener : Math.random() > 0.5 ? lenaLines.question : lenaLines.followup
    push(t, 'Lena', rand(pool))
    addMinutes(1 + Math.floor(Math.random() * 8))
    if (Math.random() < 0.2) {
      // Gelegentlicher Hedge oder langer Text
      push(t, 'Lena', rand(lenaLines.hedge))
      addMinutes(1 + Math.floor(Math.random() * 5))
    }
  }
  // Max antwortet spät
  addHours(3 + Math.floor(Math.random() * 18))
  for (let i = 0; i < maxCount; i++) {
    const pool = Math.random() > 0.5 ? maxLines.short : maxLines.delayed
    push(t, 'Max', rand(pool))
    addMinutes(1 + Math.floor(Math.random() * 4))
  }
}

// Phase 3: Langer Text von Lena, kaum Reaktion (Woche 9)
t = new Date('2024-03-02T22:30:00').getTime()
push(t, 'Lena', rand(lenaLines.long))
addMinutes(3)
push(t, 'Lena', 'Sorry das war viel')
addMinutes(2)
push(t, 'Lena', 'Bin halt grad emotional')
addHours(36)
push(t, 'Max', rand(maxLines.deflect))
addMinutes(2)
push(t, 'Max', rand(maxLines.short))

// Phase 4: Distanzphase (Woche 10–14) — deutliche Abkühlung
for (let day = 0; day < 32; day++) {
  if (day % 2 === 1) continue
  t = new Date(`2024-03-${String(5 + day).padStart(2, '0')}T${20 + Math.floor(Math.random() * 3)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`).getTime()
  if (t > new Date('2024-04-15').getTime()) break
  // Lena initiert fast immer
  const lenaBursts = 2 + Math.floor(Math.random() * 3)
  for (let i = 0; i < lenaBursts; i++) {
    const pool = Math.random() > 0.5 ? lenaLines.followup : lenaLines.hedge
    push(t, 'Lena', rand(pool))
    addMinutes(1 + Math.floor(Math.random() * 6))
  }
  // Max: 50% Chance, überhaupt zu antworten, und dann sehr spät/kurz
  if (Math.random() > 0.3) {
    addHours(8 + Math.floor(Math.random() * 30))
    push(t, 'Max', rand(maxLines.short))
  }
}

// Phase 5: Lenas "Was läuft hier"-Konfrontation (Mitte April)
t = new Date('2024-04-18T23:00:00').getTime()
push(t, 'Lena', rand(lenaLines.long))
addMinutes(5)
push(t, 'Lena', 'Ich kann so nicht weitermachen')
addMinutes(2)
push(t, 'Lena', rand(lenaLines.question))
addHours(52)
push(t, 'Max', 'sorry war viel')
addMinutes(3)
push(t, 'Max', rand(maxLines.deflect))

writeFileSync('sample-big.txt', MSGS.join('\n'), 'utf-8')
console.log(`✓ Generated ${MSGS.length} messages → sample-big.txt`)
