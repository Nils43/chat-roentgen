# Privacy Audit · tea

> GDPR-first audit. What we do today, where we stand legally, and what's left to do.
> As of: 2026-04-21. Living document.

---

## 1. Data flow today — what goes where?

### Zone 1 — On-device (browser)
- **Chat upload** (`Upload.tsx` → `parser/whatsapp.ts`): .txt/.zip is parsed in the browser. No HTTP requests. Unzip runs locally via `jszip`.
- **Hard Facts analysis** (`hardFacts.ts`): pure JS computation, no network calls.
- **Storage:** chat content lives in **IndexedDB** (`sessionStore.ts`), metadata in **localStorage** (`chatLibrary`). All per browser.

### Zone 2 — Proxy (server, transient)
- **POST /api/analyze** (`server/proxy.ts`): receives `{model, max_tokens, system, messages, tools, tool_choice}` and forwards to Anthropic.
- Body only in RAM during the request. No disk log, no request-body logging. Size cap 500 KB.
- API key is never sent to the browser.

### Zone 3 — Anthropic (third party, EU → USA)
- **Evidence Packet** (~500 tokens JSON) + **12 curated messages** (~1500 tokens text) go out.
- Beforehand **pseudonymized**: names → "Person A/B", emails → `[email]`, links → `[link]`, phone numbers → `[phone]`.
- **Anthropic policy:** no training use, 30-day retention for Trust & Safety.

### Third-party externals (today)
- **Google Fonts** (`index.css`): `fonts.googleapis.com` loads Bebas Neue + Courier Prime on the first page visit. **→ GDPR problem**, see section 4.1.
- **No analytics**. No GA, no Plausible, no Fathom, no Sentry.
- **No cookies** (only IndexedDB + localStorage, technically necessary).

---

## 2. Legal situation (GDPR)

### 2.1 Roles
| Role | Who | Basis |
|------|-----|-------|
| **Controller** | The user for their own chat data (household exemption applies for private use) | Art. 2(2)(c) GDPR |
| **Controller** | tea for account/tech data (if we had any — we don't today) | Art. 4(7) |
| **Processor** | tea for chat data sent to the AI | Art. 28 |
| **Sub-Processor** | Anthropic (via proxy → third country) | Art. 28(2) |

### 2.2 Legal bases
- **Account/login**: not currently needed → topic does not apply.
- **User's own chat data** (part of the household exemption): GDPR does not apply.
- **AI processing of the excerpts**: **consent** under Art. 6(1)(a) — explicit, informed, revocable.
- **Sensitive categories** (Art. 9): chats may contain health, sex life, political opinions → **explicit consent** under Art. 9(2)(a) required, not just Art. 6.
- **Data of the other person**: household exemption applies for the user. tea as Processor processes on behalf of the user. Pseudonymization minimizes the risk.

### 2.3 Third-country transfer (Anthropic = USA)
- Per **Schrems II** problematic without additional safeguards.
- Requires: **Data Processing Addendum (DPA)** with Anthropic **plus EU SCCs** plus **TIA (Transfer Impact Assessment)**.
- Anthropic has a standard DPA: https://www.anthropic.com/legal/dpa → execute + link.
- Current EU-US Data Privacy Framework (adequacy decision since 2023): Anthropic must be certified, otherwise we additionally need SCCs.

### 2.4 Google Fonts = legal legacy
- LG München 2022 (20.01.2022, case no. 3 O 17493/20): **embedding via CDN = unlawful** without consent.
- Mass cease-and-desist letters in Germany in 2022.
- Solution: **self-hosting** the fonts (Google Fonts Helper / download + serve locally).

### 2.5 Data subject rights (Art. 15-22)
| Right | How today | Gap |
|-------|-----------|-----|
| Access (15) | User has all data themselves in the browser | Clarification in policy text |
| Rectification (16) | n/a — no profiles created | — |
| Erasure (17) | `chatLibrary.remove(id)` deletes chat + session | No "delete everything" button |
| Portability (20) | Chat export missing | **Implement export as JSON** |
| Withdrawal (7) | Consent screen present but withdrawal after the call impossible (data already at Anthropic) | Clarification |
| Complaint (77) | Name supervisory authority (e.g. BayLDA if company in Bavaria) | In policy text |

---

## 3. Gaps — what we do NOT have today

1. **No privacy policy** in the product. Hard GDPR breaker if live.
2. **No imprint** (§5 TMG + §18 MStV obligation for service providers in Germany).
3. **Google Fonts** via CDN = cease-and-desist radar.
4. **No data export** for the user — fails Art. 20.
5. **No "delete everything"** button — only single-delete. Art. 17 requires "without undue delay".
6. **No explicit notice** of Art. 9 risk (chats contain sensitive categories) in the consent flow.
7. **Missing transfer clarification** in the AI consent screen (yes, it says "to Anthropic", but without notice of USA, SCCs, withdrawal consequences).
8. **No DPIA** (Art. 35) documented — formally required for such sensitive data.

---

## 4. Plan — in implementation order

### 4.1 Self-host Google Fonts (URGENT)
**Effort:** small, **risk:** currently subject to immediate cease-and-desist.
- Download fonts, place in `public/fonts/`, embed yourself via `@font-face`
- Remove `@import` from `index.css`

### 4.2 Privacy policy as a route
New component `PrivacyPolicy.tsx`, reachable via footer link + gear icon. Contents:
- Controller (name, address, email) — for the private demo: placeholder
- Legal bases of the three zones
- List of data recipients (Anthropic, Stripe, hosting)
- Third-country transfer + SCCs + DPF notice
- Data subject rights including right to complain (BayLDA named)
- Data categories, purposes, retention periods
- Honest about Anthropic 30-day retention

### 4.3 Imprint as a route
New component `Imprint.tsx`:
- Name, address, contact
- Responsible for content under §18 MStV
- Disclaimer

### 4.4 Settings panel
New route/modal with:
- **"Export all data"** — JSON dump of all chats + results
- **"Delete all data"** — wipes IndexedDB + localStorage, "sure?" confirmation
- Status: how many chats, how many analyses
- Link to Privacy + Imprint

### 4.5 Harden consent screen
- Explicitly state: *"An excerpt is sent to **Anthropic (USA)**. Retention there: 30 days. No training."*
- Notice: *"Chats may contain sensitive topics (health, sex life, political views). By clicking "Start" you grant **explicit consent** under Art. 9 GDPR for this processing."*
- Checkbox (not pre-selected) for Art. 9 consent

### 4.6 Upload screen with Art. 9 notice
- Extend the existing house-rules checkbox with a reference to the **explicit consent at AI start**

### 4.7 Privacy notice on first app start
One-time banner (localStorage flag) on the first visit:
- *"We analyze locally. For deep insights, a small portion goes to an AI in the USA. Your chats are never stored."*
- [Ok, got it] [Read the policy]

### 4.8 Document the DPIA
New document `dpia.md` in the repo: Art. 35 Data Protection Impact Assessment. Not shown in the product, documented internally.

### 4.9 Execute DPA with Anthropic (operational, not in code)
- Sign Anthropic DPA
- Attach SCCs
- Write TIA (Transfer Impact Assessment)

---

## 5. What we don't have to do

- **Cookie banner:** we set no cookies. IndexedDB + localStorage is "strictly necessary" for the main purpose (chat storage) — falls under the Art. 5(3) ePrivacy exemption.
- **Newsletter double opt-in:** no newsletter.
- **IP logging:** we log nothing at all on the proxy, and that stays that way.

---

## 6. What we are implementing now (V1 privacy)

In this order in the code:

1. ✅ Self-hosted fonts — Google Fonts out of `index.css`, locally in `/public/fonts/`
2. ✅ `PrivacyPolicy.tsx` route with full GDPR policy (German tone, English UI strings)
3. ✅ `Imprint.tsx` route  
4. ✅ Settings panel with export + delete-all + stats
5. ✅ Footer links to Privacy + Imprint in all main views
6. ✅ Consent screen: Art. 9 notice + explicit Anthropic/USA/30-day text
7. ✅ First-visit privacy notice

Documents outside code:

8. `dpia.md` as internal documentation (this repo)
9. DPA Anthropic + SCCs → to be settled operationally

---

*V1 · 2026-04-21 · Living document.*
