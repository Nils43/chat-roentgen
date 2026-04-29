# Contributing to tea (`roentgen`)

Thanks for considering a contribution. This guide gets you from *cloning the repo* to *opening a pull request* without surprises.

If you haven't yet, read [`Concept.md`](./Concept.md) first. It explains the architecture and — more importantly — the three privacy constraints that drive every design decision. Most "why is this code so weird" questions are answered there.

---

## Table of contents

1. [Getting set up](#1-getting-set-up)
2. [The development loop](#2-the-development-loop)
3. [How the codebase is organized](#3-how-the-codebase-is-organized)
4. [Code style and conventions](#4-code-style-and-conventions)
5. [Privacy rules — non-negotiable](#5-privacy-rules--non-negotiable)
6. [Adding a new feature](#6-adding-a-new-feature)
7. [Git workflow](#7-git-workflow)
8. [Pull request checklist](#8-pull-request-checklist)
9. [Reporting bugs and asking questions](#9-reporting-bugs-and-asking-questions)

---

## 1. Getting set up

### Prerequisites

- **Node.js 20+** and **npm 10+**. Check with `node -v` and `npm -v`.
- A modern browser (Chrome, Firefox, Safari, Edge — all current).
- That's it. No API keys are required to run the app locally — fixture mode covers the full UX.

### Clone and install

```bash
git clone https://github.com/Nils43/chat-roentgen.git
cd chat-roentgen/roentgen
npm install
```

### Configure environment

```bash
cp .env.example .env
```

The defaults in `.env.example` enable **fixture mode** — the app runs entirely on pre-written JSON responses with no API key. Open `.env` if you later want to switch to live mode; see [`roentgen/README.md`](../roentgen/README.md) for the full env reference.

### Run

```bash
npm run dev
```

Open <http://localhost:5173>. Upload any WhatsApp `.txt` export (Settings → Chat → ⋮ → Export chat → Without media). The `Get an analysis` button works without a key thanks to fixture mode.

### Optional — live AI mode

If you want to develop against the real Anthropic API, see the *Switching to live AI* section in [`roentgen/README.md`](../roentgen/README.md). For most contributions, fixture mode is enough.

---

## 2. The development loop

| Command | What it does |
|---------|--------------|
| `npm run dev` | Vite dev server with HMR at `localhost:5173` |
| `npm run build` | Type-check (`tsc -b`) and produce a production bundle in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint over the whole project |

Before pushing, run at least:

```bash
npm run lint
npm run build
```

`build` includes a strict TypeScript pass. If `build` fails, CI will fail.

---

## 3. How the codebase is organized

```
roentgen/
├── api/              Vercel serverless functions (Zone 3)
├── public/           Static assets, AI fixtures, design prototypes
├── server/           Local dev proxy
└── src/
    ├── parser/       WhatsApp .txt → ParsedChat
    ├── analysis/     Hard Facts + interpretation templates
    ├── ai/           Evidence, pseudonymization, prompts, analyzer
    ├── auth/         Supabase session
    ├── credits/      Credit balance + Stripe client
    ├── store/        IndexedDB + localStorage state
    └── components/   Pages, charts, modals, banners
```

Where to put new code, in plain language:

- A new statistic over the parsed chat → `src/analysis/`
- A new chart → `src/components/charts/`
- A new screen → a component under `src/components/`, plus a new `Stage` value in `App.tsx`
- A new AI analysis type → `src/ai/` (new prompt, new schema, new orchestrator) plus the corresponding fixture JSON in `public/fixtures/`
- A change to the parser → `src/parser/whatsapp.ts` and please add a regression chat sample
- A new server-side endpoint → `api/`

If you're not sure, open an issue first and describe what you're trying to do.

---

## 4. Code style and conventions

### TypeScript

- **Strict everywhere.** No `any` outside of well-justified narrow casts. Prefer `unknown` and narrow it.
- **Type imports use `import type`.** Vite enforces this on bundling.
- **Pure functions over classes** unless there is a real reason. The parser, hard facts, evidence builder, and pseudonymizer are all pure.
- **Single export of the obvious thing.** A file named `whatsapp.ts` exports `parseWhatsApp`. A file named `hardFacts.ts` exports `analyzeHardFacts`. Keep the surface area small.

### React

- **Function components only.** No class components.
- **Hooks at the top of the file.** State, derived state, effects, then handlers, then JSX.
- **No prop drilling deeper than two levels.** Lift to the singleton store (`chatLibrary`, `useCredits`) or the `App.tsx` state machine.
- **No global CSS files.** Tailwind classes inline. The one `index.css` is for Tailwind base + a handful of CSS custom properties.

### File and symbol naming

- File names match the dominant export: `whatsapp.ts` exports `parseWhatsApp`, `Upload.tsx` exports `Upload`.
- React components are `PascalCase`. Hooks are `useCamelCase`. Pure functions are `camelCase`.
- Test data, fixtures, and design tokens use `kebab-case` filenames.

### Comments

- Comment **why**, not **what**. The TypeScript already says what.
- Every non-obvious regex gets at least one example line above it. The parser has many of these — match the style.
- If you discover a non-obvious WhatsApp quirk, document it inline. The next person will save an hour.

#### Exemplars

When in doubt, mirror the comment style of these four files. Each one is short on what-comments and heavy on why-comments — invariants, non-obvious decisions, links between distant pieces of code, things that would surprise a careful reader.

| File | What to learn from it |
|---|---|
| [`roentgen/api/analyze.ts`](../roentgen/api/analyze.ts) | Server-layer rationale: why `maxDuration: 60`, why retries are bounded by a deadline, why the refund path lives in two places, why `_supabase` imports are static. |
| [`roentgen/src/ai/pseudonymize.ts`](../roentgen/src/ai/pseudonymize.ts) | Privacy invariants and two-pass regex reasoning. The function-level comments explain *why* full-name passes happen before token passes, and what the case-insensitive restoration is guarding against. |
| [`roentgen/src/analysis/hardFacts.ts`](../roentgen/src/analysis/hardFacts.ts) | Pure-function discipline. The top-of-file rationale links the file to the product's privacy promise and explicitly forbids `await`. |
| [`roentgen/src/ai/relationship.ts`](../roentgen/src/ai/relationship.ts) | Architecture decision recorded next to the code it affects: why three parallel chunks instead of one call, with the latency math that drove the choice. |

A comment that simply restates the next line ("// loop over messages") is worse than no comment — it adds noise and rots faster than the code it describes. If you can delete a comment without losing information, delete it.

### Linting

ESLint is configured in `eslint.config.js` with the React + TypeScript presets. Don't disable rules in passing — if a rule fights you, raise it on the PR.

---

## 5. Privacy rules — non-negotiable

These are not style preferences. They are the product.

1. **Never log user chat content.** Not in `console.log`, not on the server, not in error messages, not in analytics. Errors should describe the *shape* of the failure, not the data.
2. **Never send raw chat text to any third party.** The only data leaving the device is the pseudonymized evidence packet, and only after explicit user consent on the consent screen.
3. **Never send real names to the model.** Use `pseudonymizeDeep` on anything that crosses the boundary into `api/analyze.ts`. Use `restoreNamesDeep` on anything coming back.
4. **Never persist chat content server-side.** Supabase stores user accounts and credit ledgers — not chats. IndexedDB is for the user's own browser.
5. **Never bypass the consent screen.** The `ConsentScreen` component is the user's exit ramp. Adding a flow that skips it is a privacy regression and will be rejected.

If a feature seems to require breaking one of these, open an issue **before** writing code. There is almost always a way to keep the constraint.

---

## 6. Adding a new feature

A worked example: *"I want to add a 'most-used emoji' card to the Hard Facts page."*

1. **Compute the data.** In `src/analysis/hardFacts.ts`, the per-person stats already include `topEmojis`. If a stat doesn't exist, add it as a pure function over `Message[]` and surface it on `PerPersonStats`.
2. **Write an interpretation.** In `src/analysis/interpretation.ts`, add a small DE/EN snippet keyed off the metric. No LLM, just templates.
3. **Render it.** Add a card to `src/components/HardFactsView.tsx`. Tailwind classes, no new CSS file. Match the existing visual rhythm.
4. **Translate.** Add any new strings to `src/i18n.ts` under both `de` and `en` keys.
5. **Verify offline.** `npm run dev`, upload a sample chat, see the card appear.
6. **Lint and build.** `npm run lint && npm run build`.
7. **Open a PR.** See [§7](#7-git-workflow) and [§8](#8-pull-request-checklist).

For a new AI analysis (bigger lift): you'll touch `ai/prompts.ts` (system prompt + tool schema), add a fixture in `public/fixtures/`, write an orchestrator in `src/ai/` modeled on `profile.ts` or `relationship.ts`, add a result view component, and add a stage to `App.tsx`. Open an issue first — these are non-trivial and worth aligning on the design before coding.

---

## 7. Git workflow

- **`main`** is always deployable. Vercel deploys it on push.
- **Feature branches** are named `feat/<short-description>`, fixes are `fix/<short-description>`, docs are `docs/<short-description>`.
- **Commit messages** are imperative and scoped: `fix(parser): handle iOS narrow-no-break-space in AM/PM exports`. The scope is optional but appreciated.
- **Rebase, don't merge** when bringing your branch up to date.
- **Squash on merge** unless your branch has a thoughtful commit history worth preserving.

```bash
git checkout -b feat/late-night-detector
# … work, commit …
git fetch origin
git rebase origin/main
git push -u origin feat/late-night-detector
```

Open the PR via the GitHub UI.

---

## 8. Pull request checklist

Before requesting review, confirm:

- [ ] `npm run lint` passes.
- [ ] `npm run build` passes (this includes a strict TypeScript pass).
- [ ] The change works in **fixture mode** — i.e. without an API key.
- [ ] If you touched `src/parser/`, you added a real-world chat snippet that demonstrates the behavior (gist link or short paste in the PR description; never commit a real chat to the repo).
- [ ] If you touched `src/ai/`, you confirmed the pseudonymization and restore round-trip on a chat with multi-token names like `Max Müller`.
- [ ] Privacy rules in [§5](#5-privacy-rules--non-negotiable) are intact.
- [ ] No `console.log` of chat content. (`console.log` of structural facts during dev is fine, but remove before merging.)
- [ ] DE and EN strings are both present for any new user-facing text.
- [ ] The PR description explains *what* changed and *why* — link to the issue if there is one.

A reviewer will look for: privacy compliance, code style, behavior in fixture mode, and whether the change earns its complexity.

---

## 9. Reporting bugs and asking questions

- **Bugs:** open a GitHub issue with steps to reproduce, expected vs. actual behavior, and your browser + OS. **Do not paste real chat content.** A redacted snippet of the relevant lines is enough; usually only the date format matters.
- **Feature ideas:** open an issue and describe the user problem first, the proposed solution second. The privacy constraints in [§5](#5-privacy-rules--non-negotiable) are the main filter — if a feature needs to break them, it likely won't ship as-is, but there's often a creative way to keep them.
- **Questions about the architecture:** [`Concept.md`](./Concept.md) is the long answer. If it doesn't cover your question, the answer probably belongs in there — open an issue and we'll add it.

Welcome aboard.
