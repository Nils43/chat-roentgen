import { useSyncExternalStore } from 'react'

// Minimal i18n. Two locales: 'en' (default) and 'de' (German).
// Browser auto-detection on first visit; Settings toggle overrides and persists.

export type Locale = 'en' | 'de'

const STORAGE_KEY = 'tea.locale.v1'

function detectBrowser(): Locale {
  try {
    const lang = typeof navigator !== 'undefined' ? navigator.language?.toLowerCase() ?? 'en' : 'en'
    if (lang.startsWith('de')) return 'de'
  } catch {
    /* ignore */
  }
  return 'en'
}

function readStored(): Locale | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'en' || v === 'de') return v
  } catch {
    /* ignore */
  }
  return null
}

let current: Locale = readStored() ?? detectBrowser()
const listeners = new Set<() => void>()

export const i18n = {
  get(): Locale {
    return current
  },
  set(l: Locale): void {
    if (l === current) return
    current = l
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      /* ignore */
    }
    for (const fn of listeners) fn()
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}

export function useLocale(): Locale {
  return useSyncExternalStore(i18n.subscribe, i18n.get, i18n.get)
}

// Dictionary — keyed by dotted path, keep English strings in the keys' shape so
// the source stays readable when the key is missing.
const dict = {
  en: {
    // Nav
    'nav.leaks': 'leaks',
    'nav.intel': 'intel',
    'nav.files': 'files',
    'nav.settings': 'settings',
    'nav.privacy': 'privacy',
    'nav.imprint': 'imprint',
    'nav.localOnly': '· local only',
    'nav.backToLeaks': '← back to leaks',

    // Library
    'library.hero': 'LEAKS',
    'library.archive': 'your tea · filed',
    'library.empty': "no tea yet. drop a WhatsApp export — we read, you process.",
    'library.count_one': '{count} chat · all local · tap a card to open',
    'library.count_many': '{count} chats · all local · tap a card to open',
    'library.newLeak': 'NEW TEA',
    'library.uploadFirst': 'UPLOAD FIRST TEA',
    'library.emptyTitle': 'EXHIBIT 0: NO TEA YET',
    'library.emptyCopy': "Drop a WhatsApp export — let's brew the tea.",
    'library.exhibit': 'EXHIBIT',
    'library.log': 'WHATSAPP LOG',
    'library.messages': 'messages',
    'library.shred': 'Shred',
    'library.allFiles': 'ALL FILES ✦',

    // Privacy banner
    'banner.label': 'FIRST TIME HERE · READ THIS',
    'banner.title': 'Your chat stays on your device.',
    'banner.body':
      'Hard Facts run locally. Deep analyses send a pseudonymized slice to an AI in the USA (Anthropic, 30-day retention, no training). No tracking. No cookies.',
    'banner.got': 'GOT IT',
    'banner.read': 'read the policy',

    // Settings
    'settings.kicker': 'exhibit 99 · your data · your call',
    'settings.hero': 'SETTINGS.',
    'settings.stats.label': 'ON THIS DEVICE',
    'settings.stats.chats': 'Chats',
    'settings.stats.messages': 'Messages',
    'settings.stats.analyses': 'Analyses done',
    'settings.lang.label': 'LANGUAGE · SPRACHE',
    'settings.lang.title': 'Language',
    'settings.lang.body': 'UI and AI analyses follow the setting — switch whenever.',
    'settings.lang.en': 'English',
    'settings.lang.de': 'Deutsch',
    'settings.export.label': 'EXPORT · ART. 20 GDPR',
    'settings.export.title': 'Take it all with you.',
    'settings.export.body':
      'One JSON with every chat and every analysis result stored on this device. No server involved — the download runs locally.',
    'settings.export.cta': 'EXPORT ALL → JSON',
    'settings.export.doing': 'PACKING…',
    'settings.export.done': '✓ DOWNLOADED',
    'settings.delete.label': 'DELETE · ART. 17 GDPR',
    'settings.delete.title': 'Nuke it.',
    'settings.delete.body':
      "Wipes every chat, every analysis, and every saved setting from this browser. This doesn't touch Anthropic's 30-day retention — that clears itself. This can't be undone.",
    'settings.delete.done.title': 'Clean slate.',
    'settings.delete.done.body':
      "Every chat, every analysis, every setting — gone from this browser. Anthropic's 30-day retention runs out on its own. You're clean.",
    'settings.delete.cta': 'DELETE ALL DATA',
    'settings.delete.confirm': '✓ YES, DELETE EVERYTHING',
    'settings.delete.cancel': 'cancel',
    'settings.links.privacy': 'Privacy policy',
    'settings.links.imprint': 'Imprint',
    'settings.back': '← back',

    // Paywall
    'paywall.marker': '✦ FINAL SLIDE · THE DEEP TEA',
    'paywall.kicker.two': '→ two analyses · €3 each · €5 bundle',
    'paywall.kicker.one': '→ personal file · €3',
    'paywall.hero.prefix': 'THE DEEP ',
    'paywall.hero.highlight': 'TEA.',
    'paywall.sub.prefix': 'the numbers were the ',
    'paywall.sub.what': 'what',
    'paywall.sub.two': 'two analyses are the ',
    'paywall.sub.one': 'the personal file is the ',
    'paywall.sub.why': 'why',
    'paywall.file.about': 'about',
    'paywall.file01.title': 'PERSONAL ANALYSIS.',
    'paywall.file01.lede':
      'an AI-written psychological read of how {name} writes in this chat — patterns, tells, the moves you keep making. You consent before anything leaves your device.',
    'paywall.file02.title': 'RELATIONSHIP ANALYSIS.',
    'paywall.file02.lede':
      "an AI-written read of what's actually going on between {a} and {b} — who gives more, unwritten rules, who leads when. You consent before anything leaves your device.",
    'paywall.unlock': 'UNLOCK',
    'paywall.open': 'OPEN →',
    'paywall.yours': '✓ YOURS',
    'paywall.bundle.kicker': 'both files · the bundle',
    'paywall.endOfTape': '· that was the shallow tea ·',

    // Share
    'share.label': 'share this read',
    'share.sendTo': 'SEND TO',
    'share.copy': 'COPY',
    'share.copied': '✓ COPIED',

    // Closing
    'closing.kicker': 'exhibit closed · {n} messages read',
    'closing.hero.prefix': "THAT'S THE ",
    'closing.hero.highlight': 'TEA.',
    'closing.body.top': 'the tea is out. one offer. the rest is yours.',
    'closing.body.bottom': 'open the chat anytime — it scrolls now.',

    // Upload
    'upload.privacy': 'upload & hard facts local · AI only with your consent',
    'upload.hero.prefix': 'Drop your ',
    'upload.hero.highlight': 'chat',
    'upload.hero.sub': "See what's really going on.",
    'upload.body':
      'Drag your WhatsApp export in here or hit the button. Everything stays on your device — nobody else sees it.',
    'upload.cta': 'PICK A CHAT',
    'upload.consentHint': '↓ sign the house rules to proceed ↓',
    'upload.blocked': 'BLOCKED:',
    'upload.err.noConsent': 'nice try, honey. tick the house rules first — no consent, no tea.',
    'upload.err.tooBig': "over 50 MB — that's low-key a record-breaking chat.",
    'upload.err.wrongType': "that's not a WhatsApp export. instructions below — no stress.",
    'upload.err.noTxt': 'no .txt file found inside the ZIP — is this a WhatsApp export?',
    'upload.err.readFail': "file isn't cooperating. try again.",
    'upload.err.unzipFail': "couldn't unzip that. is the file corrupted?",
    'upload.rules.label': 'EXHIBIT 99: HOUSE RULES',
    'upload.rules.prefix': 'I am ',
    'upload.rules.bold': 'a participant in this chat',
    'upload.rules.suffix':
      " and I'm using the analysis for myself — not to control, manipulate or stalk anyone. If I spot red flags, I'll seek real help instead of using this tool.",
    'upload.howTo.cta': 'How do I get my WhatsApp chat?',
    'upload.howTo.step1': 'Open WhatsApp, tap the chat.',
    'upload.howTo.step2': 'Tap the name at the top, scroll down to "Export chat".',
    'upload.howTo.step3': 'Pick "Without media" — enough, and faster.',
    'upload.howTo.step4': 'Send the file via AirDrop, mail or cloud — then drop it here.',
    'upload.howTo.note': 'Android wraps this in a ZIP. Tap it once, pull the text file out, done.',

    // Self pick
    'self.kicker': 'before we spill',
    'self.title.prefix': 'Which one is you',
    'self.title.suffix': '?',
    'self.body': "I only profile you. The other person didn't agree to be read.",
    'self.button': 'I am',
    'self.back': '← back',

    // Consent screen
    'consent.pill.test': 'test mode · nothing leaves',
    'consent.pill.live': 'tea is about to send slices to the AI',
    'consent.title.prefix': 'Before the ',
    'consent.title.ai': 'AI',
    'consent.title.kicks': ' reads,',
    'consent.title.sub': 'what goes out.',
    'consent.row.msgs.label': "What's going out",
    'consent.row.msgs.of': 'of',
    'consent.row.msgs.suffix': 'names hidden · emails, links, numbers stripped',
    'consent.row.reader.label': 'Recipient',
    'consent.row.reader.test': 'your device only',
    'consent.row.reader.live': 'AI in the USA',
    'consent.row.reader.testSuffix': 'test mode · nothing is sent',
    'consent.row.reader.liveSuffix':
      '30-day retention, no training · see privacy policy for details',
    'consent.art9.label': 'Explicit consent · Art. 9 GDPR',
    'consent.art9.body':
      'Chats can contain sensitive stuff (health, sex, politics). With "Consent & start" you explicitly consent (Art. 9(2)(a) GDPR) to this data being processed by an AI abroad. Withdraw anytime by not running more analyses.',
    'consent.cta.test': 'Start the analysis',
    'consent.cta.live': 'Consent & start',
    'consent.cancel': 'Back to the numbers',
    'consent.footnote':
      'Starting confirms: the chat is yours or you were part of it.',

    // AI Progress
    'aiprog.title.running': 'reading',
    'aiprog.title.error': 'analysis broke',
    'aiprog.cancel': 'back',
    'aiprog.of': 'of',

    // Parsing
    'parsing.title': 'tea · reading',
    'parsing.status': "scanning {count} messages...",

    // Hard Facts — Opener
    'hf.opener.intel': 'intel · {people} · filed',
    'hf.opener.hero': 'RECEIPTS',
    'hf.opener.mcount': '{n} messages',
    'hf.opener.days': '{n} days',
    'hf.opener.group.voices': '{n} voices',
    'hf.opener.group.talking': '{leader} does {pct}% of the talking',
    'hf.opener.dyad.writes': '{leader} writes {pct}% of them',

    // Hard Facts — Sections & Tiles
    'hf.premise': 'EXHIBIT 0',
    'hf.tile.messages': 'Messages',
    'hf.tile.activeDays': 'Active days',
    'hf.tile.longestSilence': 'Longest silence',
    'hf.tile.peakDay': 'Peak day',
    'hf.tile.start': 'Start',
    'hf.tile.peak': 'Peak',
    'hf.tile.now': 'Now',
    'hf.tile.wk': '/week',
    'hf.tile.msgs': 'messages',
    'hf.tile.days': 'days',
    'hf.splitBar.share': 'Share of messages',
    'hf.splitBar.words': 'Share of words',
    'hf.firstPause': 'After a pause of 4 hours or more · {n} times total',
    'hf.firstOfDay': 'First message of the day',
    'hf.lastOfDay': 'Last message of the day',
    'hf.01.kicker': '01 · Distribution',
    'hf.01.title': 'Who writes more?',
    'hf.02.kicker': '02 · Speed',
    'hf.02.title': 'Who replies how fast?',
    'hf.03.kicker': '03 · Initiative',
    'hf.03.title': 'Who starts the conversation?',
    'hf.04.kicker': '04 · After hours',
    'hf.04.title': 'Who writes when nobody is watching?',
    'hf.04.body': 'Late night messages (11pm–5am) and burst sequences (3+ messages without reply). When masks slip.',
    'hf.05.kicker': '05 · Your hour',
    'hf.05.title': 'When do you think of each other?',
    'hf.05.body': 'The 24h × 7d heatmap. Spikes at 1am say something different than spikes at 1pm.',
    'hf.06.kicker': '06 · Effort',
    'hf.06.title': 'Who gives one-word answers?',
    'hf.06.body': "{pct}% of {name}'s messages are 3 words or less. Short replies aren't always bad — but they add up.",
    'hf.07.kicker': '07 · First & last',
    'hf.07.title': 'Who starts the day — who ends it?',
    'hf.07.body': 'Out of {n} active days. The person who texts first in the morning is thinking of you before anything else.',
    'hf.08.kicker': '08 · Over time',
    'hf.08.title': 'How this chat changed',
    'hf.arc.up': 'This chat is heating up. The last weeks had {pct}% more messages than the beginning. Peak week: {week} with {n} messages.',
    'hf.arc.down': 'This chat is cooling down. The last weeks had {pct}% fewer messages than the beginning. Peak week: {week} with {n} messages.',
    'hf.arc.flat': 'Message volume stayed roughly stable. Peak week: {week} with {n} messages.',
    'hf.shift.label': 'Who holds the contact',
    'hf.shift.firstHalf': 'First half',
    'hf.shift.secondHalf': 'Second half',
    'hf.shift.swap': 'Initiative flipped. First {a} started most conversations. Now it\'s {b}.',
    'hf.shift.same': '{leader} kept the initiative throughout — {direction} by {pct} points.',
    'hf.shift.dropped': 'dropped',
    'hf.shift.rose': 'rose',
    'hf.shift.steady': 'stayed steady',
    'hf.shift.flipped': 'flipped',

    // Parsing animation extended
    'parsing.kicker': 'tea · reading',
    'parsing.messagesCount': '{n} messages',
    'parsing.durationDays': '{n} days',
    'parsing.intercepting': 'intercepting · {pct}%',
    'parsing.heroA': 'READING YOUR',
    'parsing.heroB': 'RECEIPTS',
    'parsing.scanning': 'scanning every message — nobody reads along',
    'parsing.collected': 'evidence collected. assembling the case.',
    'parsing.caseNo': 'case #{id}',
    'parsing.stat.messages': 'Messages',
    'parsing.stat.people': 'People',
    'parsing.stat.span': 'Span',
    'parsing.compiling': 'compiling the evidence...',
    'parsing.done': "case file ready. let's see what we've got.",

    // Re-run
    'rerun.cta': 're-run in {lang}',
    'rerun.lang.en': 'English',
    'rerun.lang.de': 'Deutsch',

    // AI progress
    'aiprog.running.reading': 'reading your portrait',
    'aiprog.running.relationship': 'reading the dynamic',
    'aiprog.done': 'done',
    'aiprog.kicker': 'The AI is reading · give it a sec',
    'aiprog.titleErr': 'Something went sideways.',
    'aiprog.titleA': 'Writing your',
    'aiprog.titleB': 'portrait.',
    'aiprog.titleWait': 'One moment …',
    'aiprog.onIt': 'On it:',
    'aiprog.progress': '{done} of {total} through',
    'aiprog.cancelBtn': 'Cancel',

    // AI disclosure badges
    'ai.disclosure.short': 'written by AI',
    'ai.disclosure.long': 'This read was written by an AI. Full details on who, where and how long are in the privacy policy.',

    // App-level nav & errors
    'app.nav.hardFacts': '← Hard Facts',
    'app.nav.relationship': 'Relationship →',
    'app.nav.personal': '← Portrait',
    'app.nav.backToLibrary': '← back to library',
    'app.error.parse': 'something broke',
    'app.error.noFacts': 'analysis crashed. try a different chat.',
    'app.error.tryAgain': 'try again',
    'app.pay.opening': 'Opening checkout…',
    'app.pay.confirming': 'Confirming payment…',
    'app.pay.unconfirmed': "Payment went through but we couldn't confirm it yet. Try the file again in a moment.",
    'app.pay.errorLabel': 'error',
    'app.net.testDetail': 'test mode · nothing gets sent',
    'app.net.liveDetail': '{n} messages · names hidden',
    'app.analysis.failed': 'analysis failed.',
    'app.relationship.failed': 'vibe read failed.',
    'app.privacyStripe.01.title': 'EXHIBIT 01: ON-DEVICE',
    'app.privacyStripe.01.body': 'the first numbers are crunched by your phone or laptop — nothing gets uploaded.',
    'app.privacyStripe.02.title': 'EXHIBIT 02: NO ACCOUNT',
    'app.privacyStripe.02.body': 'no email, no password. just you and your chat.',
    'app.privacyStripe.03.title': 'EXHIBIT 03: NO READERS',
    'app.privacyStripe.03.body': 'neither we nor anyone else sees your chat. it stays with you.',
    'app.fileLabel': 'file: {name}',

    // Common
    'common.back': '← back',
    'common.skip': 'Skip →',
  },
  de: {
    // Nav
    'nav.leaks': 'leaks',
    'nav.intel': 'intel',
    'nav.files': 'akten',
    'nav.settings': 'einstellungen',
    'nav.privacy': 'datenschutz',
    'nav.imprint': 'impressum',
    'nav.localOnly': '· nur lokal',
    'nav.backToLeaks': '← zurück zu leaks',

    // Library
    'library.hero': 'LEAKS',
    'library.archive': 'dein tea · archiviert',
    'library.empty': 'noch kein tea hier. drop nen WhatsApp-Export — wir lesen, du verarbeitest.',
    'library.count_one': '{count} chat · alles lokal · tap rein',
    'library.count_many': '{count} chats · alles lokal · tap rein',
    'library.newLeak': 'NEUER TEA',
    'library.uploadFirst': 'ERSTEN TEA DROPPEN',
    'library.emptyTitle': 'EXHIBIT 0: NOCH KEIN TEA',
    'library.emptyCopy': 'Drop nen WhatsApp-Export — wir brühen den tea.',
    'library.exhibit': 'EXHIBIT',
    'library.log': 'WHATSAPP LOG',
    'library.messages': 'Messages',
    'library.shred': 'Shredden',
    'library.allFiles': 'ALLE AKTEN ✦',

    // Privacy banner
    'banner.label': 'ZUM ERSTEN MAL HIER · KURZ LESEN',
    'banner.title': 'Dein Chat bleibt auf deinem Gerät.',
    'banner.body':
      'Hard Facts laufen lokal. Deep-Analysen schicken einen pseudonymisierten Slice an eine KI in den USA (Anthropic, 30 Tage Speicherung, kein Training). Kein Tracking. Keine Cookies.',
    'banner.got': 'CHECK',
    'banner.read': 'Datenschutz lesen',

    // Settings
    'settings.kicker': 'exhibit 99 · deine daten · dein call',
    'settings.hero': 'SETTINGS.',
    'settings.stats.label': 'AUF DIESEM GERÄT',
    'settings.stats.chats': 'Chats',
    'settings.stats.messages': 'Messages',
    'settings.stats.analyses': 'Analysen durch',
    'settings.lang.label': 'SPRACHE · LANGUAGE',
    'settings.lang.title': 'Sprache',
    'settings.lang.body': 'UI und AI-Analysen laufen in der Sprache — switch wann du willst.',
    'settings.lang.en': 'English',
    'settings.lang.de': 'Deutsch',
    'settings.export.label': 'EXPORT · ART. 20 DSGVO',
    'settings.export.title': 'Nimm alles mit.',
    'settings.export.body':
      'Eine JSON mit allen Chats und allen Analyse-Ergebnissen auf diesem Gerät. Kein Server — Download läuft lokal.',
    'settings.export.cta': 'ALLES EXPORTIEREN → JSON',
    'settings.export.doing': 'PACKE…',
    'settings.export.done': '✓ DOWNLOADED',
    'settings.delete.label': 'DELETE · ART. 17 DSGVO',
    'settings.delete.title': 'Wipe.',
    'settings.delete.body':
      'Löscht jeden Chat, jede Analyse, jede Einstellung aus diesem Browser. Anthropics 30-Tage-Speicherung läuft parallel von selbst aus. Kein Undo.',
    'settings.delete.done.title': 'Clean slate.',
    'settings.delete.done.body':
      'Jeder Chat, jede Analyse, jedes Setting — weg aus diesem Browser. Die 30-Tage-Speicherung bei Anthropic läuft parallel aus. Du bist clean.',
    'settings.delete.cta': 'ALLES LÖSCHEN',
    'settings.delete.confirm': '✓ JA, ALLES WEG',
    'settings.delete.cancel': 'cancel',
    'settings.links.privacy': 'Datenschutzerklärung',
    'settings.links.imprint': 'Impressum',
    'settings.back': '← zurück',

    // Paywall
    'paywall.marker': '✦ LETZTE SEITE · DER ECHTE TEA',
    'paywall.kicker.two': '→ zwei analysen · €3 einzeln · €5 zusammen',
    'paywall.kicker.one': '→ persönliche akte · €3',
    'paywall.hero.prefix': 'JETZT DER ',
    'paywall.hero.highlight': 'TEA.',
    'paywall.sub.prefix': 'du weißt jetzt, ',
    'paywall.sub.what': 'was passiert ist',
    'paywall.sub.two': 'die zwei analysen erklären, ',
    'paywall.sub.one': 'die persönliche akte erklärt, ',
    'paywall.sub.why': 'warum',
    'paywall.file.about': 'über',
    'paywall.file01.title': 'PERSÖNLICHE ANALYSE.',
    'paywall.file01.lede':
      'eine KI-Lesart davon, wie {name} in diesem Chat schreibt — die Muster, die Tells, die Bewegungen, die du immer wieder machst. Du willigst vorher ein, nichts verlässt vorher dein Gerät.',
    'paywall.file02.title': 'BEZIEHUNGSANALYSE.',
    'paywall.file02.lede':
      'eine KI-Lesart davon, was zwischen {a} und {b} wirklich abgeht — wer mehr gibt, welche Regeln nie ausgesprochen wurden, wer wann die Richtung vorgibt. Du willigst vorher ein, nichts verlässt vorher dein Gerät.',
    'paywall.unlock': 'FREISCHALTEN',
    'paywall.open': 'AUFMACHEN →',
    'paywall.yours': '✓ HAST DU',
    'paywall.bundle.kicker': 'beide akten · zusammen günstiger',
    'paywall.endOfTape': '· das war nur die oberfläche ·',

    // Share
    'share.label': 'diese analyse teilen',
    'share.sendTo': 'SENDEN AN',
    'share.copy': 'LINK',
    'share.copied': '✓ COPIED',

    // Closing
    'closing.kicker': 'akte geschlossen · {n} nachrichten gelesen',
    'closing.hero.prefix': 'DAS WAR DER ',
    'closing.hero.highlight': 'TEA.',
    'closing.body.top': 'der tea ist auf dem tisch. der rest liegt bei dir.',
    'closing.body.bottom': 'der chat liegt jetzt zum durchscrollen bereit — komm wieder, wann du willst.',

    // Upload
    'upload.privacy': 'upload & hard facts lokal · KI nur mit deiner einwilligung',
    'upload.hero.prefix': 'Drop deinen ',
    'upload.hero.highlight': 'Chat',
    'upload.hero.sub': 'Sieh, was wirklich abgeht.',
    'upload.body':
      'Zieh deinen WhatsApp-Export rein oder tap den Button. Alles bleibt auf deinem Gerät — niemand sonst sieht es.',
    'upload.cta': 'CHAT PICKEN',
    'upload.consentHint': '↓ erst die house rules abnicken ↓',
    'upload.blocked': 'BLOCKED:',
    'upload.err.noConsent': 'nice try, honey. Erst die house rules — kein Consent, kein Tea.',
    'upload.err.tooBig': 'über 50 MB — das ist lowkey rekordverdächtig.',
    'upload.err.wrongType': 'das ist kein WhatsApp-Export. Anleitung unten — kein Stress.',
    'upload.err.noTxt': 'keine .txt im ZIP — ist das überhaupt ein WhatsApp-Export?',
    'upload.err.readFail': 'Die Datei spinnt. Try again.',
    'upload.err.unzipFail': 'Konnte das nicht entpacken. Datei kaputt?',
    'upload.rules.label': 'EXHIBIT 99: HOUSE RULES',
    'upload.rules.prefix': 'Ich bin ',
    'upload.rules.bold': 'Teilnehmer:in in diesem Chat',
    'upload.rules.suffix':
      ' und nutze die Analyse für mich selbst — nicht um jemanden zu kontrollieren, zu manipulieren oder zu stalken. Bei red flags suche ich echte Hilfe, nicht dieses Tool.',
    'upload.howTo.cta': 'Wie komme ich an meinen WhatsApp-Chat?',
    'upload.howTo.step1': 'WhatsApp öffnen, Chat tappen.',
    'upload.howTo.step2': 'Oben den Namen tappen, runterscrollen zu "Chat exportieren".',
    'upload.howTo.step3': '"Ohne Medien" wählen — reicht, ist schneller.',
    'upload.howTo.step4': 'Datei per AirDrop, Mail oder Cloud schicken — dann hier rein.',
    'upload.howTo.note': 'Android packt das in ein ZIP. Einmal tappen, Text-Datei rausziehen, done.',

    // Self pick
    'self.kicker': 'bevor wir den tea spillen',
    'self.title.prefix': 'Welche:r davon bist du',
    'self.title.suffix': '?',
    'self.body': 'Ich lese nur dich. Die andere Person hat nicht zugestimmt.',
    'self.button': 'Ich bin',
    'self.back': '← zurück',

    // Consent screen
    'consent.pill.test': 'testmode · nichts geht raus',
    'consent.pill.live': 'tea schickt gleich einen Slice an die KI',
    'consent.title.prefix': 'Bevor die ',
    'consent.title.ai': 'KI',
    'consent.title.kicks': ' liest,',
    'consent.title.sub': 'was rausgeht.',
    'consent.row.msgs.label': 'Was rausgeht',
    'consent.row.msgs.of': 'von',
    'consent.row.msgs.suffix': 'Namen versteckt · Mails, Links, Nummern raus',
    'consent.row.reader.label': 'Empfänger',
    'consent.row.reader.test': 'nur dein Gerät',
    'consent.row.reader.live': 'KI in den USA',
    'consent.row.reader.testSuffix': 'testmode · nichts wird gesendet',
    'consent.row.reader.liveSuffix':
      '30 Tage Speicherung, kein Training · Details in der Datenschutzerklärung',
    'consent.art9.label': 'Ausdrückliche Einwilligung · Art. 9 DSGVO',
    'consent.art9.body':
      'Chats können sensibles Stuff enthalten (Gesundheit, Sex, Politik). Mit "Einwilligen & starten" gibst du ausdrücklich deine Einwilligung (Art. 9(2)(a) DSGVO), dass diese Daten von einer KI im Ausland verarbeitet werden. Widerrufbar jederzeit — einfach keine weiteren Analysen starten.',
    'consent.cta.test': 'Analyse starten',
    'consent.cta.live': 'Einwilligen & starten',
    'consent.cancel': 'Zurück zu den Zahlen',
    'consent.footnote':
      'Starten bestätigt: der Chat gehört dir oder du warst Teil davon.',

    // AI Progress
    'aiprog.title.running': 'lesen',
    'aiprog.title.error': 'analyse abgebrochen',
    'aiprog.cancel': 'zurück',
    'aiprog.of': 'von',

    // Parsing
    'parsing.title': 'tea · liest',
    'parsing.status': 'scanne {count} Messages...',

    // Hard Facts — Opener
    'hf.opener.intel': 'akte · {people} · archiviert',
    'hf.opener.hero': 'INSIGHTS',
    'hf.opener.mcount': '{n} Nachrichten',
    'hf.opener.days': '{n} Tage',
    'hf.opener.group.voices': '{n} Stimmen',
    'hf.opener.group.talking': '{leader} hält {pct}% des Gesprächs',
    'hf.opener.dyad.writes': '{leader} schreibt {pct}% davon',

    // Hard Facts — Sections & Tiles
    'hf.premise': 'EXHIBIT 0',
    'hf.tile.messages': 'nachrichten',
    'hf.tile.activeDays': 'aktive tage',
    'hf.tile.longestSilence': 'längste stille',
    'hf.tile.peakDay': 'spitzentag',
    'hf.tile.start': 'start',
    'hf.tile.peak': 'peak',
    'hf.tile.now': 'jetzt',
    'hf.tile.wk': '/woche',
    'hf.tile.msgs': 'nachrichten',
    'hf.tile.days': 'tage',
    'hf.splitBar.share': 'Anteil Messages',
    'hf.splitBar.words': 'Anteil Wörter',
    'hf.firstPause': 'nach einer pause von mindestens 4 stunden · {n} mal insgesamt',
    'hf.firstOfDay': 'erste nachricht am tag',
    'hf.lastOfDay': 'letzte nachricht am tag',
    'hf.01.kicker': '01 · Split',
    'hf.01.title': 'Wer schreibt mehr?',
    'hf.02.kicker': '02 · Speed',
    'hf.02.title': 'Wer antwortet wie schnell?',
    'hf.03.kicker': '03 · Initiative',
    'hf.03.title': 'Wer startet die Convo?',
    'hf.04.kicker': '04 · Late Night',
    'hf.04.title': 'Wer schreibt, wenn niemand hinsieht?',
    'hf.04.body': 'Nachrichten zwischen 23 und 5 Uhr — und Bursts (3 oder mehr Nachrichten am Stück, keine Antwort dazwischen). Wenn die Maske rutscht.',
    'hf.05.kicker': '05 · Eure Stunde',
    'hf.05.title': 'Wann denkt ihr aneinander?',
    'hf.05.body': 'Die 24h × 7d Heatmap. Spikes um 1 Uhr nachts sagen was anderes als Spikes um 13 Uhr.',
    'hf.06.kicker': '06 · Effort',
    'hf.06.title': 'Wer antwortet einsilbig?',
    'hf.06.body': '{pct}% der Nachrichten von {name} haben 3 Wörter oder weniger. Kurze Antworten sind nicht per se schlecht — aber sie summieren sich.',
    'hf.07.kicker': '07 · First & last',
    'hf.07.title': 'Wer startet den Tag — wer endet ihn?',
    'hf.07.body': 'Von {n} aktiven Tagen. Wer morgens als Erste:r schreibt, denkt an die andere Person, bevor irgendwas anderes passiert.',
    'hf.08.kicker': '08 · Über die Zeit',
    'hf.08.title': 'Wie sich dieser Chat verändert hat',
    'hf.arc.up': 'Der Chat zieht an. Die letzten Wochen hatten {pct}% mehr Nachrichten als der Anfang. Spitzenwoche: {week} mit {n} Nachrichten.',
    'hf.arc.down': 'Der Chat kühlt ab. Die letzten Wochen hatten {pct}% weniger Nachrichten als der Anfang. Spitzenwoche: {week} mit {n} Nachrichten.',
    'hf.arc.flat': 'Das Nachrichten-Aufkommen bleibt ungefähr gleich. Spitzenwoche: {week} mit {n} Nachrichten.',
    'hf.shift.label': 'wer hält den faden',
    'hf.shift.firstHalf': 'erste hälfte',
    'hf.shift.secondHalf': 'zweite hälfte',
    'hf.shift.swap': 'die initiative ist gekippt. früher hat {a} die meisten gespräche angefangen, heute ist es {b}.',
    'hf.shift.same': '{leader} bleibt durchgehend vorne dran — {direction} um {pct} punkte.',
    'hf.shift.dropped': 'abgefallen',
    'hf.shift.rose': 'gestiegen',
    'hf.shift.steady': 'gleich geblieben',
    'hf.shift.flipped': 'gekippt',

    // Parsing animation extended
    'parsing.kicker': 'tea · liest',
    'parsing.messagesCount': '{n} Messages',
    'parsing.durationDays': '{n} Tage',
    'parsing.intercepting': 'intercepting · {pct}%',
    'parsing.heroA': 'ICH LESE DEINE',
    'parsing.heroB': 'INSIGHTS',
    'parsing.scanning': 'scanne jede Message — niemand liest mit',
    'parsing.collected': 'Evidence gesammelt. Akte wird zusammengestellt.',
    'parsing.caseNo': 'Akte #{id}',
    'parsing.stat.messages': 'Messages',
    'parsing.stat.people': 'People',
    'parsing.stat.span': 'Zeitraum',
    'parsing.compiling': 'Evidence wird zusammengetragen...',
    'parsing.done': 'Akte bereit. Schauen wir, was wir haben.',

    // Re-run
    'rerun.cta': 're-run auf {lang}',
    'rerun.lang.en': 'English',
    'rerun.lang.de': 'Deutsch',

    // AI progress
    'aiprog.running.reading': 'liest dein Portrait',
    'aiprog.running.relationship': 'liest die Dynamik',
    'aiprog.done': 'done',
    'aiprog.kicker': 'Die KI liest · kurz chillen',
    'aiprog.titleErr': 'Da ist was schiefgelaufen.',
    'aiprog.titleA': 'Dein Portrait',
    'aiprog.titleB': 'entsteht.',
    'aiprog.titleWait': 'Einen Moment …',
    'aiprog.onIt': 'Dran:',
    'aiprog.progress': '{done} von {total} durch',
    'aiprog.cancelBtn': 'Abbrechen',

    // AI disclosure badges
    'ai.disclosure.short': 'von KI geschrieben',
    'ai.disclosure.long': 'Diese Lesart wurde von einer KI geschrieben. Details zu Anbieter, Standort und Speicherdauer stehen in der Datenschutzerklärung.',

    // App-level nav & errors
    'app.nav.hardFacts': '← Hard Facts',
    'app.nav.relationship': 'Beziehung →',
    'app.nav.personal': '← Portrait',
    'app.nav.backToLibrary': '← zurück zur library',
    'app.error.parse': 'da ist was kaputt',
    'app.error.noFacts': 'analyse abgebrochen. versuch einen anderen chat.',
    'app.error.tryAgain': 'nochmal versuchen',
    'app.pay.opening': 'Checkout wird geöffnet…',
    'app.pay.confirming': 'Zahlung wird bestätigt…',
    'app.pay.unconfirmed': 'Zahlung ist durch, aber wir konnten sie noch nicht bestätigen. Probier die Datei gleich nochmal.',
    'app.pay.errorLabel': 'fehler',
    'app.net.testDetail': 'testmode · nichts geht raus',
    'app.net.liveDetail': '{n} messages · namen hidden',
    'app.analysis.failed': 'Analyse fehlgeschlagen.',
    'app.relationship.failed': 'Vibe-Read fehlgeschlagen.',
    'app.privacyStripe.01.title': 'EXHIBIT 01: ON-DEVICE',
    'app.privacyStripe.01.body': 'die ersten Zahlen rechnet dein Gerät — nichts wird hochgeladen.',
    'app.privacyStripe.02.title': 'EXHIBIT 02: KEIN ACCOUNT',
    'app.privacyStripe.02.body': 'keine Mail, kein Passwort. nur du und dein Chat.',
    'app.privacyStripe.03.title': 'EXHIBIT 03: KEINE MITLESER',
    'app.privacyStripe.03.body': 'weder wir noch sonst wer sieht deinen Chat. er bleibt bei dir.',
    'app.fileLabel': 'datei: {name}',

    // Common
    'common.back': '← zurück',
    'common.skip': 'Skip →',
  },
} as const

export type TKey = keyof typeof dict.en

export function t(key: TKey, locale: Locale = current, vars?: Record<string, string | number>): string {
  const tablePrimary = dict[locale] as Record<string, string>
  const tableFallback = dict.en as Record<string, string>
  let str = tablePrimary[key] ?? tableFallback[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, String(v))
    }
  }
  return str
}
