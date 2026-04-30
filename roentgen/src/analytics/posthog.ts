import posthog from 'posthog-js'

// PostHog wired up in privacy-first mode. Goal: aggregate funnel
// counts (where do people drop off?), nothing else. Constraints we
// bake in here so the rest of the codebase can `track('event')` without
// thinking about PII:
//
//   - EU host. eu.i.posthog.com — data stays in the EU.
//   - No cookies, no localStorage. `persistence: 'memory'` means the
//     "user" is the page load. Funnels work within a session, not
//     across sessions. That is the point.
//   - No autocapture. We pick the events we care about explicitly.
//     Autocapture would scoop up DOM interactions including chat-
//     sensitive elements; not worth the privacy debt.
//   - No session recording. Replays would capture the chat content.
//     Hard no.
//   - IP masked. Server can use it for geo (country-level) but we
//     don't ship it as a property.
//   - Pageviews off. We send `app_view` events when stages change so
//     we can map them to the actual stage flow, not the URL.
//
// Default key is the live spillteato.me project (EU). PostHog "Project
// API Keys" (phc_…) are *public* by design — same threat model as a
// Stripe publishable key. They only let the bearer write events to a
// single project; reads require the secret personal key on the dash.
// Hardcoding it here means production works without a Vercel env var.
// Override locally with VITE_POSTHOG_KEY in .env if you want events to
// land in your own PostHog project instead of prod (recommended for
// dev so you don't pollute the funnel).
const DEFAULT_POSTHOG_KEY = 'phc_sAi8xGopM8pufhrtmE5swwhZobrCcSCLQcTVZkaY2Wsx'
const DEFAULT_POSTHOG_HOST = 'https://eu.i.posthog.com'

let initialised = false

export function initPostHog(): void {
  if (initialised) return
  if (typeof window === 'undefined') return
  const key = (import.meta.env.VITE_POSTHOG_KEY as string | undefined) ?? DEFAULT_POSTHOG_KEY
  if (!key) return

  const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? DEFAULT_POSTHOG_HOST
  posthog.init(key, {
    api_host: host,
    ui_host: 'https://eu.posthog.com',
    persistence: 'memory',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    disable_surveys: true,
    enable_recording_console_log: false,
    mask_all_text: true,
    mask_all_element_attributes: true,
    property_blacklist: ['$ip', '$current_url', '$pathname', '$referrer', '$referring_domain'],
    sanitize_properties: (props) => {
      // Defensive: strip anything chat-shaped that an event might
      // accidentally carry. We never set these intentionally.
      const dropKeys = ['name', 'email', 'phone', 'message', 'content', 'text']
      for (const k of dropKeys) delete (props as Record<string, unknown>)[k]
      return props
    },
    loaded: (ph) => {
      // Anonymise: don't link any cross-session id. Each visit is its
      // own anonymous bundle.
      try { ph.reset(true) } catch { /* swallow — older builds don't have it */ }
    },
  })
  initialised = true
}

// Names are kebab-case, scoped by where in the funnel they happen.
// Funnel order roughly: upload → hard-facts → paywall → checkout →
// analysis → share. Add new events at the end of this list and pick
// a name that makes sense as a column in PostHog.
export type EventName =
  | 'app_view' // generic stage change — emits a `stage` property
  | 'upload_started'
  | 'upload_parsed'
  | 'upload_failed'
  | 'hard_facts_shown'
  | 'early_unlock_shown'
  | 'early_unlock_clicked'
  | 'paywall_room_shown'
  | 'paywall_cta_clicked'
  | 'checkout_opened'
  | 'checkout_completed'
  | 'checkout_dismissed'
  | 'analysis_started'
  | 'analysis_completed'
  | 'analysis_failed'
  | 'share_opened'
  | 'share_done'
  | 'library_opened'
  | 'library_chat_opened'

export function track(event: EventName, props?: Record<string, string | number | boolean>): void {
  if (!initialised) return
  try {
    posthog.capture(event, props)
  } catch {
    // Never let tracking crash the app.
  }
}
