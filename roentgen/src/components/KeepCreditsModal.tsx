import { useLocale } from '../i18n'

// Post-purchase prompt — shown after an anonymous user buys credits. Nudges
// them to link Google so the credits survive a cleared browser. Can be
// dismissed; credits still work on this device without sign-in.

interface Props {
  onSignIn: () => void
  onDismiss: () => void
}

export function KeepCreditsModal({ onSignIn, onDismiss }: Props) {
  const locale = useLocale()
  const r = (en: string, de: string) => (locale === 'de' ? de : en)

  return (
    <div className="fixed inset-0 z-[80] bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="relative w-full max-w-md bg-bg border-2 border-ink p-6 md:p-8"
        style={{ boxShadow: '6px 6px 0 #0A0A0A' }}
      >
        <div
          className="inline-flex items-center gap-2 px-3 py-1 bg-ink text-pop-yellow mb-5"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '14px',
            letterSpacing: '0.06em',
            transform: 'rotate(-1deg)',
            boxShadow: '3px 3px 0 #0A0A0A',
          }}
        >
          ✦ {r('PAYMENT OK', 'ZAHLUNG OK')}
        </div>

        <h2 className="font-serif text-3xl md:text-4xl leading-tight mb-3 text-ink">
          {r('Save your credits?', 'Credits sichern?')}
        </h2>
        <p className="serif-body text-base text-ink-muted mb-5">
          {r(
            'Right now your credits live on this browser. If you clear cookies or switch device, they are gone. One click with Google keeps them on your account — no email, no password.',
            'Gerade hängen deine Credits an diesem Browser. Cookies löschen oder Gerätewechsel = weg. Ein Klick mit Google — Credits bleiben auf deinem Account. Keine Email, kein Passwort.',
          )}
        </p>

        <button
          onClick={onSignIn}
          className="w-full bg-ink text-pop-yellow border-2 border-ink px-5 py-4 flex items-center justify-between hover:bg-pop-yellow hover:text-ink transition-colors mb-3"
          style={{ boxShadow: '4px 4px 0 #0A0A0A' }}
        >
          <span className="font-mono text-xs uppercase tracking-[0.18em]">
            {r('continue with google', 'mit google weiter')}
          </span>
          <span className="text-2xl leading-none" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            →
          </span>
        </button>
        <button
          onClick={onDismiss}
          className="w-full font-mono text-[10px] uppercase tracking-[0.16em] text-ink/60 hover:text-ink underline underline-offset-4 decoration-dotted py-2"
        >
          {r('not now · keep using on this browser', 'später · hier weitermachen')}
        </button>
      </div>
    </div>
  )
}
