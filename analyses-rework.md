# Analysen-Rework Plan

> Ziel: Die zwei Analysen (Personal + Relationship) eng mit den Hard-Facts-Zahlen verzahnen, **max 30 ct pro Anfrage**, Output-Qualität maximal.

---

## 1. Wo wir heute stehen

**Was passiert aktuell bei einer Analyse:**

- Lokal wird ein "Smart-Session-Sample" gebaut (~500 Nachrichten, Zieltoken ~20k)
- Der ganze Chat-Slice wird als Plain-Text in den User-Prompt gepackt
- Das System-Prompt ist ein langer theoretischer Essay (Horney, Berne, Bowlby, Adler, Goffman für Profile; Gottman, Fonagy, Stern, Watzlawick, Hazan, Berne für Relationship)
- Model: `claude-sonnet-4-6`, Tool-Schema erzwingt strukturierten Output
- Claude zählt sich dabei teilweise Dinge zusammen, die wir **schon lokal in HardFacts berechnet haben**

**Token- und Kostenschätzung pro Call (Sonnet 4.6, ~$3/MTok in, ~$15/MTok out):**

| Modul | Input | Output | Kosten |
|------|-------|--------|--------|
| Personal (1 User, kombinierter Pass) | ~22k | ~3k | **~12 ct** |
| Relationship (1 Pass, mehr Schema) | ~22k | ~4k | **~13 ct** |
| Summe pro Chat | | | **~25 ct** |

Knapp am 30-ct-Limit. Und bei einem größeren Chat kippt das sofort.

**Drei Probleme:**

1. **Doppelarbeit** — Claude re-berechnet Zahlen, die lokal schon exakt vorliegen (Anteile, Antwortzeiten, Initiative, Hedges, Emojis, Aktivität). Verschenkte Tokens UND schlechtere Konsistenz (AI kann leicht anders zählen).
2. **Schwammiger Anker** — das AI-Output referenziert die Hard Facts nicht direkt. Der User sieht 73% auf Seite 1 und liest auf Seite 2 "wer mehr gibt …" ohne klaren Rückbezug.
3. **Overshoot im Prompt** — das System-Prompt zählt Frameworks auf, die bereits strukturell im Tool-Schema kodiert sind. Redundanz.

---

## 2. Zielbild

**Das AI-Modell interpretiert. Es rechnet nicht.**

Der Chat geht nur noch als kuratierter Kontext rein — das Rechenwerk kommt als **Evidence Packet** (JSON) vorgefüttert. Claude referenziert diese Zahlen wörtlich im Output, sodass die AI-Analyse visuell und inhaltlich perfekt an die Hard Facts andockt.

**Ergebnis im UI:**

> *"You send 73% of the messages (Hard Fact 01). That pattern reads as over-investment — you keep the room warm. The moment it shifts: usually after Person B gets short (seen in burst #3 on 14. March)."*

Die Analyse ist **beweisbasiert**, jeder Claim zitiert eine lokale Zahl.

---

## 3. Konkreter Umbau

### 3.1 Evidence Packet bauen (lokal, kein API-Call)

Neues Modul `src/ai/evidence.ts`. Nimmt `HardFacts` + `ParsedChat` rein, spuckt ein kompaktes JSON-Objekt aus:

```ts
interface EvidencePacket {
  participants: string[]
  self: string  // wer gerade analysiert wird (für Profile)

  distribution: { messages: [pct, pct], words: [pct, pct] }
  replyTimes: { medianMs: [n, n], buckets: [...] }
  initiation: { shareAfterPause: [pct, pct], drift: {...} }
  questions:   { ratio: [pct, pct] }
  hedges:      { ratio: [pct, pct], topExamples: string[] }  // 3-5 kurze Paraphrasen
  emojis:      { perMsg: [n, n], top: [...] }
  bursts:      { count: [n, n], longest: [n, n] }
  lateNight:   { count: [n, n], ratio: [pct, pct] }
  rhythm:      { peakDay: string, activeDays: n, silentDays: n, longestSilenceDays: n }

  arc: { weeks: {start: string, total: n, [person]: n}[] }  // aggregiert, nicht alle Wochen

  notableMoments: {
    ts: string
    author: string
    text: string   // gekürzt auf ≤ 200 Zeichen
    why: 'burst_start' | 'late_night' | 'long_silence_before' | 'apology' | 'hedge_spike' | 'peak_day' | 'drift_turn'
  }[]  // max 30 ausgewählte Momente
}
```

Das ist **alles, was Claude braucht**. Etwa **800–1500 Tokens** statt 20.000.

### 3.2 Sampling umstellen

Das heutige `sampling.ts` bleibt als Fallback-Quelle für `notableMoments`, aber **nur kuratiert**:

- Erste Nachricht jedes Bursts
- Nachrichten zu ungewöhnlichen Uhrzeiten (> 23:00 < 05:00)
- Nachrichten **vor** und **nach** langen Stille-Pausen
- Nachrichten mit dichtem Hedge-Wort-Cluster
- Entschuldigungen ("sorry", "entschuldigung", "my bad", etc. via Regex)
- Peak-Day-Messages
- Kipppunkt-Fenster (±3 Tage um den `initiationDrift`-Swap)

**Cap: 30 Nachrichten**, jede auf 200 Zeichen gekürzt. Ergibt ~3–4k Tokens.

### 3.3 System-Prompts shrinken

Neue Prompts, radikal verschlankt:

**Profile (Personal)** — Target ~600 Tokens:
```
Du bist ein scharfer Beobachter. Du bekommst vorab-berechnete Zahlen über eine
Person in einem Chat und kuratierte Beispielnachrichten. Deine Aufgabe: diese
Fakten interpretieren, nicht neu berechnen.

Stil: kurze Sätze, konkret, keine Framework-Namen, keine Coach-Phrasen.
Jede Aussage muss sich auf eine Zahl aus dem Evidence Packet stützen oder auf
eine konkrete Beispielnachricht (zitiert mit Index).

Output: strikt via submit_profile tool.
```
Rest der Logik lebt im Schema.

**Relationship** — analog, Target ~800 Tokens.

Frameworks bleiben **als enums** im Tool-Schema (interne Struktur), verschwinden aus der Prosa-Anweisung.

### 3.4 Model-Wahl: Haiku 4.5 als Standard

| Model | Input $/MTok | Output $/MTok | 5k in + 2k out |
|-------|--------------|---------------|----------------|
| Haiku 4.5 | ~$1 | ~$5 | **~1,5 ct** |
| Sonnet 4.6 | ~$3 | ~$15 | ~4,5 ct |
| Opus 4.7 | ~$15 | ~$75 | ~23 ct |

Haiku 4.5 ist **Default**. Der strukturierte Input (Evidence Packet) kompensiert die geringere Modellgröße, weil Claude nicht mehr "rauslesen" muss — es interpretiert schon aufbereitete Daten.

Optional: ENV-Variable `VITE_ROENTGEN_MODEL=sonnet-4-6` für Premium-Deploys. Kostet dann ~5 ct statt ~1,5 — weit unter Budget.

### 3.5 Prompt Caching aktivieren

System-Prompt + Tool-Schema als `cache_control: { type: "ephemeral" }` markieren. Anthropic behält den Cache 5 Minuten.

**Einsparung:** Bei zwei Analysen pro Chat (Personal + Relationship, beide in < 5 min) wird der zweite Call 90% günstiger auf dem gecachten Teil. Spart nochmal ~30% der Gesamtkosten.

---

## 4. Ziel-Kostenrechnung

Nach Umbau, pro Chat:

| Modul | Model | Input | Output | Kosten |
|-------|-------|-------|--------|--------|
| Evidence-Bau | — (lokal) | — | — | **0 ct** |
| Personal (Haiku 4.5) | Haiku | 5k | 2k | **~1,5 ct** |
| Relationship (Haiku 4.5, gecacht) | Haiku | 5k | 3k | **~1,8 ct** |
| **Summe pro Chat** | | | | **~3,3 ct** |

**Marge gegenüber 30-ct-Ziel:** ~9× Spielraum. Selbst mit Chat-Größe-Spikes, Retries, oder späterem Upgrade auf Sonnet bleibt man unter Budget.

---

## 5. Qualitäts-Checks

Was muss nach dem Umbau evaluiert werden (an 3–5 echten Chats):

1. **Konsistenz:** Referenziert der Output exakt die Zahlen aus den Hard Facts? Kein Zahlendrift.
2. **Tiefe:** Haiku 4.5 muss bei der Interpretation nicht generisch werden. Stichprobe: "Wie konkret sind die beschriebenen Patterns?"
3. **Safety:** Bei roten Mustern (emotionaler Missbrauch, Drohungen) muss der `safety_flag` korrekt setzen — Haiku ist hier getestet werden.
4. **Framework-Leakage:** Output darf keine Theoretiker-Namen enthalten (Prompt verbietet's, aber prüfen).
5. **Token-Budget:** `approxTokens` im PrepareResult matcht tatsächliche Kosten.

Wenn Haiku bei Punkt 2 schwächelt → Fallback Sonnet 4.6 konfigurieren, immer noch unter Budget.

---

## 6. Umbau-Reihenfolge

1. **Evidence-Modul** bauen (`src/ai/evidence.ts`) — reine Funktion `buildEvidence(facts, chat, selfPerson) → EvidencePacket`. Mit Unit-Test.
2. **Curated-Sampling** — neue Funktion `curatedMoments(facts, chat) → Message[]` mit den 30-Moment-Heuristiken.
3. **Prompts neu schreiben** — `src/ai/prompts.ts`:
   - `PROFILE_SYSTEM_PROMPT` shrink (~600 tokens, klare evidence-first-Anweisung)
   - `RELATIONSHIP_SYSTEM_PROMPT` shrink (~800 tokens)
   - Tool-Schemas behalten, in evidenz-feldern eventuell verlinken ("zitiere Evidence.hedges.ratio")
4. **Analyzer-Aufrufe anpassen** — `profile.ts` und `relationship.ts`:
   - Model auf `claude-haiku-4-5` umstellen
   - User-Message: JSON Evidence Packet + 30 kuratierte Messages
   - `cache_control` auf system prompt
5. **UI-Anpassung** (optional V2) — die Analyse-Views können jetzt auf die Evidence-referenzen im Output hinweisen ("Fakt 03: 73% Share"), um die Bindung zu den Hard Facts sichtbar zu machen.
6. **Evaluation** an 3–5 echten Chats, Side-by-side mit der aktuellen Lösung. Wenn Qualität gleich/besser: merge. Sonst Haiku → Sonnet umschalten (trotzdem im Budget).

---

## 7. Offene Fragen

- **Haiku vs. Sonnet bei deutschen Chats:** Haiku hat historisch leichte Lücken bei nicht-englischen Nuancen. Evaluation nötig.
- **Deutsch vs. Englisch im Output:** Aktuell Output auf Englisch (Prompt-Zwang). Behalten?
- **Fallback bei Evidence-Ausfall:** Wenn HardFacts einen Edge Case hat (leere Heatmap, nur eine Person spricht), muss Evidence graceful degraden.
- **Post-Purchase-Ton:** Soll der User nach dem Bezahlen einen Loading-State sehen der signalisiert "tea is reading your receipts" — auch wenn der Call in 2s durch ist?

---

*Plan V1. Live-Dokument bis implementiert.*
