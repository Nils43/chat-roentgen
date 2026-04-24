import { useLocale } from '../i18n'

interface Props {
  onBack: () => void
}

// §5 TMG / §18 MStV Imprint.
export function Imprint({ onBack }: Props) {
  const locale = useLocale()
  const de = locale === 'de'
  return (
    <div className="max-w-2xl mx-auto px-5 md:px-8 pt-10 pb-24">
      <button
        onClick={onBack}
        className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60 hover:text-ink mb-8"
      >
        {de ? '← zurück' : '← back'}
      </button>

      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 mb-2">
        exhibit b · {de ? 'impressum' : 'imprint'}
      </div>
      <h1 className="font-serif text-[18vw] md:text-[160px] leading-[0.82] tracking-[-0.02em] text-ink overflow-hidden mb-10">
        {de ? 'IMPRESSUM.' : 'IMPRINT.'}
      </h1>

      <article className="space-y-8 serif-body text-base md:text-lg leading-relaxed text-ink">
        <Section title="Angaben gemäß §5 TMG">
          <p className="font-mono text-sm whitespace-pre-line">
            {'Inflection Studio UG (haftungsbeschränkt) i.G.'}
            {'\n'}Kürstraße 54
            {'\n'}73666 Baltmannsweiler
            {'\n'}Deutschland
            {'\n\n'}Vertreten durch den Geschäftsführer: Nils Heck
          </p>
        </Section>

        <Section title="Handelsregister">
          <p className="font-mono text-sm whitespace-pre-line">
            Eintragung beim zuständigen Amtsgericht beantragt.
            {'\n'}HRB-Nummer wird nach erfolgter Eintragung ergänzt.
          </p>
        </Section>

        <Section title="Kontakt">
          <p className="font-mono text-sm whitespace-pre-line">
            Email: contact@spillteato.me
          </p>
        </Section>

        <Section title="Verantwortlich für den Inhalt nach §18 Abs. 2 MStV">
          <p className="font-mono text-sm whitespace-pre-line">
            Nils Heck
            {'\n'}Anschrift wie oben
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
            {de
              ? 'Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.'
              : 'We are not obligated and not willing to participate in dispute resolution proceedings before a consumer arbitration board.'}
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
    <section className="space-y-3">
      <h2 className="font-serif text-2xl md:text-3xl tracking-tight leading-tight pb-2 border-b-2 border-ink/20">
        {title}
      </h2>
      {children}
    </section>
  )
}
