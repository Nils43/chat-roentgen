import type { Locale } from './i18n'

// Central translation of technical error codes → text the user can actually
// act on. Keep it short, avoid jargon, always end with the next step.
// Fallback is the original message so we never swallow unknown errors.

type Message = { en: string; de: string }

const MAP: Record<string, Message> = {
  // Credits / paywall
  insufficient_credits: {
    en: 'Out of credits. Grab a pack to keep going.',
    de: 'Keine credits mehr. Schnapp dir ein pack, dann geht’s weiter.',
  },
  not_signed_in: {
    en: 'Your session expired. Reload the page and try again.',
    de: 'Session abgelaufen. Lad die seite neu und versuch’s nochmal.',
  },
  spend_failed: {
    en: 'We couldn’t record the spend. Try once more — if it keeps failing, message support.',
    de: 'Der abzug konnte nicht gebucht werden. Nochmal versuchen — falls es bleibt, meld dich.',
  },
  grant_failed: {
    en: 'Payment went through but crediting hit a snag. Your credits will appear in a minute, otherwise reach out.',
    de: 'Zahlung ging durch, credits haken. Sollten in einer minute auftauchen, sonst melde dich.',
  },

  // Stripe / checkout
  stripe_error: {
    en: 'Stripe rejected the request. Try another card or payment method.',
    de: 'Stripe hat die anfrage abgelehnt. Probier eine andere karte oder methode.',
  },
  no_client_secret: {
    en: 'Couldn’t open checkout. Reload and try again.',
    de: 'Checkout konnte nicht starten. Seite neu laden und nochmal.',
  },
  invalid_pack: {
    en: 'That pack isn’t available right now.',
    de: 'Dieses pack ist gerade nicht verfügbar.',
  },
  invalid_session: {
    en: 'This checkout session looks off. Start a fresh purchase.',
    de: 'Die session sieht seltsam aus. Einen neuen kauf starten.',
  },
  missing_metadata: {
    en: 'Purchase went through but we’re missing some info. Credits may be delayed — check your balance in a minute.',
    de: 'Kauf durch, aber infos fehlen. Credits könnten kurz dauern — balance in einer minute prüfen.',
  },

  // Upload / request size
  payload_too_large: {
    en: 'That chat is too big. Export a shorter slice — like the last few months.',
    de: 'Der chat ist zu groß. Exportier einen kürzeren ausschnitt — z.B. die letzten paar monate.',
  },
  invalid_json: {
    en: 'Something in the request got scrambled. Reload the page and try again.',
    de: 'Irgendwas im request ist schiefgegangen. Seite neu laden und nochmal.',
  },

  // Upstream / server
  upstream_unreachable: {
    en: 'The AI isn’t responding right now. Try again in a minute.',
    de: 'Die AI reagiert gerade nicht. In einer minute nochmal probieren.',
  },
  analysis_incomplete: {
    en: 'The AI kept returning incomplete results. Your credit was refunded — try again in a moment.',
    de: 'Die AI hat mehrfach unvollständige Antworten geliefert. Dein credit wurde zurückerstattet — gleich nochmal versuchen.',
  },
  upstream_error: {
    en: 'The AI returned an error. Try again in a moment.',
    de: 'Die AI hat einen fehler gemeldet. Gleich nochmal versuchen.',
  },
  invalid_response: {
    en: 'The AI sent back something we couldn’t read. Try again.',
    de: 'Die AI-antwort war nicht lesbar. Nochmal versuchen.',
  },
  server_exception: {
    en: 'Something crashed on our side. Try again — we’ll see it in the logs either way.',
    de: 'Auf unserer seite ist was gecrasht. Nochmal versuchen — wir sehen’s im log.',
  },
  missing_env: {
    en: 'The server is misconfigured. Please let us know.',
    de: 'Der server ist nicht richtig konfiguriert. Sag uns bitte bescheid.',
  },
  missing_api_key: {
    en: 'The server is misconfigured. Please let us know.',
    de: 'Der server ist nicht richtig konfiguriert. Sag uns bitte bescheid.',
  },
  missing_stripe_config: {
    en: 'Payments aren’t set up right. Please let us know.',
    de: 'Zahlungen sind nicht korrekt aufgesetzt. Sag uns bitte bescheid.',
  },
  missing_stripe_key: {
    en: 'Payments aren’t set up right. Please let us know.',
    de: 'Zahlungen sind nicht korrekt aufgesetzt. Sag uns bitte bescheid.',
  },
  method_not_allowed: {
    en: 'Something went sideways. Reload the page.',
    de: 'Da ist was schief. Seite neu laden.',
  },
}

export function friendlyError(code: string | undefined, locale: Locale, fallback?: string): string {
  if (!code) return fallback ?? (locale === 'de' ? 'Unbekannter fehler.' : 'Unknown error.')
  const entry = MAP[code]
  if (entry) return locale === 'de' ? entry.de : entry.en
  return fallback ?? code
}
