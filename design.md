# Design System — Receipts Edition

> Binding for all UI decisions. Supersedes all earlier visual guidance from `tea_brand_reference.md` and `chat-roentgen-konzept.md`.
> If the code and this document contradict each other, the document gets adjusted, not the code — this design state is the ground truth.

---

## 1. What it is

A tabloid dossier for your own life. Forensic-gossip aesthetic: bubblegum-pink background, black ink, yellow accent, hard shadows without blur, slightly crooked tacked-up cards, loud display headlines. A chat report that looks like an evidence box in a true-crime podcast.

**Self-description in the header:** *"forensic gossip os · vol. iii"* — that's not irony, that's the genre.

**Vibe references:**
- Zine and fanzine layouts, photocopied and stapled
- Tabloid covers with huge serif caps
- Detective pinboard with photos, markers, and notes
- Case files with exhibit labels and office stamps
- Spy vs Spy, lie+truth, 70s crime jacket

**What it isn't:**
- Not a SaaS dashboard
- Not wellness-app pastel
- Not minimalist editorial
- Not Paper/Ink/Fraunces serif (that was an old direction — replaced)
- No dark mode
- No Material Design, no iOS style

---

## 2. Color palette

| Name | Hex | Role |
|------|-----|-------|
| **pink** | `#FF90BB` | Page background. Bubblegum, not pastel. Always visible as body BG. |
| **ink / black** | `#0A0A0A` | Text, borders, hard shadows, buttons, stamps. The structural principle. |
| **white** | `#FFFFFF` | Card surface, "paper". Only on cards, never as page BG. |
| **yellow** | `#FFE234` | Primary accent color: stickers, buttons, "done" states, completion chips. |
| **acid** | `#ECFD38` | Highlighter yellow (marker stroke). Sharper, punchier. Only for `.mark`. |
| **sky** | `#7CC9FF` | Rare — extra person color in group chats. |
| **purple** | `#C084FF` | Rare — extra person color in group chats. |

**Ink shades for text:**
- `ink` (`#0A0A0A`) — primary text
- `ink/72` (muted) — secondary text
- `ink/48` (faint) — metadata
- `ink/40` or `/60` — labels, hints

**Person colors:**
- **Person A** — solid black (`#0A0A0A`) + variants (dim, deep, glow)
- **Person B** — yellow (`#FFE234`) + variants — always needs black context (border or BG) for legibility
- Person C, D — sky, orange, purple (group chats only)

**Rules:**
- Yellow is **accent**, not decoration. One element per screen dominates in yellow (sticker OR button OR a marked word) — never all at once.
- Acid yellow only as marker highlight over a word. Never as BG for larger surfaces.
- Shadows are always `#0A0A0A`, never semi-transparent, never blurred.

---

## 3. Typography

Three typefaces, strict roles:

| Typeface | Role | Sizes | Source |
|---------|-------|--------|--------|
| **Bebas Neue** | Display — huge hero caps, large metric numbers | `text-[14vw]` to `text-[20vw]` for hero, 3xl–6xl for module titles | Google Fonts |
| **Courier Prime** | Everything else — body, UI labels, gossip-italic voice, buttons, stickers | 10–18px UI, 16–20px body | Google Fonts |
| **Courier Prime Italic** | Voice layer — when the product "speaks" | 16–20px | Google Fonts |

**No** Fraunces, no Inter, no JetBrains Mono, no Instrument Serif. The reduction to two families is a feature — it produces the fanzine consistency.

**Typography roles in classes:**

- `.metric-num` — Bebas Neue, `letter-spacing: 0.01em`, `line-height: 0.9`. For the big numbers.
- `.font-serif` → Bebas Neue (Tailwind alias). For hero caps like "LEAKS", "RECEIPTS", "PROFILES".
- `.label-mono` — Courier Prime bold, 11px, `letter-spacing: 0.16em`, uppercase. For meta labels above sections and tiles.
- `.serif-body` — Courier Prime **italic**, normal size, for prose text. This is the "gossip typewriter voice", despite the `serif-` in the name.
- `.pill-pop` — Courier Prime 10px uppercase on black BG — for pills with pulsing dot.
- `.sticker` — Bebas Neue 14px, yellow BG — for the cursive "✦ THAT'S YOU" element.
- `.btn-pop` — Bebas Neue 18px, yellow BG, hard black border + 3px shadow.
- `.exhibit-label` — Courier Prime 10px uppercase, white on black, absolutely positioned as a tab top-left on cards, rotated `-2deg`.

**Hero formula (page-bleed):**
```
<div class="label-mono">intel · alice & bob · as of 04.18.2026</div>
<h1 class="font-serif text-[20vw] md:text-[180px] leading-[0.85] tracking-[-0.01em]">
  LEAKS
</h1>
```
A single all-caps word, huge, per main screen. **LEAKS** (Library), **RECEIPTS** (Hard Facts), **PROFILES** (Profiles), etc. This is the most important typographic gesture of the app.

---

## 4. Layout principles

**Grid:** `max-w-6xl mx-auto px-4 md:px-6`. Tight, dense layouts — no editorial whitespace.

**Page rhythm (Hard Facts standard):**

```
[Hero bleed: caps word + date label]
   ↓
[Quote box with EXHIBIT-0 label — the premise paragraph]
   ↓
[4-tile grid — topline numbers]
   ↓
[Whisper — small italic Courier paragraph as transition]
   ↓
[Section 01 · Distribution — with kicker + title + body + chart]
   ↓
[InlineTeaser — "finding + question" as CTA card]
   ↓
[Section 02 · Speed] ...
   ↓
[BridgeCTA — paywall break to depth]
   ↓
[Locked card grid — what's still waiting]
```

**Every "section" follows:**
- `label-mono` kicker on top: `"01 · Distribution"` — number + middle dot + small word
- `font-serif` title (Bebas Neue, large)
- `serif-body` body (Courier italic)
- Chart or interaction below

**Tilts & rotation:**
- Cards may sit slightly skewed: `rotate(-0.3deg)` to `rotate(-1.4deg)`, for Library cards up to `1.1deg` positive
- Array `TILTS = [-1.4, 0.6, -0.8, 1.1, -0.4, 0.9]` is applied modulo-cyclically to a grid list — gives each page a lively rhythm
- Sticker badges are tilted more aggressively: `rotate(-2deg)` to `8deg`
- Never above 3° for cards — otherwise it feels slapstick instead of gossip

**Mobile-first:** The hero caps scale via `text-[20vw]` — on phones they automatically go big and stay absolute `text-[180px]` on desktop. That's part of the look.

---

## 5. Component catalog

### `.card`
```css
@apply bg-white border-2 border-ink rounded-none p-6 md:p-8;
box-shadow: 4px 4px 0 var(--black);
```
White surface, **sharp black 2px border**, **hard 4px-4px shadow** (no blur). Rounded-none — no corner rounding. Padding 24–32px.

### `.exhibit-label`
Absolutely positioned black tab top-left on a card, white on black, Courier Prime 10px, letter-spacing `0.12em`, uppercase, rotated `-2deg`. The most important "tabloid evidence" marker of the app. Always short (2–4 words): "EXHIBIT 0: PREMISE", "EXHIBIT 03: LOCKED", "EXHIBIT 99: HOUSE RULES".

### `.sticker` / `.sticker-tilt`
Yellow background, 1.5px black border, 2px-2px hard shadow, Bebas Neue 14px. For "✦ THAT'S YOU" or "ALL FILES ✦" badges on card corners. `.sticker-tilt` has `rotate(-2deg)` with hover to `rotate(2deg)` — the "peel and stick" feel.

### `.btn-pop`
Primary button. Yellow BG, black 2px border, 3px shadow, Bebas Neue 18px uppercase, letter-spacing `0.04em`. Hover: BG turns white, button shifts `-1px/-1px`, shadow grows to 4px. Active: BG presses in `1px/1px`, shadow shrinks to 1px. That's the core motion play.

### `.pill-pop`
Black BG, white text, Courier Prime 10px uppercase `0.16em` tracking. Used for status chips ("100% private · nobody reads along", "preview label"). Often with a **pulsing small colored dot** in front — the app's "activity" signal.

### `.mark`
The highlighter. Acid-yellow linear gradient (with minimal fade-in/fade-out at the edges so it actually looks like a physical marker), padding `0 0.18em`, negative margin to overlap, `rotate(-0.3deg)`. Only for marking **single words**, max 1–2 per sentence.

### `.quote-box`
White with black border, Courier Prime **italic**, 4px shadow, relative padding `18px 20px`. **Always with `exhibit-label` tab top-left** (`position: absolute; top: -10px`). This is the app's "screenshottable evidence block" — with a stamp.

### `.circled`
Hand-drawn circle around a word — second-paragraph position, black 2px border, `border-radius: 50%`, slightly rotated and vertically squished. For person names in prose: "Between <circled>Alice</circled> and <circled>Bob</circled>".

### `.redact-line`
Black redaction stripe: `display: block; background: black; height: 14px; margin: 8px 0`. For "something is here, you can't see it yet" — paywall teaser.

### `.black-box`
Inverse card: black BG, white text, 4px shadow. For contrast points ("TOXICITY LEVEL"), refusal cards, meta blocks.

### `.gradient-text` / `.gradient-text-cool`
Not really a gradient. Black text on **yellow** (or white with black border) BG, `box-decoration-break: clone`. For single key words mid-hero text: "Drop your **chat**." where "chat" is yellow-underlaid.

### `.gradient-border`
Hard-black 2px border + 4px shadow + `rounded-none`. For upload drop zones and other "drop-it-here" zones.

### `.dotgrid`
Radial gradient with masked ellipse — for subtle halftone texture overlays on drop zones. The halftone BG of the body is the same pattern at full-page level.

### `.shimmer-bg`
Linear-gradient shimmer animation for "wait/loading" states. Used for blurred paywall previews.

---

## 6. Motion

Fast, poppy, physical. No soft easings except where "smooth" is explicitly wanted.

**Keyframes in the system:**
- `count-up` — number fades up + `translateY(8px→0)` in 600ms
- `fade-in` — 800ms
- `slide-up` — `translateY(20px→0)` in 600ms
- `pulse-soft` — 2.5s — for the dot indicator in pills
- `pop-in` — `scale(0.7) rotate(-3deg) → overshoot scale(1.04) rotate(1deg) → 1/0deg` with back-easing (target cubic `0.34, 1.56, 0.64, 1`)
- `wobble` — 2.6s rotation `-4deg ↔ 4deg`
- `float-slow` / `float-med` — vertical breathing of decorative elements (6s / 4.2s)
- `shimmer` — gradient sweep for loading skeletons
- `spin-slow` — 14s full rotation for decorative spinners

**Hover rules:**
- Cards: `translate(-2px, -2px)` on hover. "lift and tack again"
- `.btn-pop`: lift + larger shadow
- `.sticker-tilt`: flips the rotation to the other side
- Never increase shadow blur — shadows stay hard

**Don't use:**
- Soft blur on shadows
- Gradient transitions between colors (except for `animated-gradient-text` decoration, rare)
- Long (>1s) smooth transitions for UI elements
- Parallax
- Spinning loaders — use `shimmer-bg` or sequenced `pop-in`

---

## 7. Voice in UI copy

The tone in the code is established and stays:

- **Lowercase dominates** in running text ("nothing here yet", "drop a chat")
- **CAPS** in hero words ("LEAKS", "RECEIPTS", "EXHIBIT 99: HOUSE RULES", "I AM ALICE")
- **Detective/tabloid slang**: "leaks", "receipts", "intel", "shred", "leak", "spill the tea", "files"
- **Direct address** ("honey", "you'll be sharper than 90% of people")
- **No coach-speak**: no "self-love", "energy", "authentic being"
- **No question chains at the end**: instead of "How does that feel?" rather "That shifted in April."
- **Date stamps like case numbers**: "as of 04.18.2026"
- **Active verbs**: "tap a card to open", "drop a WhatsApp export"

**For buttons:** short verbs, caps, optional arrow:
- `NEW LEAK`
- `UPLOAD FIRST LEAK`
- `UNLOCK ALICE`
- `TOP UP TICKETS`
- `SHOW THE DYNAMIC →`

---

## 8. Page recipes

### Hero bleed
Combination of **date mono label** + **huge caps word** + optional **small copy line** or **button**. Always left-aligned, leading near 0.85, tracking slightly negative. The single word *breaks* visually into the page.

### Section formula
```
[label-mono: "04 · Signal"]  [title: "Who holds on at night?"]
[serif-body body-text]
[chart / viz / interaction]
[optional InlineTeaser below — "finding · question · CTA"]
```

### InlineTeaser
After every section: a compact card with a **concrete finding** (a number, a name) + a **raised question** + button. That's the continuous paywall nudge without pressure.

### BridgeCTA
Mid-page break between the free findings and the blurred remainder. Sets the transition emotionally: "spill the tea · 10 findings down · now the real read begins".

### Locked card grid
2-column grid with blurred preview cards of the paid modules. Each card has:
- Number (02, 03, 04, 05)
- Short emoji
- Title ("Who's who?")
- 3 teaser lines that begin and break with "…"
- CTA button (UNLOCK / TOP UP)

### Library card
As `ChatCard`: white card with `exhibit-label` "EXHIBIT 01: WHATSAPP LOG", person names as `font-serif` caps, Courier metadata (messages, time range), below a row of module chips (yellow when done, outlined when not). Tilt from the `TILTS` array, shadow 6px.

---

## 9. Special elements

**Halftone overlay:** The whole body gets a subtle radial-gradient dot pattern at `opacity: 0.08`, `background-size: 8px 8px`. Provides the "printed" texture without dominance.

**Scrollbar:** Pink track, black thumb with 2px pink inner border — the scrollbar itself is part of the design.

**Text selection:** Yellow on black.

**Person markers in body text:** Person names may be circled in copy text using `.circled` (handmade effect).

---

## 10. Hard don'ts

- No Paper/Ink/Fraunces editorial look
- No dark mode as default theme
- No Material Design, no gradient BGs except `pop-hero` etc. as deliberately chosen decoration
- No emoji parade in buttons (single pop emojis OK: ✦, ＋, ×)
- No soft shadows / glow effects (except deliberately as `glow` for person colors with `blur-3xl` background effects)
- No tabs (vertical scroll dominates)
- No chat bubbles as a generic UI element (that's the old direction — out)
- No Inter, no Roboto, no Arial
- No lowercase tags in places where CAPS live (hero words, stickers, exhibit labels, buttons)

---

## 11. Existing code as reference

Authoritative files:

- `roentgen/tailwind.config.js` — color and font definitions
- `roentgen/src/index.css` — the component classes (`.card`, `.exhibit-label`, `.sticker`, `.btn-pop`, `.mark`, `.quote-box`, `.circled`, `.redact-line`, `.black-box`)
- `roentgen/src/components/Library.tsx` — hero bleed + chat-card pattern
- `roentgen/src/components/HardFactsView.tsx` — section rhythm, InlineTeaser, BridgeCTA, LockedCard
- `roentgen/src/components/Upload.tsx` — drop zone with halftone + exhibit label
- `roentgen/src/App.tsx` (header + nav) — `tell.` wordmark (now `tea.`) and bottom nav

For new views, read these files first, then build.

---

## 12. Changes to this document

This document is the ground truth. If a new UI idea doesn't fit here, **first** decide whether the document gets extended — don't "silently" introduce a different look. Code must never silently diverge from the document.

---

*Design System V1 — Receipts Edition — 2026-04-20. Living document.*
