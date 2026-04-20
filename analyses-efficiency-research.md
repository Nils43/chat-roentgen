# Analyses — Token-Efficiency Deep Research

> Ziel: **maximal scharfer Output bei minimaler Input-Masse.** Jedes Token muss eine Interpretations-Hebelwirkung haben. Voice: trocken-ironisch im Receipts-Ton.

---

## 1. Die ehrliche Bestandsaufnahme

Nach der ersten Rework-Runde (`analyses-rework.md`) schicken wir statt 20k Raw-Chat-Tokens jetzt ~2-3k Evidence-JSON + 26 kuratierte Moments an Haiku 4.5. Das ist schon ~8× billiger. Aber:

- **Der Evidence-Blob ist redundant.** Wir schicken `messagesPct` **und** die absoluten Zahlen. Wir schicken `medianReplyMinutes` **und** die buckets. Viele Prozent-Werte stehen auf drei Nachkommastellen, obwohl niemand den Unterschied zwischen 0.732 und 0.73 interpretieren kann.
- **Die Moments sind zu viele und zu lang.** 26 Moments à ≤220 Zeichen = ~1100 Tokens. Davon sind 60% Dubletten derselben Kategorie (z.B. 5 late-night-Moments hintereinander).
- **Das System-Prompt ist immer noch ~500 Tokens mit viel Metasprache** (mehrere Wiederholungen von "concrete not categorical", "no coach talk" etc.).
- **Der Voice-Anker fehlt.** Das Modell weiß nicht, dass es trocken-ironisch klingen soll. Also fällt es auf neutral-klinisch zurück.
- **Das Output-Schema** zwingt Haiku zu ~40 Prosa-Feldern mit je "2-3 Sätze" → ~3000 Output-Tokens. Nahe am max_tokens-Limit, deshalb der Crash.

Der Hebel liegt jetzt nicht mehr beim Input-Volumen, sondern bei **Input-Qualität** und **Output-Disziplin**.

---

## 2. Die Efficiency-Frontier verstehen

### Was das Modell braucht, um gute Prosa zu schreiben

Empirisch (Claude-Verhalten in Tool-Use-Settings):

1. **Zahlen, die Asymmetrie zeigen.** Ein Delta ist interpretierbar, zwei Absolutwerte müssen erst verglichen werden. Haiku macht das schlechter als Sonnet.
2. **Konkrete Sprach-Fragmente.** 5-10 echte Formulierungen schlagen 100 Durchschnittswerte. "hedges_topExamples: ['nur so ne idee', 'vielleicht', 'weiß nicht ob']" ist 20× mehr wert als "hedgesRatio: 0.31".
3. **Zeitliche Marker.** Ein Kipppunkt-Datum ist wertvoller als die ganze weekly-Kurve.
4. **Reason-Tags an Moments.** Das Wort "apology" an einem Moment spart dem Modell die Klassifikation.

### Was das Modell nicht braucht

1. Redundante Darstellungen derselben Metrik.
2. Hohe Zahlengenauigkeit (3 Nachkommastellen).
3. Aufzählung aller Wochen — die Form reicht.
4. Erklärende Metasprache im Prompt ("concrete not categorical" + "no coach talk" + "no framework names" sagen alle dieselbe Sache).
5. Wiederholte Safety-Anweisungen.

### Die Null-Regel

**Jeder Prompt-Token muss eine Aussage treffen, die der Schema-Struktur NICHT inhärent ist.** Wenn das Schema ein Enum `['positiv', 'negativ', 'unklar']` hat, muss der Prompt das nicht nochmal erklären.

---

## 3. Input-Layer — was genau reinkommt

### 3.1 Evidence Packet v2 — Slim Edition

**Weg mit:**
- `totals.messages/words/emojis` — steht implizit in `people[x].messagesPct + totals` nicht nötig
- `span.durationDays` — das Modell bekommt `firstDate` und `lastDate`
- `rhythm.mostActiveHour` als Zahl — menschliche Hour-Labels sind interpretierbarer
- `arc` mit 8 Buckets — 3 Buckets reichen (Start, Mitte, Ende)
- `people[x].replyUnder5m/replyOver1d` — die Distribution-Buckets sind zu feinkörnig
- `asymmetry.initiationDrift.firstHalfShare/secondHalfShare` — nur der Swap-Boolean und wer in welcher Hälfte führt

**Neu rein:**
- `people[x].signatureWords: string[3-5]` — die häufigsten nicht-trivialen Wörter pro Person (lokal aus Frequenzanalyse, stop-words gefiltert)
- `people[x].signatureOpeners: string[2-3]` — typische Satzanfänge
- `people[x].toneHint` — lokal abgeleitet: 'questioning' | 'declarative' | 'hedging' | 'playful' | 'terse' | 'verbose'
- `asymmetry.note` — vorausberechneter One-Liner: "A sends 73%, replies 4× faster, initiates 84% of pauses. B runs the clock."
- `flags[]` — lokal erkannte Red-Flag-Trigger: `'one_sided_apologies' | 'night_only_contact' | 'silent_phases_grow' | 'burst_asymmetry' | 'none'`

**Ziel-Größe:** ~400-600 Tokens statt aktuell 1000-1500.

### 3.2 Curated Moments v2 — Less is More

Von 26 auf **12 Moments** reduzieren, nach Reason-Diversität statt Score:

| Reason | Anzahl | Max-Länge |
|--------|--------|-----------|
| apology | 0-2 | 120 chars |
| hedge_cluster | 0-2 | 120 chars |
| late_night | 1-2 | 100 chars |
| burst_start | 0-2 | 80 chars |
| post_silence + pre_silence (paarweise) | 0-2 pairs | 100 chars |
| drift_window | 0-2 | 100 chars |
| long_message | 0-1 | 180 chars (der eine lange Monolog-Moment) |
| peak_day | 0-1 | 80 chars |

**Cap pro Kategorie verhindert Haiku-Tunnel-Vision auf einen Reason-Typ.**

Format: `#N ts author reason | text` → ~70-150 Tokens pro Moment.
12 Moments × 100 Tokens = **~1200 Tokens**.

### 3.3 Gesamtvolumen Input

| Komponente | Tokens |
|------------|--------|
| System-Prompt (neu, Kap. 4) | ~300 |
| Tool Schema (gekappt, Kap. 6) | ~2500 |
| Evidence Packet v2 | ~500 |
| Moments (12) | ~1200 |
| **Summe Input pro Call** | **~4500** |

Schema-Tokens sind gecacht (Kap. 7) → erst-Call full price, zweiter Call nur ~500 Tokens "frisch".

---

## 4. Prompt-Layer — Minimum System Prompt mit Voice-Anchor

### 4.1 Warum das Prompt radikal kleiner werden kann

Das aktuelle Prompt wiederholt 3× dieselbe Regel:
- "Concrete, not categorical"
- "No labels, observed behavior"  
- "Describe pattern in plain language"

Das Modell lernt aus einem Beispiel schneller als aus drei Meta-Anweisungen. **Zwei Voice-Beispiele ersetzen 80% der Metasprache.**

### 4.2 Neuer System-Prompt (Profile) — Target 250 Tokens

```
You read an Evidence Packet (pre-computed stats + 12 tagged moments) and write
a portrait of one specific person.

Voice: observer with a dry eyebrow. Specific. Never nice when nice would lie.
No framework names. No coach talk. No "tends to", "perhaps". If thin, say thin.

Tone anchors — match this, not clinical reports:
✓ "They apologize first every time. That isn't politeness, it's a habit."
✓ "Three minutes to reply. Always. Even when 'no' would have been shorter."
✗ "This person exhibits tendencies toward indirect communication."

Every claim anchors to a packet field (e.g. people.PersonA.hedgesRatio) or a
moment index (#7). If the anchor is missing, skip the claim.

Safety: abuse, suicidal ideation, control, violence → name it, point to help.

Output only via submit_profile tool. English.
```

~280 Tokens. Jedes Wort zieht.

### 4.3 Relationship System-Prompt — Target 300 Tokens

Same framework, tone-anchors adapted:

```
You read an Evidence Packet about a two-person chat. Produce a structured read
of the *dynamic* — the space between, not the individuals.

Voice: dry observer, never performative. Tabloid-honest, never cruel.
Tone anchors:
✓ "One of them does the work. Both of them pretend that's normal."
✓ "The repair attempts are all on her side. His ratio is zero."
✗ "Asymmetric emotional labor dynamics are evident."

Every claim anchors to a packet field or a moment index (#7). Paraphrases only,
never verbatim — 'zitat' fields get ≤15-word English paraphrases.

Safety: gaslighting, control, contempt, threats, stalking, violence →
safety_flag.aktiv=true, clear description, point to help (US: 1-800-799-7233
or 988; DE: 116 016 or 0800 111 0 111).

Never psychologize individuals — the subject is the interaction.
Use the provided pseudonyms exactly.

Output only via submit_relationship tool. English.
```

~320 Tokens.

---

## 5. Schema-Leverage — let the enums do the theory

### 5.1 Profile schema — keep, tighten descriptions

The profile schema is relatively tight. Main tweaks:

- Every `interpretation` field description gets: *"One observation in ≤20 words. No framework name."*
- Every `evidenz` array gets: *"1-2 citations. Format: `people.X.field=val` or `#N`."*
- Remove `nuance` field on berne (never really used well) or make it strictly optional

### 5.2 Relationship schema — cut redundancy

**Current:** 10 sections × ~4 prose fields = 40 prose fields × ~2 sentences = ~800-1000 words of output = ~1500-2000 output tokens.

**Too much.** Three redundancies to kill:

1. **Every section has `interpretation`** — often paraphrases the section data. Cut from: kopplung, bids, repair, mentalisierung, meta_kommunikation, berne. Keep only on: machtstruktur, bindungsdyade, konflikt_signatur, unausgesprochene_regeln (where it adds real synthesis).
2. **Every section has `zitate`** — only keep on sections where quotes are essential: machtstruktur, bids (beispiele instead), konflikt_signatur, unausgesprochene_regeln.
3. **The `interpretation` on `unausgesprochene_regeln`** — the rules themselves are the interpretation. Drop.

Result: output sinks from ~2000 to ~1200 tokens. Schema still complete. **max_tokens 6144 with 2× safety margin.**

### 5.3 Citation-in-schema

Add a `zitat_ref` field structure where applicable:

```json
"zitat_ref": {
  "type": "object",
  "properties": {
    "evidence_path": { "type": "string", "description": "e.g. 'people.PersonA.hedgesRatio' or 'asymmetry.messageShareDelta'" },
    "moment_index": { "type": ["integer", "null"], "description": "index from notableMoments" }
  }
}
```

Forces the model to bind claims to concrete evidence. The prompt says "anchor every claim" — the schema enforces it.

---

## 6. Voice — der ironisch-trockene Receipts-Ton

### 6.1 Tone-Pillars

- **Direkt.** "You reply fast. They don't." Nicht "There is a pattern of differential response latency."
- **Konkret.** Immer eine Zahl oder ein Moment. "73%", "#7", "3am on Sundays". Nie "often", "sometimes".
- **Dry smirk.** Ein Satz pro Sektion der sticht. "Three minutes to reply. Always. Even when 'no' was the answer."
- **Kein Pop-Psych.** Keine "queen energy", keine "boundaries-speech", kein "you deserve better".
- **Kein Mitleid.** Beobachten. Nicht beruhigen, nicht aufrütteln.

### 6.2 Do/Don't-Pairs für den Prompt

Haiku lernt aus 2-3 gut gewählten Beispielen besser als aus 500 Metas. Die Voice-Anchor-Sektion im System-Prompt macht das.

Weitere Kandidaten für künftige Iteration:
- ✓ "They start every chat. You finish it. Both of you know it."
- ✓ "The sorries landed before any actual wrong. That's a reflex, not a response."
- ✗ "Communication patterns indicate a caregiver-seeker dynamic."

### 6.3 Was wenn Haiku den Ton nicht trifft?

Fallback: Beim Post-Processing checken, ob Output bestimmte Coach-Wörter enthält (self-love, energy, journey, authentic, boundary, queen, healing, growth). Wenn > 1 → retry mit stärkerem Prompt oder Sonnet-Escalation.

---

## 7. Prompt Caching — praktisch nutzen

Anthropic supports `cache_control: {"type": "ephemeral"}` on system prompt blocks + tool schemas. 5-min TTL.

**Setup:**

```ts
system: [
  {
    type: 'text',
    text: PROFILE_SYSTEM_PROMPT,
    cache_control: { type: 'ephemeral' },
  },
],
tools: [
  {
    name: PROFILE_TOOL_SCHEMA.name,
    description: PROFILE_TOOL_SCHEMA.description,
    input_schema: PROFILE_TOOL_SCHEMA.input_schema,
    // cache_control kein offizielles tool-feld — wenn ja, mit; sonst System-Block strategisch erweitern um Schema-Prose
  },
]
```

**Effect:** First call of session pays full input. Calls within 5 min get 90% off on cached blocks. Since both modules run in succession, the profile call warms the cache, the relationship call saves ~75% on the system portion.

Caveat: profile and relationship have DIFFERENT system prompts. Either unify the system prompt and branch behavior via user message, or accept cache miss between modules but benefit within same module on retries.

**Decision:** separate prompts per module; cache enabled so any RETRY of same module is nearly free.

---

## 8. Proposed Pipeline — alles zusammen

### 8.1 Token budget per call

| Block | Tokens (fresh) | Tokens (cached) |
|-------|----------------|-----------------|
| System prompt | 280 | 28 |
| Tool schema (profile: ~1500, rel: ~2500) | 1500-2500 | 150-250 |
| Evidence packet v2 | 500 | — (fresh each time) |
| Moments (12) | 1200 | — |
| **Input total — profile** | **~3480** | **~1878** |
| **Input total — relationship** | **~4480** | **~2178** |
| Output budget | 2000 | 2000 |

### 8.2 Cost projection

**Haiku 4.5** (~$1 in / $5 out per MTok):

| Scenario | Input $ | Output $ | Total |
|----------|---------|----------|-------|
| Profile (fresh) | $0.0035 | $0.010 | **~1.4 ct** |
| Relationship (cached after profile) | $0.0022 | $0.010 | **~1.2 ct** |
| Both per chat | | | **~2.6 ct** |

**Sonnet 4.6** (~$3 in / $15 out per MTok), as quality fallback:

| Scenario | Input $ | Output $ | Total |
|----------|---------|----------|-------|
| Profile (fresh) | $0.010 | $0.030 | **~4.0 ct** |
| Relationship (cached) | $0.006 | $0.030 | **~3.6 ct** |
| Both per chat | | | **~7.6 ct** |

Alle Varianten <10 ct, comfortable margin to the 30 ct ceiling.

### 8.3 Quality bets

- **Stronger voice** (tone anchors) → less generic prose, less coach-speak
- **Signature words + reason-tagged moments** → grounding in actual language
- **Citation-in-schema** (`evidence_path`, `moment_index`) → auditable claims
- **Fewer forced prose fields** → more effort per field → deeper per-section output

---

## 9. Implementation checklist

In this order:

### 9.1 Evidence v2 (`src/ai/evidence.ts`)

- [ ] Add `signatureWords(messages): string[]` — pro Person, top-5 Wörter nach TF-IDF-ish Scoring, stopword-gefiltert (deutsch + englisch)
- [ ] Add `signatureOpeners(messages): string[]` — häufige 2-3-Gramm-Satzanfänge pro Person
- [ ] Add `toneHint(person): 'questioning' | 'declarative' | 'hedging' | 'playful' | 'terse' | 'verbose'` — abgeleitet aus questionsRatio, hedgesRatio, emojiPerMsg, avgWords
- [ ] Add `asymmetryNote: string` — vorausberechneter One-Liner
- [ ] Add `flags: Flag[]` — lokale Red-Flag-Heuristiken
- [ ] Strip: totals (keep only messages), span.durationDays, rhythm.mostActiveHour as number, people.replyBuckets, arc → 3-bucket version, asymmetry.initiationDrift.firstHalfShare/secondHalfShare (nur swap + leaders)
- [ ] Round all percents to 2 decimals

### 9.2 Curated sample v2

- [ ] Reduce MAX_NOTABLE from 26 to 12
- [ ] Enforce reason-diversity caps per category
- [ ] Shorten MAX_TEXT_CHARS from 220 to 140 (180 only for `long_message` reason)
- [ ] Output format: `#{idx} {HH:MM} {author} {reason} | {text}`

### 9.3 Prompts v2

- [ ] Rewrite PROFILE_SYSTEM_PROMPT with voice anchors, ~280 tokens
- [ ] Rewrite RELATIONSHIP_SYSTEM_PROMPT with voice anchors, ~320 tokens
- [ ] Update buildProfileUserMessage / buildRelationshipUserMessage — drop explicit citation instruction (schema enforces)

### 9.4 Schema v2

- [ ] Remove `interpretation` from: kopplung, bids, repair, mentalisierung, meta_kommunikation, berne
- [ ] Remove `zitate` from: kopplung, repair, mentalisierung, meta_kommunikation
- [ ] Make `nuance` on profile.berne strictly null-default
- [ ] Add `zitat_ref: { evidence_path, moment_index }` to: machtstruktur, konflikt_signatur, unausgesprochene_regeln.regeln[]

### 9.5 Prompt caching

- [ ] Wrap system prompt in `{type: 'text', text: ..., cache_control: {type: 'ephemeral'}}`
- [ ] Test that cache hits happen (response includes cache stats)

### 9.6 Output guard

- [ ] Post-process check: forbidden word list (self-love, energy, journey, authentic, boundary, queen, healing, growth, vibes)
- [ ] If > 1 hit: log warning, optionally retry once

### 9.7 Evaluation

Run 3 real chats through both Haiku and Sonnet, side-by-side:
- [ ] Voice: does each section have at least one line with a bite?
- [ ] Anchors: does every prose field cite a valid evidence path or moment?
- [ ] Hallucination: does Haiku invent data that isn't in the packet?
- [ ] Completeness: all required schema fields filled?
- [ ] Safety: on a chat with red flags, does `safety_flag.aktiv` fire correctly?

If Haiku passes all — keep as default. If voice or completeness wobble, switch to Sonnet for relationship, keep Haiku for profile.

---

## 10. What this buys us

- **Input: ~40% smaller** than current rework (~3500 vs ~5500 tokens fresh)
- **Output: ~40% smaller** too (~1200 vs ~2000 tokens)
- **Voice: punchier** thanks to anchors + less metaprompt
- **Cost: ~1.3 ct per module, ~2.6 ct per chat** — 10× margin under budget
- **Audibility: every claim cites a field or moment** — user can check the work

---

## 11. Open questions

- Signature words on German text — stopword list quality matters. Use `stopwords-de` library or inline list?
- `evidence_path` as string: risk of typos by the model. Validate against evidence keys post-response.
- Tool schemas for `cache_control` — Anthropic's API currently only caches system blocks officially. May need to append schema-prose into the system block to cache it. Verify.
- Do we keep the current fixture JSONs compatible with the new schema, or regenerate?

---

*Research V1. Feed this into the next implementation pass.*
