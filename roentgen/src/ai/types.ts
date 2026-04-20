// Structured shape of the per-person profile output. Matches the tool schema we send to Claude.
// Keep this in sync with prompts.ts.

export interface PersonProfile {
  person: string // pseudonym like "Person A" — client restores to real name
  kommunikationsstil: {
    achsen: {
      direktIndirekt: number // -10 (direct) … +10 (indirect)
      emotionalSachlich: number // -10 (emotional) … +10 (matter-of-fact)
      ausfuehrlichKnapp: number // -10 (verbose) … +10 (terse)
      initiierendReagierend: number // -10 (initiating) … +10 (reacting)
    }
    beschreibung: string // 2–3 sentences of prose
  }
  horney: {
    orientierung: 'zu_menschen' | 'gegen_menschen' | 'von_menschen' | 'gemischt'
    interpretation: string
    evidenz: string[] // 1–2 paraphrased chat quotes
  }
  berne: {
    dominanter_zustand: 'eltern_ich' | 'erwachsenen_ich' | 'kind_ich' | 'gemischt'
    nuance: 'fürsorglich' | 'kritisch' | 'sachlich_rational' | 'spontan' | 'angepasst' | 'rebellisch' | null
    interpretation: string
    evidenz: string[]
  }
  bowlby: {
    tendenz: 'sicher' | 'aengstlich_ambivalent' | 'vermeidend' | 'desorganisiert'
    sicherheit: 'niedrig' | 'mittel' | 'hoch' // how confident the read is
    interpretation: string
    evidenz: string[]
  }
  adler: {
    kompensation: string // short description of the observed pattern
    interpretation: string
    evidenz: string[]
  }
  goffman: {
    front_stage: string
    back_stage_durchbrueche: string
    interpretation: string
    evidenz: string[]
  }
  sprachliche_fingerabdruecke: {
    lieblings_formulierungen: string[]
    wiederkehrende_satzanfaenge: string[]
    zeichensetzung: string
  }
  // One sharp, surprising single sentence
  kern_insight: string
}

export interface ProfileResult {
  profile: PersonProfile
  raw: string // raw model response for debugging
  inputTokens: number
  outputTokens: number
  model: string
}

// Highlights module. A single AI call produces N scored moments.

export type HighlightCategory =
  | 'verletzlichkeit'
  | 'machtverschiebung'
  | 'subtext'
  | 'emotional_peak'
  | 'red_flag'
  | 'green_flag'
  | 'goffman_moment'
  | 'ignoriert'

export type HighlightFramework = 'horney' | 'berne' | 'bowlby' | 'adler' | 'goffman' | 'keiner'

export interface Highlight {
  index: number // index into the pseudonymized sample array (0-based)
  author: string // pseudonym in model output, restored to real name client-side
  timestamp: string // ISO-ish, e.g. "2024-03-12 23:41" — as written by model
  original_text: string // verbatim quote from the sample
  category: HighlightCategory
  framework: HighlightFramework
  titel: string // 3–6 word headline
  dekodierung: string // 2–4 sentences: what's really happening here
  signifikanz: string // 1–2 sentences: why this moment
  score: number // 0–100, AI-internal weighting
}

export interface HighlightsPayload {
  highlights: Highlight[]
  meta: {
    gesamtbefund: string // 2–3 sentences: what the highlights together show
  }
}

export interface HighlightsResult {
  payload: HighlightsPayload
  raw: string
  inputTokens: number
  outputTokens: number
  model: string
}

// Relationship-level module. One API call that analyzes the dyadic dynamic.
// Empirically grounded: Gottman (bids, Four Horsemen, repair), Fonagy
// (mentalization), Stern (attunement), Watzlawick (meta-communication), Bowen
// (differentiation), Berne (ulterior transactions + games) and Hazan/Shaver
// (attachment as a dyadic constellation).

// --- Shared / atomic types ---

export interface Zitat {
  person: string // pseudonym, replaced with real name client-side
  text: string // short paraphrase, max ~15 words
}

// Attachment dyad — the pairing of two styles, not individual
export type AttachmentDyad =
  | 'secure_secure' // secure/secure: sturdy
  | 'anxious_avoidant' // the classic "insecure trap"
  | 'avoidant_anxious' // mirrored
  | 'anxious_anxious' // enmeshed, easily overwhelmed
  | 'avoidant_avoidant' // distant, little repair
  | 'secure_anxious'
  | 'anxious_secure'
  | 'secure_avoidant'
  | 'avoidant_secure'
  | 'disorganisiert_beteiligt' // at least one side disorganized
  | 'unklar'

// Gottman's Four Horsemen — strongest empirical predictor
export type Horseman = 'kritik' | 'verachtung' | 'abwehr' | 'stonewalling'

// Demand–withdraw: empirically more robust than "pursuer–distancer"
export type DemandWithdraw =
  | 'a_demand_b_withdraw'
  | 'b_demand_a_withdraw'
  | 'symmetrisch_demand'
  | 'symmetrisch_withdraw'
  | 'kein_muster'

// Bid response classes (Gottman)
export type BidResponse = 'turning_toward' | 'turning_away' | 'turning_against'

// Ulterior transaction (Berne) — two layers at once
export interface UlteriorTransaction {
  sozial: string // what's said on the surface
  psychologisch: string // what's actually happening underneath
  beispiel: Zitat
}

// A recognized "game" in the Berne "Games People Play" sense
export interface BerneGame {
  name: string // e.g. "Yes, but...", "If you really loved me"
  funktion: string // the outcome the dynamic produces
  beispiel: Zitat
}

// --- Sections ---

// 01. Coupling — attunement / synchrony (Stern)
export interface KopplungSection {
  attunement: number // 0–100, emotional resonance
  rhythmus_synchron: number // 0–100, reply-rhythm match
  lexikon_synchron: number // 0–100, language/tone borrowing
  interpretation: string // 2–4 sentences
  zitate: Zitat[]
}

// 02. Power structure, 3D — content × process × affect
export interface MachtstrukturSection {
  inhalt_lead: string // pseudonym or "balanced" or "shifting"
  prozess_lead: string // who paces / frames (meta-communication)
  affekt_lead: string // whose emotional temperature the chat follows
  asymmetrie_skala: number // 0–100 aggregated across axes
  statik: 'statisch' | 'dynamisch'
  interpretation: string
  zitate: Zitat[]
}

// 03. Attachment dyad — the pairing of attachment styles
export interface BindungsdyadeSection {
  konstellation: AttachmentDyad
  dyaden_beschreibung: string // what this pairing typically produces
  dyaden_risiko: string // the most common failure mode for this combo
  interpretation: string
  sicherheit: 'niedrig' | 'mittel' | 'hoch'
  zitate: Zitat[]
}

// 04. Bid dynamics (Gottman) — strongest predictor
export interface BidSection {
  // Main pattern across the dyad
  dominante_response: BidResponse
  // Finer: who offers, who turns how
  pro_person: {
    person: string
    bid_haeufigkeit: 'selten' | 'mittel' | 'hoch'
    antwort_signatur: BidResponse // how this person usually answers
  }[]
  // Concrete bid moments in the chat
  beispiele: {
    bid: Zitat // the offer
    antwort: Zitat // the response
    klasse: BidResponse
  }[]
  interpretation: string
}

// 05. Repair capacity — Gottman
export interface RepairSection {
  hat_repair: boolean // are there any repair attempts at all
  wer_repariert: string[] // pseudonyms — often asymmetric
  annahme_quote: 'niedrig' | 'mittel' | 'hoch' // how often repair is accepted
  typische_form: string // e.g. "sweet note", "humor", "naming the break"
  interpretation: string
  zitate: Zitat[]
}

// 06. Conflict signature — Gottman + Christensen
export interface KonfliktSignaturSection {
  four_horsemen_pro_person: {
    person: string
    praesenz: Horseman[] // which horsemen appear for this person
    dominierend: Horseman | null // the strongest one, if any
  }[]
  demand_withdraw: DemandWithdraw
  flooding_hinweise: {
    person: string
    hinweis: string // e.g. "abrupt brevity after escalation"
  }[]
  interpretation: string
  zitate: Zitat[]
}

// 07. Mentalization — Fonagy
export interface MentalisierungSection {
  pro_person: {
    person: string
    qualitaet: 'hoch' | 'mittel' | 'niedrig' | 'ungleichmäßig'
    beschreibung: string // 1–2 sentences: how it shows up
  }[]
  projektion_statt_modellierung: string // where projection replaces mentalization
  interpretation: string
  zitate: Zitat[]
}

// 08. Meta-communication — Watzlawick/Bateson
export interface MetaKommunikationSection {
  // Can the dyad talk about the relationship itself?
  kapazitaet: 'hoch' | 'mittel' | 'niedrig' | 'blockiert'
  initiator: string // who attempts meta-talk (pseudonym, "both" or "nobody")
  blocker_muster: string // how meta-talk (if at all) gets deflected
  interpretation: string
  zitate: Zitat[]
}

// 09. Berne layer — ulterior transactions + games
export interface BerneLayerSection {
  dominanter_modus: 'oberflächlich_parallel' | 'verdeckt_doppelbödig' | 'wiederkehrendes_spiel' | 'gemischt'
  ulterior_transactions: UlteriorTransaction[] // 1–3 concrete examples
  games: BerneGame[] // 0–3 recognizable games
  interpretation: string
}

// 10. Unspoken rules — mostly unchanged, lightly sharpened
export interface UnausgesprocheneRegelnSection {
  regeln: {
    regel: string
    funktion: string // what the rule stabilizes in the system
    evidenz: string // why it's visible in the chat
  }[]
  interpretation: string
}

// --- Full payload ---

export interface RelationshipPayload {
  teilnehmer: string[] // pseudonyms, replaced client-side
  kopplung: KopplungSection
  machtstruktur: MachtstrukturSection
  bindungsdyade: BindungsdyadeSection
  bids: BidSection
  repair: RepairSection
  konflikt_signatur: KonfliktSignaturSection
  mentalisierung: MentalisierungSection
  meta_kommunikation: MetaKommunikationSection
  berne: BerneLayerSection
  unausgesprochene_regeln: UnausgesprocheneRegelnSection
  kern_insight: string // one sharp sentence about the dynamic
  safety_flag: {
    // gaslighting, control, violence signals, emotional devaluation
    aktiv: boolean
    beschreibung: string | null // when active: what exactly, plus a pointer to help
  }
}

export interface RelationshipResult {
  payload: RelationshipPayload
  raw: string
  inputTokens: number
  outputTokens: number
  model: string
}

// Timeline module. The visual centerpiece. An AI call finds phases +
// emotional temperature + turning points over the whole arc. Local activity
// data (messages per day, response times) gets layered underneath client-side.

export type PhaseLabel =
  | 'kennenlernen'
  | 'vertiefung'
  | 'hochphase'
  | 'plateau'
  | 'distanzierung'
  | 'konflikt'
  | 'repair'
  | 'abkühlung'
  | 'neuanfang'
  | 'sonstiges'

export interface TimelinePhase {
  label: PhaseLabel
  titel: string // e.g. "The first three weeks"
  start: string // ISO date YYYY-MM-DD
  end: string // ISO date YYYY-MM-DD
  temperatur: number // 1–10: emotional temperature
  kurzbeschreibung: string // 1–2 sentences
  dominantes_muster: string // e.g. "nightly conversations until midnight"
}

export interface TimelineKipppunkt {
  datum: string // ISO date
  titel: string // 3–6 words
  beschreibung: string // 1–2 sentences: what tips here and why
  beteiligt: string[] // pseudonyms
}

export interface TimelinePayload {
  phasen: TimelinePhase[] // 3–7 phases, chronological
  kipppunkte: TimelineKipppunkt[] // 0–5 turning points
  gesamtbogen: string // 2–3 sentences: the arc in prose
  finaler_zustand: 'aufwärts' | 'stabil' | 'abwärts' | 'gebrochen' | 'unklar'
}

export interface TimelineResult {
  payload: TimelinePayload
  raw: string
  inputTokens: number
  outputTokens: number
  model: string
}

// Evolution module. Complementary to the timeline: timeline draws the arc as a
// visual poster (temperature phases), evolution analyzes the *topics* and the
// *symmetry trend*, plus a Gottman-based forecast.
//
// The local symmetry time series is computed client-side from HardFacts
// (share progression, response-time trend). The AI call delivers topics per
// phase and the forecast narration.

export type ThemePraegnanz = 'niedrig' | 'mittel' | 'hoch'

export interface ThemeCluster {
  thema: string // short title, 1–4 words
  praegnanz: ThemePraegnanz
  beispiele: string[] // 1–2 short chat paraphrases
}

export interface ThemePhase {
  start: string // ISO date
  end: string // ISO date
  titel: string // e.g. "Flirting phase" or "Daily life & logistics"
  dominante_themen: ThemeCluster[] // 2–5 clusters
  verschwundene_themen: string[] // topics missing from this phase onward
  neue_themen: string[] // topics appearing for the first time
}

export type PrognoseRichtung = 'positiv' | 'stagnation' | 'negativ' | 'unklar'
export type GottmanSignal =
  | 'kritik' // criticism
  | 'verachtung' // contempt
  | 'abwehr' // defensiveness
  | 'stonewalling'
  | 'repair_attempt'
  | 'bid_for_connection'
  | 'turning_away' // turning away from bids
  | 'keine'

export interface PrognoseSection {
  richtung: PrognoseRichtung
  confidence: 'niedrig' | 'mittel' | 'hoch'
  schluesselmuster: string[] // 2–5 observed patterns carrying the trend
  gottman_signale: GottmanSignal[] // all observed signals
  wenn_nichts_aendert: string // 2–3 sentences
  was_verschieben_wuerde: string // 2–3 sentences, hypothetical
  disclaimer: string // explicit note on data limits
}

export interface EntwicklungPayload {
  zentrale_themen_gesamt: ThemeCluster[] // 3–6 topics running through the whole chat
  themen_phasen: ThemePhase[] // 2–5 phases
  prognose: PrognoseSection
  gesamtbogen: string // 2–3 narrative sentences about the arc
}

export interface EntwicklungResult {
  payload: EntwicklungPayload
  raw: string
  inputTokens: number
  outputTokens: number
  model: string
}

export interface ApiRequest {
  model: string
  max_tokens: number
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  tools?: {
    name: string
    description: string
    input_schema: Record<string, unknown>
  }[]
  tool_choice?: { type: 'tool'; name: string } | { type: 'auto' } | { type: 'any' }
}

export interface ApiResponse {
  id: string
  model: string
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: unknown }
  >
  usage: {
    input_tokens: number
    output_tokens: number
  }
  stop_reason: string
}
