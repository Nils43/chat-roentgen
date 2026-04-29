import type { Locale } from './i18n'

// Central translation of technical error codes → text the user can actually
// act on. Keep it short, avoid jargon, always end with the next step.
// Fallback is the original message so we never swallow unknown errors.

type Message = { en: string; de: string }

const MAP: Record<string, Message> = {
  // Credits / paywall
  insufficient_credits: {
    en: 'Out of credits. Grab a pack to keep going.',
    de: 'Credits sind alle. Schnapp dir ein Pack, dann geht’s weiter.',
  },
  not_signed_in: {
    en: 'Your session expired. Reload the page and try again.',
    de: 'Deine Session ist abgelaufen. Seite neu laden und nochmal.',
  },
  spend_failed: {
    en: 'We couldn’t record the spend. Try once more — if it keeps failing, message support.',
    de: 'Der Abzug konnte nicht gebucht werden. Nochmal versuchen — falls es weiter hakt, meld dich.',
  },
  grant_failed: {
    en: 'Payment went through but crediting hit a snag. Your credits will appear in a minute, otherwise reach out.',
    de: 'Zahlung ist durch, aber das Gutschreiben hakt kurz. Die Credits sollten in einer Minute da sein — sonst meld dich.',
  },

  // Stripe / checkout
  stripe_error: {
    en: 'Stripe rejected the request. Try another card or payment method.',
    de: 'Stripe hat die Zahlung abgelehnt. Probier eine andere Karte oder Zahlungsmethode.',
  },
  no_client_secret: {
    en: 'Couldn’t open checkout. Reload and try again.',
    de: 'Der Checkout ließ sich nicht öffnen. Seite neu laden und nochmal.',
  },
  invalid_pack: {
    en: 'That pack isn’t available right now.',
    de: 'Dieses Pack ist gerade nicht verfügbar.',
  },
  invalid_session: {
    en: 'This checkout session looks off. Start a fresh purchase.',
    de: 'Mit dieser Checkout-Session stimmt was nicht. Starte den Kauf bitte neu.',
  },
  missing_metadata: {
    en: 'Purchase went through but we’re missing some info. Credits may be delayed — check your balance in a minute.',
    de: 'Kauf ist durch, aber uns fehlen ein paar Infos. Die Credits können kurz dauern — schau in einer Minute auf den Stand.',
  },

  // Upload / request size
  payload_too_large: {
    en: 'That chat is too big. Export a shorter slice — like the last few months.',
    de: 'Der Chat ist zu groß. Exportier einen kürzeren Ausschnitt — etwa die letzten paar Monate.',
  },
  invalid_json: {
    en: 'Something in the request got scrambled. Reload the page and try again.',
    de: 'Im Request ist was durcheinander geraten. Seite neu laden und nochmal.',
  },

  // Upstream / server
  upstream_unreachable: {
    en: 'The AI isn’t responding right now. Try again in a minute.',
    de: 'Die KI reagiert gerade nicht. Probier’s in einer Minute nochmal.',
  },
  analysis_incomplete: {
    en: 'The AI kept returning incomplete results. Your credit was refunded — try again in a moment.',
    de: 'Die KI hat mehrfach nur Bruchstücke geliefert. Dein Credit ist zurück auf dem Konto — gleich nochmal probieren.',
  },
  upstream_error: {
    en: 'The AI returned an error. Try again in a moment.',
    de: 'Die KI hat einen Fehler gemeldet. Gleich nochmal probieren.',
  },
  invalid_response: {
    en: 'The AI sent back something we couldn’t read. Try again.',
    de: 'Die Antwort der KI war nicht lesbar. Nochmal versuchen.',
  },
  server_exception: {
    en: 'Something crashed on our side. Try again — we’ll see it in the logs either way.',
    de: 'Bei uns ist was abgestürzt. Probier’s nochmal — wir sehen’s sowieso im Log.',
  },
  missing_env: {
    en: 'The server is misconfigured. Please let us know.',
    de: 'Der Server ist falsch konfiguriert. Sag uns bitte Bescheid.',
  },
  missing_api_key: {
    en: 'The server is misconfigured. Please let us know.',
    de: 'Der Server ist falsch konfiguriert. Sag uns bitte Bescheid.',
  },
  missing_stripe_config: {
    en: 'Payments aren’t set up right. Please let us know.',
    de: 'Die Zahlungs-Anbindung ist nicht korrekt eingerichtet. Sag uns bitte Bescheid.',
  },
  missing_stripe_key: {
    en: 'Payments aren’t set up right. Please let us know.',
    de: 'Die Zahlungs-Anbindung ist nicht korrekt eingerichtet. Sag uns bitte Bescheid.',
  },
  method_not_allowed: {
    en: 'Something went sideways. Reload the page.',
    de: 'Da ist was schiefgelaufen. Bitte Seite neu laden.',
  },
}

export function friendlyError(code: string | undefined, locale: Locale, fallback?: string): string {
  if (!code) return fallback ?? (locale === 'de' ? 'Unbekannter Fehler.' : 'Unknown error.')
  const entry = MAP[code]
  if (entry) return locale === 'de' ? entry.de : entry.en
  return fallback ?? code
}
