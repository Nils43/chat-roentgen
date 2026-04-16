// Structured shape of Modul 02 output. Matches the tool schema we send to Claude.
// Keep this in sync with prompts.ts.

export interface PersonProfile {
  person: string // pseudonym like "Person A" — client restores to real name
  kommunikationsstil: {
    achsen: {
      direktIndirekt: number // -10 (direkt) … +10 (indirekt)
      emotionalSachlich: number // -10 (emotional) … +10 (sachlich)
      ausfuehrlichKnapp: number // -10 (ausführlich) … +10 (knapp)
      initiierendReagierend: number // -10 (initiierend) … +10 (reagierend)
    }
    beschreibung: string // 2–3 Sätze Prosa
  }
  horney: {
    orientierung: 'zu_menschen' | 'gegen_menschen' | 'von_menschen' | 'gemischt'
    interpretation: string
    evidenz: string[] // 1–2 Chat-Zitat-Paraphrasen
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
    kompensation: string // kurze Beschreibung des erkannten Musters
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
  // Ein einsatzfähiges, überraschendes Einzelzitat
  kern_insight: string
}

export interface ProfileResult {
  profile: PersonProfile
  raw: string // raw model response for debugging
  inputTokens: number
  outputTokens: number
  model: string
}

// Modul 05 — Highlights. A single AI call produces N scored moments.

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
  titel: string // 3–6 Wörter Headline
  dekodierung: string // 2–4 Sätze: was hier wirklich passiert
  signifikanz: string // 1–2 Sätze: warum dieser Moment
  score: number // 0–100, AI-interne Gewichtung
}

export interface HighlightsPayload {
  highlights: Highlight[]
  meta: {
    gesamtbefund: string // 2–3 Sätze: was die Highlights zusammen zeigen
  }
}

export interface HighlightsResult {
  payload: HighlightsPayload
  raw: string
  inputTokens: number
  outputTokens: number
  model: string
}

// Modul 03 — Beziehungsebene. Ein einziger API-Call der alle Teilnehmer gemeinsam
// analysiert. Paarweise Sektionen im Dyaden-Fall; bei Gruppen wird zusätzlich ein
// Netzwerk-Diagramm geliefert.

export type PowerLead = 'person_a' | 'person_b' | 'balanced' | 'mixed'
export type BerneTransaction =
  | 'erwachsenen_erwachsenen' // parallel, gesund
  | 'eltern_kind' // gekreuzt, Machtgefälle
  | 'kind_eltern' // gekreuzt, Regression
  | 'kind_kind' // parallel, spielerisch/eskalativ
  | 'eltern_eltern' // parallel, Blockade
  | 'gemischt'

export type ConflictStyle =
  | 'direkte_ansprache'
  | 'vermeidung'
  | 'humor_deflection'
  | 'passiv_aggressiv'
  | 'eskalation'
  | 'repair_oriented'
  | 'gemischt'

export type CialdiniPrinciple =
  | 'reciprocity'
  | 'scarcity'
  | 'social_proof'
  | 'authority'
  | 'commitment_consistency'
  | 'liking'
  | 'unity'

export interface RelationshipSection<T extends string> {
  // strukturierte Kernaussage (Label, Prozent, Kategorie – je nach Sektion)
  kennwert: T
  // freie Prosa, 2–4 Sätze
  interpretation: string
  // kurze Chat-Paraphrasen als Belege
  evidenz: string[]
}

export interface MachtgefaelleSection {
  inhaltlich: PowerLead // wer setzt Themen
  strukturell: PowerLead // wer bestimmt wann/wie
  interpretation: string
  evidenz: string[]
}

export interface InvestmentDeltaSection {
  // Wer investiert mehr — und wie stark. 0 = symmetrisch, 100 = maximale Asymmetrie.
  skala: number // 0–100
  richtung: PowerLead // wer investiert mehr
  statik: 'statisch' | 'dynamisch' // konstant vs. pendelnd
  interpretation: string
  evidenz: string[]
}

export interface BerneSection {
  dominant: BerneTransaction
  beispiele: string[] // konkrete Chat-Paraphrasen
  interpretation: string
}

export interface KonfliktstilSection {
  dominant: ConflictStyle
  pro_person: { person: string; stil: ConflictStyle }[]
  interpretation: string
  evidenz: string[]
}

export interface NaeheDistanzSection {
  naeheSucher: string // Name der Person (Pseudonym, wird ersetzt)
  distanzRegulierer: string
  muster: string // kurze Charakterisierung des Tanzes
  interpretation: string
  evidenz: string[]
}

export interface CialdiniSection {
  taktiken: {
    prinzip: CialdiniPrinciple
    von: string // Pseudonym
    beispiel: string
    wirkung: string // 1 Satz was es im Gespräch bewirkt
  }[]
  interpretation: string
}

export interface UnausgesprocheneRegelnSection {
  regeln: {
    regel: string // "Wir reden nicht über X."
    evidenz: string // warum das sichtbar ist
  }[]
  interpretation: string
}

export interface RelationshipPayload {
  teilnehmer: string[] // Pseudonyme, werden replaced
  machtgefaelle: MachtgefaelleSection
  investment_delta: InvestmentDeltaSection
  berne: BerneSection
  konfliktstil: KonfliktstilSection
  naehe_distanz: NaeheDistanzSection
  cialdini: CialdiniSection
  unausgesprochene_regeln: UnausgesprocheneRegelnSection
  kern_insight: string // ein scharfer Satz über die Dynamik
}

export interface RelationshipResult {
  payload: RelationshipPayload
  raw: string
  inputTokens: number
  outputTokens: number
  model: string
}

// Modul 06 — Timeline. Das visuelle Herzstück. Ein AI-Call findet Phasen +
// emotionale Temperatur + Kipppunkte über den gesamten Chat-Bogen. Die lokalen
// Aktivitätsdaten (Nachrichten pro Tag, ResponseTimes) werden clientseitig
// darunter gelegt.

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
  titel: string // z.B. "Die ersten drei Wochen"
  start: string // ISO date YYYY-MM-DD
  end: string // ISO date YYYY-MM-DD
  temperatur: number // 1–10: emotionale Temperatur
  kurzbeschreibung: string // 1–2 Sätze
  dominantes_muster: string // z.B. "Tägliche Abendgespräche bis Mitternacht"
}

export interface TimelineKipppunkt {
  datum: string // ISO date
  titel: string // 3–6 Wörter
  beschreibung: string // 1–2 Sätze: was hier kippt und warum
  beteiligt: string[] // Pseudonyme
}

export interface TimelinePayload {
  phasen: TimelinePhase[] // 3–7 Phasen, chronologisch
  kipppunkte: TimelineKipppunkt[] // 0–5 Kipppunkte
  gesamtbogen: string // 2–3 Sätze: der Bogen der Beziehung in Prosa
  finaler_zustand: 'aufwärts' | 'stabil' | 'abwärts' | 'gebrochen' | 'unklar'
}

export interface TimelineResult {
  payload: TimelinePayload
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
