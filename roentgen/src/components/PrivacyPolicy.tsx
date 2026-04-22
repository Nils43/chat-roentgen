import { useLocale } from '../i18n'

interface Props {
  onBack: () => void
}

// DSGVO-konforme Datenschutzerklärung. Vollständig zweisprachig (DE/EN).
// Placeholders für Controller müssen vor Go-Live ersetzt werden (siehe
// privacy-audit.md).
export function PrivacyPolicy({ onBack }: Props) {
  const locale = useLocale()
  const de = locale === 'de'
  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 pt-10 pb-24">
      <button
        onClick={onBack}
        className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60 hover:text-ink mb-8"
      >
        {de ? '← zurück' : '← back'}
      </button>

      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 mb-2">
        exhibit a · {de ? 'datenschutz' : 'data protection'}
      </div>
      <h1 className="font-serif text-[18vw] md:text-[160px] leading-[0.82] tracking-[-0.02em] text-ink overflow-hidden mb-10">
        {de ? 'DATENSCHUTZ.' : 'PRIVACY.'}
      </h1>

      <article className="space-y-10 serif-body text-base md:text-lg leading-relaxed text-ink">
        <Section title={de ? 'Die Kurzfassung' : 'The short version'}>
          <p>
            {de ? (
              <>
                Dein Chat bleibt in deinem Browser. Die erste Analyse läuft auf deinem Gerät — kein Server sieht sie.
                Für die beiden Deep-Analysen (<em>Personal</em>, <em>Relationship</em>) geht ein kleiner,
                pseudonymisierter Ausschnitt an die KI von Anthropic (USA). Anthropic speichert ihn bis zu
                30 Tage aus Sicherheitsgründen, löscht ihn dann, und trainiert nie damit. Wir speichern keine
                Chats auf unseren Servern. Keine Tracking-Cookies. Keine Analytics.
              </>
            ) : (
              <>
                Your chat stays in your browser. The initial analysis runs on your device — no server sees it.
                For the two deep reads (<em>Personal</em>, <em>Relationship</em>) a small, pseudonymized slice
                goes to Anthropic's AI (USA). Anthropic stores it up to 30 days for safety, then deletes it,
                and never trains on it. We don't save chats on our servers. No tracking cookies. No analytics.
              </>
            )}
          </p>
        </Section>

        <Section title={de ? '1 · Verantwortlicher' : '1 · Who is responsible'}>
          <p>
            <strong>{de ? 'Verantwortlicher' : 'Controller'}</strong> {de ? 'nach' : 'under'} Art. 4(7) {de ? 'DSGVO' : 'GDPR'}:
          </p>
          <p className="font-mono text-sm whitespace-pre-line">
            {de ? '[Dein Name / Firma]' : '[Your Name / Company]'}
            {'\n'}[Street]
            {'\n'}[Postal Code, City]
            {'\n'}[Country]
            {'\n\n'}Email: [contact@your-domain]
          </p>
          <p className="text-sm text-ink-muted">
            <em>
              {de
                ? 'Platzhalter — vor dem Go-Live ersetzen. Volle Kontaktdaten im Impressum.'
                : 'Placeholder — replace before going live. See the imprint for full contact info.'}
            </em>
          </p>
        </Section>

        <Section title={de ? '2 · Was wir verarbeiten und warum' : '2 · What we process, and why'}>
          <h3 className="font-serif text-2xl leading-tight">
            {de ? 'Zone 1 — nur auf deinem Gerät' : 'Zone 1 — on your device only'}
          </h3>
          <ul className="list-disc pl-6 space-y-1.5">
            {de ? (
              <>
                <li>Der rohe Chat-Export (WhatsApp .txt/.zip). Wird im Browser geparst.</li>
                <li>Hard Facts — Nachrichtenzahlen, Antwortzeiten, Activity-Heatmap etc. Lokal berechnet.</li>
                <li>Speicherung: IndexedDB (Chat-Inhalt) + localStorage (Chat-Index und User-Einstellungen). Beides ist an deinen Browser gebunden und wird durch Löschen der Website-Daten entfernt.</li>
              </>
            ) : (
              <>
                <li>The raw chat export (WhatsApp .txt/.zip). Parsed in the browser.</li>
                <li>Hard Facts — message counts, response times, activity heatmap, etc. Computed locally.</li>
                <li>Storage: IndexedDB (chat content) + localStorage (chat index and user settings). Both scoped to your browser, cleared by site-data deletion.</li>
              </>
            )}
          </ul>
          <p>
            {de
              ? 'Keine serverseitige Verarbeitung in Zone 1. Keine Daten verlassen dein Gerät.'
              : 'No server-side processing in Zone 1. No data leaves your device.'}
          </p>

          <h3 className="font-serif text-2xl leading-tight mt-6">
            {de ? 'Zone 2 — unser KI-Proxy (flüchtig)' : 'Zone 2 — our AI proxy (transient)'}
          </h3>
          <p>
            {de ? (
              <>
                Wenn du ausdrücklich eine Deep-Analyse startest (Personal oder Relationship), wird ein
                pseudonymisiertes Evidence-Paket plus ≤12 ausgewählte Chat-Momente durch einen schmalen
                Proxy (<code className="font-mono text-sm">/api/analyze</code>) geleitet und an Anthropic
                weitergereicht. Der Proxy speichert keine Request-Bodies. Nichts wird auf Disk geschrieben.
                Nichts wird geloggt. Größenlimit pro Request: 500 KB.
              </>
            ) : (
              <>
                When you explicitly start a deep analysis (Personal or Relationship), a
                pseudonymized Evidence Packet plus ≤12 curated chat moments is sent through a
                thin proxy (<code className="font-mono text-sm">/api/analyze</code>) and forwarded to
                Anthropic. The proxy does not persist request bodies. Nothing is written to disk.
                Nothing is logged. Size cap per request: 500 KB.
              </>
            )}
          </p>

          <h3 className="font-serif text-2xl leading-tight mt-6">
            {de ? 'Zone 3 — Anthropic (USA)' : 'Zone 3 — Anthropic (USA)'}
          </h3>
          <p>
            {de ? (
              <>
                Anthropic PBC, 548 Market Street PMB 90375, San Francisco CA 94104, USA — empfängt das
                Paket und liefert eine strukturierte Analyse zurück. Nach Anthropics
                <a href="https://www.anthropic.com/legal/commercial-terms" className="underline" target="_blank" rel="noopener noreferrer"> Commercial Terms</a>
                {' '}und{' '}
                <a href="https://www.anthropic.com/legal/privacy" className="underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a>:
              </>
            ) : (
              <>
                Anthropic PBC, 548 Market Street PMB 90375, San Francisco CA 94104, USA — receives
                the packet and returns a structured analysis. Per Anthropic's commercial
                <a href="https://www.anthropic.com/legal/commercial-terms" className="underline" target="_blank" rel="noopener noreferrer"> terms</a>
                {' '}and{' '}
                <a href="https://www.anthropic.com/legal/privacy" className="underline" target="_blank" rel="noopener noreferrer">privacy policy</a>:
              </>
            )}
          </p>
          <ul className="list-disc pl-6 space-y-1.5">
            {de ? (
              <>
                <li>Kein Training mit den übermittelten Daten.</li>
                <li>Aufbewahrung bis zu 30 Tage für Trust &amp; Safety, danach gelöscht.</li>
                <li>Zero-Data-Retention ist im Enterprise-Tier verfügbar; sobald unser Volumen qualifiziert, wechseln wir dorthin.</li>
              </>
            ) : (
              <>
                <li>No training on the submitted data.</li>
                <li>Retained up to 30 days for Trust &amp; Safety, then deleted.</li>
                <li>Zero-Data-Retention is available on enterprise tier; once our volume qualifies we will move there.</li>
              </>
            )}
          </ul>
        </Section>

        <Section title={de ? '3 · Rechtsgrundlage' : '3 · Legal basis'}>
          <ul className="list-disc pl-6 space-y-1.5">
            {de ? (
              <>
                <li><strong>Zone 1</strong>: Haushaltsausnahme — Art. 2(2)(c) DSGVO. Keine DSGVO-Pflicht, wenn du deinen eigenen privaten Chat zu persönlichen Zwecken analysierst.</li>
                <li><strong>Zone 2 + 3</strong>: Deine ausdrückliche Einwilligung — Art. 6(1)(a) DSGVO — jedes Mal, wenn du eine Deep-Analyse startest. Weil Chats besondere Kategorien personenbezogener Daten enthalten können (Gesundheit, Sexualleben, politische Einstellungen), holen wir zusätzlich deine ausdrückliche Einwilligung nach Art. 9(2)(a) DSGVO für diese Verarbeitung ein.</li>
                <li><strong>Andere Chat-Teilnehmende</strong>: du bist Verantwortlicher unter der Haushaltsausnahme; unsere Verarbeitung erfolgt auf deine Weisung (Art. 28). Wir pseudonymisieren, um das Risiko zu minimieren.</li>
              </>
            ) : (
              <>
                <li><strong>Zone 1</strong>: Household exemption — Art. 2(2)(c) GDPR. No GDPR obligation when you analyze your own private chat for personal purposes.</li>
                <li><strong>Zone 2 + 3</strong>: Your explicit consent — Art. 6(1)(a) GDPR — each time you start a deep analysis. Because chats can contain special-category data (health, sex life, political views), we also request your explicit consent under Art. 9(2)(a) for that processing.</li>
                <li><strong>Other participants in the chat</strong>: you act as controller under the household exemption; our processing is on your instruction (Art. 28). We pseudonymize to minimize risk.</li>
              </>
            )}
          </ul>
        </Section>

        <Section title={de ? '4 · Was vor dem Versand entfernt wird' : '4 · What we strip before sending'}>
          <p>{de ? 'Bevor das Paket dein Gerät verlässt:' : 'Before the packet leaves your device:'}</p>
          <ul className="list-disc pl-6 space-y-1.5">
            {de ? (
              <>
                <li>Teilnehmer-Namen → "Person A", "Person B", …</li>
                <li>E-Mail-Adressen → <code className="font-mono text-sm">[email]</code></li>
                <li>URLs → <code className="font-mono text-sm">[link]</code></li>
                <li>Telefonnummern → <code className="font-mono text-sm">[phone]</code></li>
                <li>Zeitstempel: Stunden-Auflösung, nicht sekundengenau.</li>
                <li>Roher Chat-Inhalt in Bulk: es gehen nur eine vorberechnete Statistik-Zusammenfassung und bis zu 12 kurze Nachrichten-Ausschnitte raus.</li>
              </>
            ) : (
              <>
                <li>Participant names → "Person A", "Person B", …</li>
                <li>Email addresses → <code className="font-mono text-sm">[email]</code></li>
                <li>URLs → <code className="font-mono text-sm">[link]</code></li>
                <li>Phone numbers → <code className="font-mono text-sm">[phone]</code></li>
                <li>Timestamps: hour-level precision, not to the second.</li>
                <li>Raw chat bulk: only a pre-computed stats summary and up to 12 short message excerpts go out.</li>
              </>
            )}
          </ul>
        </Section>

        <Section title={de ? '5 · Internationale Datentransfers' : '5 · International transfers'}>
          <p>
            {de
              ? 'Die Übermittlung an Anthropic (USA) erfolgt auf Basis eines Auftragsverarbeitungsvertrags (AVV) mit Anthropic und, wo erforderlich, der EU-Standardvertragsklauseln (2021/914) sowie einer Transfer Impact Assessment (TIA) nach Schrems II. Soweit Anthropic unter dem EU-US Data Privacy Framework (DPF) zertifiziert ist, stützt sich die Übermittlung auch auf den Angemessenheitsbeschluss der EU-Kommission vom 10. Juli 2023.'
              : "The transfer to Anthropic (USA) is governed by a Data Processing Addendum (DPA) with Anthropic and, where necessary, the EU Standard Contractual Clauses (2021/914) and a Transfer Impact Assessment (TIA) per Schrems II. If Anthropic is certified under the EU-US Data Privacy Framework (DPF), transfers also rely on the Commission's adequacy decision of 10 July 2023."}
          </p>
        </Section>

        <Section title={de ? '6 · Speicherdauer' : '6 · Retention'}>
          <ul className="list-disc pl-6 space-y-1.5">
            {de ? (
              <>
                <li>Lokale Speicherung auf deinem Gerät: bis du sie löschst (pro-Chat "Shredden" in der Library oder "Alle Daten löschen" in den Einstellungen).</li>
                <li>Proxy: keine Speicherung. Lebensdauer = die HTTPS-Anfrage.</li>
                <li>Anthropic: bis zu 30 Tage.</li>
              </>
            ) : (
              <>
                <li>On-device storage: until you delete it (per-chat "shred" button in Library, or "Delete all data" in Settings).</li>
                <li>Proxy: not stored. Lifetime = the HTTPS request.</li>
                <li>Anthropic: up to 30 days.</li>
              </>
            )}
          </ul>
        </Section>

        <Section title={de ? '7 · Deine Rechte' : '7 · Your rights'}>
          <ul className="list-disc pl-6 space-y-1.5">
            {de ? (
              <>
                <li><strong>Auskunft</strong> (Art. 15): wir halten deine Chat-Daten nicht. Dein Gerät hat alles; Anthropic hat die letzten bis zu 30 Tage an Anfragen.</li>
                <li><strong>Löschung</strong> (Art. 17): Einstellungen → "Alle Daten löschen" entfernt den Browser-Speicher. Anthropics Aufbewahrung läuft nach 30 Tagen von selbst aus.</li>
                <li><strong>Datenübertragbarkeit</strong> (Art. 20): Einstellungen → "Alles exportieren" gibt alle deine Chats und Ergebnisse als JSON raus.</li>
                <li><strong>Widerspruch</strong> (Art. 21): starte die KI-Analyse nicht. Hard Facts funktionieren auch ohne.</li>
                <li><strong>Einwilligung widerrufen</strong> (Art. 7(3)): für zukünftige Analysen einfach keine weiteren starten. Bereits gesendete Anfragen können nicht rückwirkend bei Anthropic zurückgezogen werden, werden aber nach 30 Tagen automatisch gelöscht.</li>
                <li><strong>Beschwerde</strong> (Art. 77): bei jeder EU-Aufsichtsbehörde. In Deutschland typischerweise BayLDA (Bayern), LDI NRW oder die zuständige Behörde deines Bundeslandes.</li>
              </>
            ) : (
              <>
                <li><strong>Access</strong> (Art. 15): we don't hold your chat data. Your device has it all; Anthropic has the last up-to-30-days of requests.</li>
                <li><strong>Erasure</strong> (Art. 17): Settings → "Delete all data" wipes browser storage. Anthropic's retention runs out after 30 days.</li>
                <li><strong>Portability</strong> (Art. 20): Settings → "Export data" dumps all your chats and results as JSON.</li>
                <li><strong>Objection</strong> (Art. 21): don't start the AI analysis. Hard Facts work without it.</li>
                <li><strong>Withdraw consent</strong> (Art. 7(3)): for future analyses, just don't run them. Already-sent requests can't be retroactively withdrawn from Anthropic, but they're auto-deleted after 30 days.</li>
                <li><strong>Complaint</strong> (Art. 77): to any EU supervisory authority. In Germany typically BayLDA (Bavaria), LDI NRW, or the authority of your Bundesland.</li>
              </>
            )}
          </ul>
        </Section>

        <Section title={de ? '8 · Kein Tracking, keine Drittanbieter darüber hinaus' : '8 · No tracking, no third-party integrations beyond the above'}>
          <ul className="list-disc pl-6 space-y-1.5">
            {de ? (
              <>
                <li>Kein Google Analytics. Kein Plausible. Kein Fathom. Kein Sentry.</li>
                <li>Keine Cookies gesetzt. IndexedDB + localStorage sind für die Kernfunktion unbedingt erforderlich (Art. 5(3) ePrivacy / §25 TDDDG-Ausnahme für "unbedingt erforderlich").</li>
                <li>Fonts werden über Bunny Fonts geladen (bunny.net, in der EU gehostet, DSGVO-konform).</li>
              </>
            ) : (
              <>
                <li>No Google Analytics. No Plausible. No Fathom. No Sentry.</li>
                <li>No cookies set. IndexedDB + localStorage are strictly necessary for the core function (Art. 5(3) ePrivacy / §25 TDDDG exception for "unbedingt erforderlich").</li>
                <li>Fonts are loaded via Bunny Fonts (bunny.net, EU-hosted, GDPR-compliant).</li>
              </>
            )}
          </ul>
        </Section>

        <Section title={de ? '9 · Sicherheit' : '9 · Security'}>
          <ul className="list-disc pl-6 space-y-1.5">
            {de ? (
              <>
                <li>HTTPS Ende-zu-Ende.</li>
                <li>API-Schlüssel ist dem Browser nie exponiert — wird serverseitig auf dem Proxy gehalten.</li>
                <li>Kein Logging von Request-Bodies. Kein Chat-Inhalt in Fehler-Reports.</li>
                <li>Client-seitiges XSS: Chat-Text wird ausschließlich als Text gerendert, nie als HTML.</li>
              </>
            ) : (
              <>
                <li>HTTPS end-to-end.</li>
                <li>API key never exposed to the browser — held server-side on the proxy.</li>
                <li>No request-body logging. No chat content in error reports.</li>
                <li>Client-side XSS: chat text is rendered as text only, never as HTML.</li>
              </>
            )}
          </ul>
        </Section>

        <Section title={de ? '10 · Änderungen an dieser Erklärung' : '10 · Changes to this policy'}>
          <p>
            {de
              ? 'Wir aktualisieren dieses Dokument, wenn sich der Datenfluss ändert. Das Datum unten ist die letzte wesentliche Änderung.'
              : 'We update this document when the data flow changes. The date below is the last material revision.'}
          </p>
          <p className="font-mono text-sm text-ink-muted">
            {de ? 'Zuletzt aktualisiert: 2026-04-22' : 'Last updated: 2026-04-22'}
          </p>
        </Section>
      </article>

      <div className="mt-16 pt-8 border-t border-ink/20">
        <button
          onClick={onBack}
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink hover:text-ink/60"
        >
          {de ? '← zurück' : '← back'}
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-serif text-3xl md:text-4xl tracking-tight leading-[1.05] pb-2 border-b-2 border-ink/20">
        {title}
      </h2>
      {children}
    </section>
  )
}
