interface Props {
  onBack: () => void
}

// §5 TMG / §18 MStV Imprint. Placeholders before go-live.
export function Imprint({ onBack }: Props) {
  return (
    <div className="max-w-2xl mx-auto px-5 md:px-8 pt-10 pb-24">
      <button
        onClick={onBack}
        className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60 hover:text-ink mb-8"
      >
        ← back
      </button>

      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 mb-2">
        exhibit b · impressum
      </div>
      <h1 className="font-serif text-[18vw] md:text-[160px] leading-[0.82] tracking-[-0.02em] text-ink overflow-hidden mb-10">
        IMPRINT.
      </h1>

      <article className="space-y-8 serif-body text-base md:text-lg leading-relaxed text-ink">
        <Section title="Angaben gemäß §5 TMG">
          <p className="font-mono text-sm whitespace-pre-line">
            [Your Name]
            [Street]
            [Postal Code, City]
            [Country]
          </p>
        </Section>

        <Section title="Kontakt">
          <p className="font-mono text-sm whitespace-pre-line">
            Email: [contact@your-domain]
            {/* Telephone is not required by law if email is given. */}
          </p>
        </Section>

        <Section title="Verantwortlich für den Inhalt nach §18 Abs. 2 MStV">
          <p className="font-mono text-sm whitespace-pre-line">
            [Your Name]
            [Same address as above]
          </p>
        </Section>

        <Section title="EU-Streitschlichtung">
          <p>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS)
            bereit:{' '}
            <a
              href="https://ec.europa.eu/consumers/odr/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              ec.europa.eu/consumers/odr
            </a>
            .
          </p>
          <p>
            We are not obligated and not willing to participate in dispute resolution proceedings
            before a consumer arbitration board.
          </p>
        </Section>

        <Section title="Haftung für Inhalte">
          <p>
            Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten
            nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir jedoch
            nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen
            oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
          </p>
        </Section>

        <Section title="Notice">
          <p className="text-sm text-ink-muted">
            <em>Placeholders above. Replace with your actual contact info before go-live. This imprint must be reachable from every page (we link it in the footer).</em>
          </p>
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
    <section className="space-y-3">
      <h2 className="font-serif text-2xl md:text-3xl tracking-tight leading-tight pb-2 border-b-2 border-ink/20">
        {title}
      </h2>
      {children}
    </section>
  )
}
