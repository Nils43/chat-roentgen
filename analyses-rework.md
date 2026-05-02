# Analyses Rework Plan

> Goal: tightly couple the two analyses (Personal + Relationship) with the Hard Facts numbers, **max 30 ct per request**, output quality maxed.

---

## 1. Where we stand today

**What currently happens during an analysis:**

- A "Smart Session Sample" is built locally (~500 messages, target tokens ~20k)
- The whole chat slice is packed into the user prompt as plain text
- The system prompt is a long theoretical essay (Horney, Berne, Bowlby, Adler, Goffman for Profile; Gottman, Fonagy, Stern, Watzlawick, Hazan, Berne for Relationship)
- Model: `claude-sonnet-4-6`, tool schema enforces structured output
- Claude partly re-counts things we **already calculated locally in HardFacts**

**Token and cost estimate per call (Sonnet 4.6, ~$3/MTok in, ~$15/MTok out):**

| Module | Input | Output | Cost |
|------|-------|--------|--------|
| Personal (1 user, combined pass) | ~22k | ~3k | **~12 ct** |
| Relationship (1 pass, more schema) | ~22k | ~4k | **~13 ct** |
| Total per chat | | | **~25 ct** |

Right at the 30-ct ceiling. One bigger chat and it tips over.

**Three problems:**

1. **Duplicate work** — Claude re-computes numbers we already have exactly (shares, reply times, initiation, hedges, emojis, activity). Wasted tokens AND worse consistency (AI can easily count differently).
2. **Fuzzy anchoring** — the AI output doesn't reference the Hard Facts directly. The user sees 73% on page 1 and reads "who gives more …" on page 2 with no clear callback.
3. **Prompt overshoot** — the system prompt lists frameworks that are already structurally encoded in the tool schema. Redundancy.

---

## 2. Target picture

**The AI model interprets. It doesn't compute.**

The chat goes in only as curated context — the math arrives pre-fed as an **Evidence Packet** (JSON). Claude quotes those numbers verbatim in the output, so the AI analysis docks visually and substantively into the Hard Facts.

**Result in the UI:**

> *"You send 73% of the messages (Hard Fact 01). That pattern reads as over-investment — you keep the room warm. The moment it shifts: usually after Person B gets short (seen in burst #3 on 14. March)."*

The analysis is **evidence-based** — every claim cites a local number.

---

## 3. Concrete rework

### 3.1 Build the Evidence Packet (local, no API call)

New module `src/ai/evidence.ts`. Takes `HardFacts` + `ParsedChat`, returns a compact JSON object:

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

That's **all Claude needs**. Roughly **800–1500 tokens** instead of 20,000.

### 3.2 Rework the sampling

The current `sampling.ts` stays as a fallback source for `notableMoments`, but **only curated**:

- First message of every burst
- Messages at unusual times (> 23:00 < 05:00)
- Messages **before** and **after** long silences
- Messages with dense hedge-word clusters
- Apologies ("sorry", "entschuldigung", "my bad", etc. via regex)
- Peak-day messages
- Tipping-point windows (±3 days around the `initiationDrift` swap)

**Cap: 30 messages**, each truncated to 200 characters. Yields ~3–4k tokens.

### 3.3 Shrink the system prompts

New prompts, radically slimmed down:

**Profile (Personal)** — target ~600 tokens:
```
Du bist ein scharfer Beobachter. Du bekommst vorab-berechnete Zahlen über eine
Person in einem Chat und kuratierte Beispielnachrichten. Deine Aufgabe: diese
Fakten interpretieren, nicht neu berechnen.

Stil: kurze Sätze, konkret, keine Framework-Namen, keine Coach-Phrasen.
Jede Aussage muss sich auf eine Zahl aus dem Evidence Packet stützen oder auf
eine konkrete Beispielnachricht (zitiert mit Index).

Output: strikt via submit_profile tool.
```
Rest of the logic lives in the schema.

**Relationship** — same idea, target ~800 tokens.

Frameworks stay **as enums** in the tool schema (internal structure), drop out of the prose instruction.

### 3.4 Model choice: Haiku 4.5 as the default

| Model | Input $/MTok | Output $/MTok | 5k in + 2k out |
|-------|--------------|---------------|----------------|
| Haiku 4.5 | ~$1 | ~$5 | **~1.5 ct** |
| Sonnet 4.6 | ~$3 | ~$15 | ~4.5 ct |
| Opus 4.7 | ~$15 | ~$75 | ~23 ct |

Haiku 4.5 is the **default**. The structured input (Evidence Packet) compensates for the smaller model size, because Claude no longer has to "extract" anything — it interprets data that's already prepared.

Optional: ENV var `VITE_ROENTGEN_MODEL=sonnet-4-6` for premium deploys. Costs ~5 ct then instead of ~1.5 — well under budget.

### 3.5 Enable prompt caching

Mark system prompt + tool schema with `cache_control: { type: "ephemeral" }`. Anthropic keeps the cache for 5 minutes.

**Savings:** with two analyses per chat (Personal + Relationship, both within < 5 min) the second call is 90% cheaper on the cached part. Saves another ~30% of total cost.

---

## 4. Target cost calculation

After rework, per chat:

| Module | Model | Input | Output | Cost |
|-------|-------|-------|--------|--------|
| Evidence build | — (local) | — | — | **0 ct** |
| Personal (Haiku 4.5) | Haiku | 5k | 2k | **~1.5 ct** |
| Relationship (Haiku 4.5, cached) | Haiku | 5k | 3k | **~1.8 ct** |
| **Total per chat** | | | | **~3.3 ct** |

**Margin against the 30-ct target:** ~9× headroom. Even with chat-size spikes, retries, or a later upgrade to Sonnet, you stay under budget.

---

## 5. Quality checks

What to evaluate after the rework (on 3–5 real chats):

1. **Consistency:** does the output reference the exact numbers from the Hard Facts? No number drift.
2. **Depth:** Haiku 4.5 must not go generic on interpretation. Spot-check: "How specific are the patterns described?"
3. **Safety:** on red patterns (emotional abuse, threats) the `safety_flag` must fire correctly — Haiku needs testing here.
4. **Framework leakage:** output must contain no theorist names (prompt forbids it, but verify).
5. **Token budget:** `approxTokens` in the PrepareResult matches the actual cost.

If Haiku slips on point 2 → configure Sonnet 4.6 as fallback, still under budget.

---

## 6. Rework order

1. **Evidence module** built (`src/ai/evidence.ts`) — pure function `buildEvidence(facts, chat, selfPerson) → EvidencePacket`. With unit test.
2. **Curated sampling** — new function `curatedMoments(facts, chat) → Message[]` with the 30-moment heuristics.
3. **Rewrite prompts** — `src/ai/prompts.ts`:
   - `PROFILE_SYSTEM_PROMPT` shrink (~600 tokens, clear evidence-first instruction)
   - `RELATIONSHIP_SYSTEM_PROMPT` shrink (~800 tokens)
   - Keep tool schemas, optionally link them in evidence fields ("zitiere Evidence.hedges.ratio")
4. **Adjust analyzer calls** — `profile.ts` and `relationship.ts`:
   - Switch model to `claude-haiku-4-5`
   - User message: JSON Evidence Packet + 30 curated messages
   - `cache_control` on system prompt
5. **UI tweak** (optional V2) — the analysis views can now point at the evidence references in the output ("Fakt 03: 73% Share") to make the link to the Hard Facts visible.
6. **Evaluation** on 3–5 real chats, side-by-side with the current solution. If quality is equal or better: merge. Otherwise flip Haiku → Sonnet (still in budget).

---

## 7. Open questions

- **Haiku vs. Sonnet on German chats:** Haiku has historically had small gaps on non-English nuance. Evaluation needed.
- **German vs. English in the output:** currently output is English (prompt-forced). Keep it?
- **Fallback if evidence drops out:** if HardFacts hits an edge case (empty heatmap, only one person speaks), evidence has to degrade gracefully.
- **Post-purchase tone:** should the user see a loading state after paying that signals "tea is reading your receipts" — even when the call returns in 2s?

---

*Plan V1. Living document until shipped.*
