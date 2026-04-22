import { useState } from 'react'
import { useLocale } from '../i18n'
import { normalizePhone, sendSmsOtp, verifySmsOtp } from '../auth/useSession'

// Two-step phone sign-in: enter number → get SMS code → verify → done.
// No email, no password. Supabase + Twilio do the SMS delivery.

interface Props {
  onSuccess: () => void
  onClose?: () => void
}

type Step = 'phone' | 'code'

export function PhoneAuth({ onSuccess, onClose }: Props) {
  const locale = useLocale()
  const r = (en: string, de: string) => (locale === 'de' ? de : en)
  const [step, setStep] = useState<Step>('phone')
  const [phoneRaw, setPhoneRaw] = useState('')
  const [phone, setPhone] = useState('') // normalized E.164
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitPhone = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const normalized = normalizePhone(phoneRaw)
    if (!normalized) {
      setError(r("Doesn't look like a phone number.", 'Das sieht nicht nach einer telefonnummer aus.'))
      return
    }
    setBusy(true)
    try {
      await sendSmsOtp(normalized)
      setPhone(normalized)
      setStep('code')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await verifySmsOtp(phone, code.trim())
      onSuccess()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="relative w-full max-w-md bg-bg border-2 border-ink p-6 md:p-8"
        style={{ boxShadow: '6px 6px 0 #0A0A0A' }}
      >
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-ink text-pop-yellow border-2 border-ink hover:bg-pop-yellow hover:text-ink transition-colors leading-none text-lg"
          >
            ×
          </button>
        )}

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
          ✦ {step === 'phone' ? r('SIGN IN', 'LOGIN') : r('VERIFY', 'BESTÄTIGEN')}
        </div>

        <h2 className="font-serif text-3xl md:text-4xl leading-tight mb-2 text-ink">
          {step === 'phone'
            ? r('Your number.', 'Deine nummer.')
            : r('Enter the code.', 'Code eingeben.')}
        </h2>
        <p className="serif-body text-base text-ink-muted mb-6">
          {step === 'phone'
            ? r(
                'No email, no password. One SMS and you are in.',
                'Keine email, kein passwort. Eine SMS und du bist drin.',
              )
            : r(
                `We sent a 6-digit code to ${phone}.`,
                `Wir haben einen 6-stelligen code an ${phone} geschickt.`,
              )}
        </p>

        {step === 'phone' ? (
          <form onSubmit={submitPhone} className="space-y-4">
            <input
              type="tel"
              autoFocus
              autoComplete="tel"
              value={phoneRaw}
              onChange={(e) => setPhoneRaw(e.target.value)}
              placeholder="+49 170 1234567"
              className="w-full border-2 border-ink bg-white text-ink text-xl p-3 font-mono focus:outline-none focus:bg-pop-yellow/30"
              disabled={busy}
            />
            {error && (
              <div className="font-mono text-xs text-b">{error}</div>
            )}
            <button
              type="submit"
              disabled={busy || !phoneRaw}
              className="w-full bg-ink text-pop-yellow border-2 border-ink px-5 py-4 flex items-center justify-between hover:bg-pop-yellow hover:text-ink transition-colors disabled:opacity-50 disabled:cursor-wait"
              style={{ boxShadow: '4px 4px 0 #0A0A0A' }}
            >
              <span className="font-mono text-xs uppercase tracking-[0.18em]">
                {busy ? r('sending…', 'senden…') : r('send me the code', 'schick mir den code')}
              </span>
              <span
                className="text-2xl leading-none"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                →
              </span>
            </button>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50 text-center">
              {r('one sms · no marketing · ever', 'eine sms · kein marketing · nie')}
            </p>
          </form>
        ) : (
          <form onSubmit={submitCode} className="space-y-4">
            <input
              type="text"
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full border-2 border-ink bg-white text-ink text-4xl p-3 font-mono tracking-[0.5em] text-center focus:outline-none focus:bg-pop-yellow/30"
              disabled={busy}
            />
            {error && (
              <div className="font-mono text-xs text-b">{error}</div>
            )}
            <button
              type="submit"
              disabled={busy || code.length < 4}
              className="w-full bg-ink text-pop-yellow border-2 border-ink px-5 py-4 flex items-center justify-between hover:bg-pop-yellow hover:text-ink transition-colors disabled:opacity-50 disabled:cursor-wait"
              style={{ boxShadow: '4px 4px 0 #0A0A0A' }}
            >
              <span className="font-mono text-xs uppercase tracking-[0.18em]">
                {busy ? r('verifying…', 'prüfen…') : r('verify', 'bestätigen')}
              </span>
              <span className="text-2xl leading-none" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                ✓
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('phone')
                setCode('')
                setError(null)
              }}
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/60 hover:text-ink underline underline-offset-4 decoration-dotted"
            >
              ← {r('wrong number?', 'falsche nummer?')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
