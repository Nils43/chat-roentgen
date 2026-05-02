# Analyses — Token-Efficiency Deep Research

> Goal: **maximum sharp output with minimum input mass.** Every token must carry interpretive leverage. Voice: dry, observational Receipts-Ton.

---

## 1. The honest baseline

After the first rework round (`analyses-rework.md`) we now ship ~2-3k Evidence-JSON + 26 curated moments to Haiku 4.5 instead of 20k raw chat tokens. That's already ~8× cheaper. But:

- **The evidence blob is redundant.** We send `messagesPct` **and** the absolute counts. We send `medianReplyMinutes` **and** the buckets. Many percentage values come with three decimal places, even though no one can interpret the difference between 0.732 and 0.73.
- **There are too many moments and they're too long.** 26 moments at ≤220 chars = ~1100 tokens. 60% of those are duplicates of the same category (e.g. 5 late-night moments back-to-back).
- **The system prompt is still ~500 tokens with a lot of metaspeak** (multiple repetitions of "concrete not categorical", "no coach talk" etc.).
- **The voice anchor is missing.** The model doesn't know it should sound dry and ironic. So it falls back to neutral-clinical.
- **The output schema** forces Haiku into ~40 prose fields each with "2-3 sentences" → ~3000 output tokens. Close to the max_tokens limit, hence the crash.

The lever is no longer input volume but **input quality** and **output discipline**.

---

## 2. Understanding the efficiency frontier

### What the model needs to write good prose

Empirically (Claude behavior in tool-use settings):

1. **Numbers that show asymmetry.** A delta is interpretable; two absolute values have to be compared first. Haiku does this worse than Sonnet.
2. **Concrete language fragments.** 5-10 real phrasings beat 100 averages. "hedges_topExamples: ['nur so ne idee', 'vielleicht', 'weiß nicht ob']" is 20× more valuable than "hedgesRatio: 0.31".
3. **Temporal markers.** A tipping-point date is more valuable than the entire weekly curve.
4. **Reason tags on moments.** The word "apology" on a moment saves the model the classification step.

### What the model doesn't need

1. Redundant representations of the same metric.
2. High numerical precision (3 decimal places).
3. Enumeration of every week — the shape is enough.
4. Explanatory metaspeak in the prompt ("concrete not categorical" + "no coach talk" + "no framework names" all say the same thing).
5. Repeated safety instructions.

### The zero rule

**Every prompt token must make a statement that is NOT inherent to the schema structure.** If the schema has an enum `['positiv', 'negativ', 'unklar']`, the prompt doesn't need to explain it again.

---

## 3. Input layer — what exactly goes in

### 3.1 Evidence Packet v2 — Slim Edition

**Cut:**
- `totals.messages/words/emojis` — implicit in `people[x].messagesPct + totals`, not needed
- `span.durationDays` — the model gets `firstDate` and `lastDate`
- `rhythm.mostActiveHour` as a number — human hour labels are more interpretable
- `arc` with 8 buckets — 3 buckets are enough (start, middle, end)
- `people[x].replyUnder5m/replyOver1d` — distribution buckets are too fine-grained
- `asymmetry.initiationDrift.firstHalfShare/secondHalfShare` — only the swap boolean and who leads in which half

**Add:**
- `people[x].signatureWords: string[3-5]` — the most frequent non-trivial words per person (locally derived from frequency analysis, stopwords filtered)
- `people[x].signatureOpeners: string[2-3]` — typical sentence openers
- `people[x].toneHint` — locally derived: 'questioning' | 'declarative' | 'hedging' | 'playful' | 'terse' | 'verbose'
- `asymmetry.note` — pre-computed one-liner: "A sends 73%, replies 4× faster, initiates 84% of pauses. B runs the clock."
- `flags[]` — locally detected red-flag triggers: `'one_sided_apologies' | 'night_only_contact' | 'silent_phases_grow' | 'burst_asymmetry' | 'none'`

**Target size:** ~400-600 tokens vs the current 1000-1500.

### 3.2 Curated Moments v2 — Less is More

Drop from 26 to **12 moments**, prioritizing reason diversity over score:

| Reason | Count | Max length |
|--------|--------|-----------|
| apology | 0-2 | 120 chars |
| hedge_cluster | 0-2 | 120 chars |
| late_night | 1-2 | 100 chars |
| burst_start | 0-2 | 80 chars |
| post_silence + pre_silence (paired) | 0-2 pairs | 100 chars |
| drift_window | 0-2 | 100 chars |
| long_message | 0-1 | 180 chars (the one long monologue moment) |
| peak_day | 0-1 | 80 chars |

**A cap per category prevents Haiku tunnel-vision on one reason type.**

Format: `#N ts author reason | text` → ~70-150 tokens per moment.
12 moments × 100 tokens = **~1200 tokens**.

### 3.3 Total input volume

| Component | Tokens |
|------------|--------|
| System prompt (new, ch. 4) | ~300 |
| Tool schema (trimmed, ch. 6) | ~2500 |
| Evidence Packet v2 | ~500 |
| Moments (12) | ~1200 |
| **Input sum per call** | **~4500** |

Schema tokens are cached (ch. 7) → first call full price, second call only ~500 "fresh" tokens.

---

## 4. Prompt layer — minimum system prompt with voice anchor

### 4.1 Why the prompt can shrink radically

The current prompt repeats the same rule 3×:
- "Concrete, not categorical"
- "No labels, observed behavior"  
- "Describe pattern in plain language"

The model learns faster from one example than from three meta-instructions. **Two voice examples replace 80% of the metaspeak.**

### 4.2 New system prompt (Profile) — target 250 tokens

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

~280 tokens. Every word pulls weight.

### 4.3 Relationship system prompt — target 300 tokens

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

~320 tokens.

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

## 6. Voice — the dry, ironic Receipts-Ton

### 6.1 Tone pillars

- **Direct.** "You reply fast. They don't." Not "There is a pattern of differential response latency."
- **Concrete.** Always a number or a moment. "73%", "#7", "3am on Sundays". Never "often", "sometimes".
- **Dry smirk.** One sentence per section that bites. "Three minutes to reply. Always. Even when 'no' was the answer."
- **No pop-psych.** No "queen energy", no "boundaries-speech", no "you deserve better".
- **No pity.** Observe. Don't soothe, don't rally.

### 6.2 Do/Don't pairs for the prompt

Haiku learns better from 2-3 well-chosen examples than from 500 metas. The voice-anchor section in the system prompt does this work.

Further candidates for future iteration:
- ✓ "They start every chat. You finish it. Both of you know it."
- ✓ "The sorries landed before any actual wrong. That's a reflex, not a response."
- ✗ "Communication patterns indicate a caregiver-seeker dynamic."

### 6.3 What if Haiku misses the tone?

Fallback: in post-processing, check whether the output contains certain coach words (self-love, energy, journey, authentic, boundary, queen, healing, growth). If > 1 → retry with a stronger prompt or escalate to Sonnet.

---

## 7. Prompt caching — putting it to work

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

## 8. Proposed pipeline — putting it all together

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

All variants <10 ct, comfortable margin to the 30 ct ceiling.

### 8.3 Quality bets

- **Stronger voice** (tone anchors) → less generic prose, less coach-speak
- **Signature words + reason-tagged moments** → grounding in actual language
- **Citation-in-schema** (`evidence_path`, `moment_index`) → auditable claims
- **Fewer forced prose fields** → more effort per field → deeper per-section output

---

## 9. Implementation checklist

In this order:

### 9.1 Evidence v2 (`src/ai/evidence.ts`)

- [ ] Add `signatureWords(messages): string[]` — per person, top-5 words by TF-IDF-ish scoring, stopword-filtered (German + English)
- [ ] Add `signatureOpeners(messages): string[]` — frequent 2-3-gram sentence openers per person
- [ ] Add `toneHint(person): 'questioning' | 'declarative' | 'hedging' | 'playful' | 'terse' | 'verbose'` — derived from questionsRatio, hedgesRatio, emojiPerMsg, avgWords
- [ ] Add `asymmetryNote: string` — pre-computed one-liner
- [ ] Add `flags: Flag[]` — local red-flag heuristics
- [ ] Strip: totals (keep only messages), span.durationDays, rhythm.mostActiveHour as number, people.replyBuckets, arc → 3-bucket version, asymmetry.initiationDrift.firstHalfShare/secondHalfShare (only swap + leaders)
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
