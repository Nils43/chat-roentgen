interface Props {
  onBack: () => void
}

// DSGVO-konforme Datenschutzerklärung. Englischer UI-Ton, inhaltlich
// vollständig nach Art. 13 DSGVO. Placeholders für Controller müssen vor
// Go-Live ersetzt werden (siehe privacy-audit.md).
export function PrivacyPolicy({ onBack }: Props) {
  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 pt-10 pb-24">
      <button
        onClick={onBack}
        className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60 hover:text-ink mb-8"
      >
        ← back
      </button>

      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 mb-2">
        exhibit a · data protection
      </div>
      <h1 className="font-serif text-[18vw] md:text-[160px] leading-[0.82] tracking-[-0.02em] text-ink overflow-hidden mb-10">
        PRIVACY.
      </h1>

      <article className="space-y-10 serif-body text-base md:text-lg leading-relaxed text-ink">
        <Section title="The short version">
          <p>
            Your chat stays in your browser. The initial analysis runs on your device — no server sees it.
            For the two deep reads (<em>Personal</em>, <em>Relationship</em>) a small, pseudonymized slice
            goes to Anthropic's AI (USA). Anthropic stores it up to 30 days for safety, then deletes it,
            and never trains on it. We don't save chats on our servers. No tracking cookies. No analytics.
          </p>
        </Section>

        <Section title="1 · Who is responsible">
          <p>
            <strong>Controller</strong> under Art. 4(7) GDPR:
          </p>
          <p className="font-mono text-sm whitespace-pre-line">
            [Your Name / Company]
            [Street]
            [Postal Code, City]
            [Country]

            Email: [contact@your-domain]
          </p>
          <p className="text-sm text-ink-muted">
            <em>Placeholder — replace before going live. See the imprint for full contact info.</em>
          </p>
        </Section>

        <Section title="2 · What we process, and why">
          <h3 className="font-serif text-2xl leading-tight">Zone 1 — on your device only</h3>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>The raw chat export (WhatsApp .txt/.zip). Parsed in the browser.</li>
            <li>Hard Facts — message counts, response times, activity heatmap, etc. Computed locally.</li>
            <li>Storage: IndexedDB (chat content) + localStorage (chat index and user settings). Both scoped to your browser, cleared by site-data deletion.</li>
          </ul>
          <p>No server-side processing in Zone 1. No data leaves your device.</p>

          <h3 className="font-serif text-2xl leading-tight mt-6">Zone 2 — our AI proxy (transient)</h3>
          <p>
            When you explicitly start a deep analysis (Personal or Relationship), a
            pseudonymized Evidence Packet plus ≤12 curated chat moments is sent through a
            thin proxy (<code className="font-mono text-sm">/api/analyze</code>) and forwarded to
            Anthropic. The proxy does not persist request bodies. Nothing is written to disk.
            Nothing is logged. Size cap per request: 500 KB.
          </p>

          <h3 className="font-serif text-2xl leading-tight mt-6">Zone 3 — Anthropic (USA)</h3>
          <p>
            Anthropic PBC, 548 Market Street PMB 90375, San Francisco CA 94104, USA — receives
            the packet and returns a structured analysis. Per Anthropic's commercial
            <a href="https://www.anthropic.com/legal/commercial-terms" className="underline" target="_blank" rel="noopener noreferrer"> terms</a>
            {' '}and{' '}
            <a href="https://www.anthropic.com/legal/privacy" className="underline" target="_blank" rel="noopener noreferrer">privacy policy</a>:
          </p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>No training on the submitted data.</li>
            <li>Retained up to 30 days for Trust &amp; Safety, then deleted.</li>
            <li>Zero-Data-Retention is available on enterprise tier; once our volume qualifies we will move there.</li>
          </ul>
        </Section>

        <Section title="3 · Legal basis">
          <ul className="list-disc pl-6 space-y-1.5">
            <li><strong>Zone 1</strong>: Household exemption — Art. 2(2)(c) GDPR. No GDPR obligation when you analyze your own private chat for personal purposes.</li>
            <li><strong>Zone 2 + 3</strong>: Your explicit consent — Art. 6(1)(a) GDPR — each time you start a deep analysis. Because chats can contain special-category data (health, sex life, political views), we also request your explicit consent under Art. 9(2)(a) for that verarbeitung.</li>
            <li><strong>Other participants in the chat</strong>: you act as controller under the household exemption; our processing is on your instruction (Art. 28). We pseudonymize to minimize risk.</li>
          </ul>
        </Section>

        <Section title="4 · What we strip before sending">
          <p>Before the packet leaves your device:</p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>Participant names → "Person A", "Person B", …</li>
            <li>Email addresses → <code className="font-mono text-sm">[email]</code></li>
            <li>URLs → <code className="font-mono text-sm">[link]</code></li>
            <li>Phone numbers → <code className="font-mono text-sm">[phone]</code></li>
            <li>Timestamps: hour-level precision, not to the second.</li>
            <li>Raw chat bulk: only a pre-computed stats summary and up to 12 short message excerpts go out.</li>
          </ul>
        </Section>

        <Section title="5 · International transfers">
          <p>
            The transfer to Anthropic (USA) is governed by a Data Processing Addendum (DPA) with
            Anthropic and, where necessary, the EU Standard Contractual Clauses (2021/914) and a
            Transfer Impact Assessment (TIA) per Schrems II. If Anthropic is certified under the
            EU-US Data Privacy Framework (DPF), transfers also rely on the Commission's adequacy
            decision of 10 July 2023.
          </p>
        </Section>

        <Section title="6 · Retention">
          <ul className="list-disc pl-6 space-y-1.5">
            <li>On-device storage: until you delete it (per-chat "shred" button in Library, or "Delete all data" in Settings).</li>
            <li>Proxy: not stored. Lifetime = the HTTPS request.</li>
            <li>Anthropic: up to 30 days.</li>
          </ul>
        </Section>

        <Section title="7 · Your rights">
          <ul className="list-disc pl-6 space-y-1.5">
            <li><strong>Access</strong> (Art. 15): we don't hold your chat data. Your device has it all; Anthropic has the last up-to-30-days of requests.</li>
            <li><strong>Erasure</strong> (Art. 17): Settings → "Delete all data" wipes browser storage. Anthropic's retention runs out after 30 days.</li>
            <li><strong>Portability</strong> (Art. 20): Settings → "Export data" dumps all your chats and results as JSON.</li>
            <li><strong>Objection</strong> (Art. 21): don't start the AI analysis. Hard Facts work without it.</li>
            <li><strong>Withdraw consent</strong> (Art. 7(3)): for future analyses, just don't run them. Already-sent requests can't be retroactively withdrawn from Anthropic, but they're auto-deleted after 30 days.</li>
            <li><strong>Complaint</strong> (Art. 77): to any EU supervisory authority. In Germany typically BayLDA (Bavaria), LDI NRW, or the authority of your Bundesland.</li>
          </ul>
        </Section>

        <Section title="8 · No tracking, no third-party integrations beyond the above">
          <ul className="list-disc pl-6 space-y-1.5">
            <li>No Google Analytics. No Plausible. No Fathom. No Sentry.</li>
            <li>No cookies set. IndexedDB + localStorage are strictly necessary for the core function (Art. 5(3) ePrivacy / §25 TDDDG exception for "unbedingt erforderlich").</li>
            <li>Fonts are loaded via Bunny Fonts (bunny.net, EU-hosted, GDPR-compliant).</li>
          </ul>
        </Section>

        <Section title="9 · Security">
          <ul className="list-disc pl-6 space-y-1.5">
            <li>HTTPS end-to-end.</li>
            <li>API key never exposed to the browser — held server-side on the proxy.</li>
            <li>No request-body logging. No chat content in error reports.</li>
            <li>Client-side XSS: chat text is rendered as text only, never as HTML.</li>
          </ul>
        </Section>

        <Section title="10 · Changes to this policy">
          <p>
            We update this document when the data flow changes. The date below is the last
            material revision.
          </p>
          <p className="font-mono text-sm text-ink-muted">Last updated: 2026-04-21</p>
        </Section>
      </article>

      <div className="mt-16 pt-8 border-t border-ink/20">
        <button
          onClick={onBack}
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink hover:text-ink/60"
        >
          ← back
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
