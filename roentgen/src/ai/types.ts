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

// Modul 03 — Beziehungsebene. Ein einziger API-Call der die Dyaden-Dynamik
// analysiert. Empirisch geerdet: Gottman (Bids, Four Horsemen, Repair), Fonagy
// (Mentalisierung), Stern (Attunement), Watzlawick (Meta-Kommunikation), Bowen
// (Differenzierung), Berne (Ulterior Transactions + Games) und Hazan/Shaver
// (Attachment als Dyaden-Konstellation).

// --- Shared / atomare Typen ---

export interface Zitat {
  person: string // Pseudonym, wird clientseitig in Real-Name ersetzt
  text: string // kurze Paraphrase, max ~15 Wörter
}

// Bindungsdyade — die Interaktion beider Bindungsstile, nicht individuell
export type AttachmentDyad =
  | 'secure_secure' // sicher-sicher: tragfähig
  | 'anxious_avoidant' // der klassische "Insecure Trap"
  | 'avoidant_anxious' // spiegelverkehrt
  | 'anxious_anxious' // enmeshed, leicht überwältigt
  | 'avoidant_avoidant' // distanziert, wenig Repair
  | 'secure_anxious'
  | 'anxious_secure'
  | 'secure_avoidant'
  | 'avoidant_secure'
  | 'disorganisiert_beteiligt' // mindestens eine Seite desorganisiert
  | 'unklar'

// Gottmans Vier Apokalyptische Reiter — empirisch stärkster Prädiktor
export type Horseman = 'kritik' | 'verachtung' | 'abwehr' | 'stonewalling'

// Demand–Withdraw: empirisch robusteres Muster als "pursuer–distancer"
export type DemandWithdraw =
  | 'a_demand_b_withdraw'
  | 'b_demand_a_withdraw'
  | 'symmetrisch_demand'
  | 'symmetrisch_withdraw'
  | 'kein_muster'

// Bid-Response-Klassen (Gottman)
export type BidResponse = 'turning_toward' | 'turning_away' | 'turning_against'

// Ulterior Transaction (Berne) — zwei Ebenen gleichzeitig
export interface UlteriorTransaction {
  sozial: string // was auf der Oberfläche gesagt wird
  psychologisch: string // was darunter wirklich passiert
  beispiel: Zitat
}

// Ein erkanntes "Spiel" im Sinne Berne's Games People Play
export interface BerneGame {
  name: string // z.B. "Yes, but...", "Ja-aber", "Wenn du mich wirklich liebtest"
  funktion: string // welches Outcome die Dynamik produziert
  beispiel: Zitat
}

// --- Sektionen ---

// 01. Kopplung — Attunement/Synchrony (Stern)
export interface KopplungSection {
  attunement: number // 0–100, emotionales Mitschwingen
  rhythmus_synchron: number // 0–100, Antwortrhythmus gematcht
  lexikon_synchron: number // 0–100, Sprach-/Tonübernahme
  interpretation: string // 2–4 Sätze
  zitate: Zitat[]
}

// 02. Machtstruktur 3D — Inhalt × Prozess × Affekt
export interface MachtstrukturSection {
  inhalt_lead: string // Pseudonym oder "ausgeglichen" oder "wechselnd"
  prozess_lead: string // wer taktet/rahmt (Metakommunikation)
  affekt_lead: string // wessen emotionale Temperatur den Chat regelt
  asymmetrie_skala: number // 0–100 über alle Achsen aggregiert
  statik: 'statisch' | 'dynamisch'
  interpretation: string
  zitate: Zitat[]
}

// 03. Bindungsdyade — Paarung der Attachment-Stile
export interface BindungsdyadeSection {
  konstellation: AttachmentDyad
  dyaden_beschreibung: string // was die Paarung typischerweise produziert
  dyaden_risiko: string // häufigste Fehlfunktion dieser Konstellation
  interpretation: string
  sicherheit: 'niedrig' | 'mittel' | 'hoch'
  zitate: Zitat[]
}

// 04. Bid-Dynamik (Gottman) — stärkster Prädiktor
export interface BidSection {
  // Hauptmuster über die gesamte Dyade
  dominante_response: BidResponse
  // Feiner: wer bietet, wer turnt wie
  pro_person: {
    person: string
    bid_haeufigkeit: 'selten' | 'mittel' | 'hoch'
    antwort_signatur: BidResponse // wie diese Person meist antwortet
  }[]
  // Konkrete Bid-Momente im Chat
  beispiele: {
    bid: Zitat // das Angebot
    antwort: Zitat // die Reaktion
    klasse: BidResponse
  }[]
  interpretation: string
}

// 05. Repair-Kapazität — Gottman
export interface RepairSection {
  hat_repair: boolean // gibt es Repair-Versuche überhaupt
  wer_repariert: string[] // Pseudonyme — oft asymmetrisch
  annahme_quote: 'niedrig' | 'mittel' | 'hoch' // wie oft Repair angenommen wird
  typische_form: string // z.B. "Sweet-Note", "Humor", "Benennen des Bruchs"
  interpretation: string
  zitate: Zitat[]
}

// 06. Konflikt-Signatur — Gottman + Christensen
export interface KonfliktSignaturSection {
  four_horsemen_pro_person: {
    person: string
    praesenz: Horseman[] // welche Reiter tauchen bei dieser Person auf
    dominierend: Horseman | null // der markanteste, wenn vorhanden
  }[]
  demand_withdraw: DemandWithdraw
  flooding_hinweise: {
    person: string
    hinweis: string // z.B. "Abrupte Kürze nach Eskalation"
  }[]
  interpretation: string
  zitate: Zitat[]
}

// 07. Mentalisierung — Fonagy
export interface MentalisierungSection {
  pro_person: {
    person: string
    qualitaet: 'hoch' | 'mittel' | 'niedrig' | 'ungleichmäßig'
    beschreibung: string // 1–2 Sätze: wie sich das zeigt
  }[]
  projektion_statt_modellierung: string // wo Projektion statt Mentalisierung stattfindet
  interpretation: string
  zitate: Zitat[]
}

// 08. Meta-Kommunikation — Watzlawick/Bateson
export interface MetaKommunikationSection {
  // Kann die Dyade über die Beziehung selbst sprechen?
  kapazitaet: 'hoch' | 'mittel' | 'niedrig' | 'blockiert'
  initiator: string // wer versucht Meta-Talk (Pseudonym oder "beide" / "niemand")
  blocker_muster: string // wie Meta-Talk (wenn überhaupt) abgewehrt wird
  interpretation: string
  zitate: Zitat[]
}

// 09. Berne-Schicht — Ulterior Transactions + Games
export interface BerneLayerSection {
  dominanter_modus: 'oberflächlich_parallel' | 'verdeckt_doppelbödig' | 'wiederkehrendes_spiel' | 'gemischt'
  ulterior_transactions: UlteriorTransaction[] // 1–3 konkrete Beispiele
  games: BerneGame[] // 0–3 wiedererkennbare Spiele
  interpretation: string
}

// 10. Unausgesprochene Regeln — bleibt, leicht präzisiert
export interface UnausgesprocheneRegelnSection {
  regeln: {
    regel: string
    funktion: string // was die Regel im System stabilisiert
    evidenz: string // warum sie im Chat sichtbar wird
  }[]
  interpretation: string
}

// --- Gesamtpayload ---

export interface RelationshipPayload {
  teilnehmer: string[] // Pseudonyme, werden clientseitig ersetzt
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
  kern_insight: string // ein scharfer Satz über die Dynamik
  safety_flag: {
    // Gaslighting, Kontrolle, Gewalt-Indikatoren, emotionale Entwertung
    aktiv: boolean
    beschreibung: string | null // wenn aktiv: was genau, und Hinweis auf Hilfe
  }
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

// Modul 04 — Entwicklung. Komplementär zu Modul 06: während 06 den Bogen als
// visuelles Poster darstellt (Temperatur-Phasen), analysiert 04 die *Themen*
// und den *Verlauf der Symmetrie*, plus eine Gottman-basierte Prognose.
//
// Die lokale Symmetrie-Zeitreihe wird clientseitig aus HardFacts berechnet
// (shareProgression, responseTimeTrend). Der AI-Call liefert Themen pro
// Phase und die Prognose-Narration.

export type ThemePraegnanz = 'niedrig' | 'mittel' | 'hoch'

export interface ThemeCluster {
  thema: string // kurzer Titel, 1–4 Wörter
  praegnanz: ThemePraegnanz
  beispiele: string[] // 1–2 kurze Chat-Paraphrasen
}

export interface ThemePhase {
  start: string // ISO date
  end: string // ISO date
  titel: string // z.B. "Flirtphase" oder "Alltag & Logistik"
  dominante_themen: ThemeCluster[] // 2–5 Cluster
  verschwundene_themen: string[] // Themen die ab hier fehlen
  neue_themen: string[] // Themen die erstmals auftauchen
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
  schluesselmuster: string[] // 2–5 beobachtete Muster die den Trend tragen
  gottman_signale: GottmanSignal[] // alle beobachteten Signale
  wenn_nichts_aendert: string // 2–3 Sätze
  was_verschieben_wuerde: string // 2–3 Sätze hypothetisch
  disclaimer: string // expliziter Hinweis auf Grenzen der Datenlage
}

export interface EntwicklungPayload {
  zentrale_themen_gesamt: ThemeCluster[] // 3–6 Themen die den ganzen Chat durchziehen
  themen_phasen: ThemePhase[] // 2–5 Phasen
  prognose: PrognoseSection
  gesamtbogen: string // 2–3 Sätze Narrative über den Verlauf
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
