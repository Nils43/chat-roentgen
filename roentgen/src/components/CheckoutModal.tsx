import { useEffect, useMemo } from 'react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'

// Full-screen overlay that renders Stripe's embedded checkout inline.
// The heavy lifting (card form, 3DS, validation) is Stripe's iframe — we just
// provide the clientSecret and an onComplete callback.

interface Props {
  clientSecret: string
  /** Fired by Stripe once the customer completes payment. */
  onComplete: () => void
  /** User manually dismissed the modal before paying. */
  onClose: () => void
}

// Module-level cache so we only call loadStripe once per pk. Exported so the
// app can pre-warm Stripe.js at startup — makes the modal open with no white
// flash since the script is already parsed and connected.
let stripePromise: Promise<Stripe | null> | null = null
export function getStripe(): Promise<Stripe | null> {
  if (stripePromise) return stripePromise
  const pk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
  if (!pk) {
    console.error('[CheckoutModal] VITE_STRIPE_PUBLISHABLE_KEY is not set')
    stripePromise = Promise.resolve(null)
    return stripePromise
  }
  stripePromise = loadStripe(pk)
  return stripePromise
}

export function CheckoutModal({ clientSecret, onComplete, onClose }: Props) {
  const stripe = useMemo(() => getStripe(), [])

  // Lock the body scroll while the modal is open so the underlying paywall
  // doesn't shift when the scrollbar disappears.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Esc closes the modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[80] bg-ink/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 md:p-8"
      style={{ animation: 'fadeIn 140ms ease-out' }}
      onClick={(e) => {
        // Click on the dark backdrop closes. Clicks inside the modal card
        // shouldn't bubble up to here.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
      <div
        className="relative w-full max-w-xl bg-bg border-2 border-ink"
        style={{ boxShadow: '6px 6px 0 #0A0A0A', animation: 'slideUp 200ms ease-out' }}
      >
        <button
          onClick={onClose}
          aria-label="Close checkout"
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center bg-ink text-pop-yellow border-2 border-ink hover:bg-pop-yellow hover:text-ink transition-colors text-lg leading-none"
        >
          ×
        </button>

        {/* Trust strip — one line above the form keeps checkout-page-level assurance. */}
        <div className="px-4 md:px-6 pt-5 pb-3 border-b border-ink/20">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60">
            Secure checkout · Stripe · card · apple pay · link
          </div>
        </div>

        <div className="p-4 md:p-6">
          <EmbeddedCheckoutProvider
            stripe={stripe}
            options={{ clientSecret, onComplete }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    </div>
  )
}
