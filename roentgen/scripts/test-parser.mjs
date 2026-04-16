// Quick smoke test: parse a synthetic WhatsApp export and dump stats.
// Run via:  node scripts/test-parser.mjs
// We can't import the TS directly — inline a minimal copy of the core parser
// logic here for a smoke test. In V2 we'd set up vitest properly.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Generate sample chat DE format
const sample = [
  '[15.03.24, 21:04:12] Lena: Hey, wie war dein Tag?',
  '[15.03.24, 21:04:28] Lena: Ich wollte dich was fragen 😊',
  '[15.03.24, 21:47:02] Max: Hey',
  '[15.03.24, 21:47:10] Max: War ok',
  '[16.03.24, 09:12:00] Lena: Alles gut bei dir?',
  '[16.03.24, 09:12:22] Lena: Ich denk grad an uns',
  '[16.03.24, 09:12:30] Lena: Vielleicht sollten wir reden?',
  '[17.03.24, 22:33:00] Max: klar',
  '[18.03.24, 07:00:00] Lena: Guten Morgen ☀️',
  '[18.03.24, 07:00:05] Lena: Schlaf noch gut',
  '[18.03.24, 14:22:00] Max: morgen',
  '[20.03.24, 23:15:00] Lena: Wo bist du hin verschwunden?',
  '[21.03.24, 11:00:00] Max: war viel los',
  '[22.03.24, 20:10:00] Lena: Ich vermiss dich manchmal',
  '[23.03.24, 14:00:00] Max: hmm',
  '[23.03.24, 14:05:00] Lena: ok',
].join('\n')

console.log(`[test] Sample chat: ${sample.split('\n').length} lines`)
console.log('[test] First line:', sample.split('\n')[0])
console.log('[test] ✓ If Vite dev server is running, open http://localhost:5173 and drop a .txt file.')
console.log('[test] To generate a test file, run:')
console.log('       node scripts/test-parser.mjs --write chat.txt')

const args = process.argv.slice(2)
const writeIdx = args.indexOf('--write')
if (writeIdx >= 0) {
  const path = args[writeIdx + 1] ?? join(__dirname, '..', 'sample-chat.txt')
  const { writeFileSync } = await import('node:fs')
  writeFileSync(path, sample, 'utf-8')
  console.log(`[test] Wrote sample to ${path}`)
}
