# Data Protection Impact Assessment (DPIA) · tea

> Art. 35 GDPR. Internal document, not displayed in the product.
> Status: 2026-04-21. Reviewed annually or on material change to the processing.

---

## 0. Meta

| Field | Value |
|------|------|
| Product | tea (chat analysis tool) |
| Controller | [Controller — name, address, email] |
| Data Protection Officer | Not mandatory to appoint (< 20 persons engaged in data processing). DPO role rests with the Controller. |
| Document author | [Name] |
| Version | 1.0 |
| Last revision | 2026-04-21 |
| Next review | 2027-04-21 or on architectural change |

---

## 1. Why a DPIA at all?

Art. 35(1) GDPR requires a DPIA where the processing is **likely to result in a high risk to the rights and freedoms of natural persons**. The DSK list (German Data Protection Conference, "must list") names, among others:

- Processing of **special categories** (Art. 9) — chats typically contain health, sex life, political opinions ✓
- **Profiling** / comprehensive evaluation of personality ✓
- Processing of **large volumes of data** affecting **a large number of persons** — every user brings along one additional data subject (the chat partner) who has not themselves consented ✓
- **Use of innovative technologies** — LLM-based interpretation ✓

→ A DPIA is **mandatory** here, not optional.

---

## 2. Systematic description of the processing

### 2.1 Purpose
To offer the user a structured psychological reflection on their own communication within a specific chat. Three layers:

1. **Hard Facts** — quantitative overview (local)
2. **Personal Analysis** — personality portrait of the user (AI)
3. **Relationship Analysis** — dyadic dynamics (AI)

### 2.2 Types of data
- Chat messages (text, timestamps, author)
- Participant names (in the export)
- Optionally contained in the chat: emails, URLs, phone numbers, emojis, media references
- Derived: communication statistics, language patterns
- AI output: personality interpretation, relationship patterns

### 2.3 Special categories (Art. 9)
Without any technical separation, chats may contain:
- Health conditions (Art. 9(1))
- Sex life / sexual orientation
- Political opinions
- Religious or philosophical beliefs
- Racial or ethnic origin

**Assumption:** every chat potentially processes Art. 9 data. Mitigation: explicit consent under Art. 9(2)(a).

### 2.4 Data subjects
- **The user** (directly, with consent)
- **The chat partner(s)** (indirectly, without direct consent — the household exemption applies for the user as Controller)

### 2.5 Legal bases
| Processing | Legal basis |
|--------------|------------------|
| On-device parsing / Hard Facts | Household exemption (Art. 2(2)(c)) + technically required |
| Pseudonymization prior to transmission | Risk-mitigating measure, not itself a new legal basis |
| AI processing (Art. 6) | Consent (Art. 6(1)(a)) |
| AI processing (Art. 9) | Explicit consent (Art. 9(2)(a)) |
| Third country transfer (Art. 44) | Art. 46 (SCCs) + where applicable Art. 45 (DPF) |

---

## 3. Necessity and proportionality

### 3.1 Necessity of AI processing
The Hard Facts cover 80% of the user value and run purely locally. The AI analysis is the **optional premium layer** — invoked explicitly by user action only, with separate consent, and paid for separately.

**→ Avoidable non-necessity is avoided.** Users who do not want AI still receive the basic analysis.

### 3.2 Data minimization (Art. 5(1)(c))
| Measure | Scope |
|----------|--------|
| Do not send all messages | Instead of 5,000+ messages, at most 12 curated moments are sent |
| Evidence packet instead of raw text | ~500–1500 tokens instead of 20,000+ |
| Pseudonymization | All names → "Person A/B" prior to transmission |
| PII scrubbing | Emails, URLs, phone numbers replaced locally |
| Truncated timestamps | Minute-level rather than seconds |

### 3.3 Purpose limitation (Art. 5(1)(b))
Data is processed **exclusively** for the analysis commissioned by the user. No training, no product improvement loop, no data disclosure to third parties beyond Anthropic, no marketing.

### 3.4 Storage limitation (Art. 5(1)(e))
| Location | Duration |
|-----|-------|
| On-device (IndexedDB / localStorage) | Until user deletion (explicitly available in the UI) |
| Proxy | Transient, only during the HTTPS request |
| Anthropic | Up to 30 days (Trust & Safety), then auto-delete |

---

## 4. Data flows (detailed)

### 4.1 Zone 1 — Browser
```
[WhatsApp Export .txt/.zip]
    ↓ (User-Drop + optional unzip via jszip, lokal)
[Parser]
    ↓
[Messages in Memory]
    ↓                                  ↓
[IndexedDB: sessionStore]      [analyzeHardFacts()]
                                       ↓
                            [HardFacts-Objekt in State]
                                       ↓
                               [UI Rendering]
```
No HTTP requests. No external services (apart from the initial app load).

### 4.2 Zone 2 + 3 — AI chain (only on explicit user action)
```
[HardFacts + ParsedChat + selfPerson]
    ↓
[buildEvidence()]           # lokal
    ↓
[Pseudonymisierung]         # lokal — Namen → Person A/B, PII-Scrub
    ↓
[EvidencePacket ~500 tokens + 12 Moments ~1200 tokens]
    ↓ HTTPS POST
[Proxy /api/analyze]        # RAM-only, kein Disk-Write, kein Body-Log
    ↓ x-api-key + HTTPS
[Anthropic Claude API]      # USA
    ↓ 1-3 Sekunden
[Tool-Use JSON Response]
    ↑ HTTPS
[Proxy Passthrough]
    ↑
[Browser restoreNames()]    # Pseudonyme zurück zu Klarnamen
    ↓
[UI + IndexedDB]            # Speicherung der Analyse-Ergebnisse lokal
```

---

## 5. Risk analysis

Methodology: scale **likelihood × severity**, each rated low / medium / high.

### R1 — Breach of confidentiality during AI transfer
- **Scenario:** an attacker intercepts the HTTPS request between browser and proxy, or proxy and Anthropic.
- **Likelihood:** low (TLS 1.3 on both sides, HSTS, certificate pinning technically feasible)
- **Severity:** high (sensitive chat content, Art. 9)
- **Risk:** medium

### R2 — Anthropic data breach
- **Scenario:** Anthropic suffers a security incident; the 30-day retention copy is compromised.
- **Likelihood:** low (ISO 27001, SOC 2 Type II certified)
- **Severity:** high
- **Risk:** medium

### R3 — Re-identification despite pseudonymization
- **Scenario:** chat content contains context-specific details that enable re-identification (place names, jobs, hobbies).
- **Likelihood:** medium (context-dependent)
- **Severity:** medium (pseudonymization is not anonymization per Art. 4(5))
- **Risk:** medium

### R4 — Lack of consent from the other party
- **Scenario:** Person B is analyzed by the user, knows nothing about it, complains.
- **Likelihood:** medium
- **Severity:** medium (subjective personality rights, potentially criminal liability in case of mass usage)
- **Risk:** medium

### R5 — Misinterpretation / faulty diagnosis
- **Scenario:** the AI output is read by the user as clinical truth and leads to wrong decisions in the relationship.
- **Likelihood:** medium
- **Severity:** medium (social, emotional)
- **Risk:** medium

### R6 — Misuse by controlling partners
- **Scenario:** a stalker / abuser uploads chat exports in order to better manipulate the other person.
- **Likelihood:** low–medium
- **Severity:** high
- **Risk:** medium–high

### R7 — Disclosure via third country, Schrems II context
- **Scenario:** US authorities obtain access to Anthropic data under FISA 702 / EO 12333.
- **Likelihood:** low (Anthropic-specific exposure), legally abstract medium
- **Severity:** high (fundamental-rights relevant)
- **Risk:** medium

### R8 — Unauthorized access to local storage
- **Scenario:** device is lost, IndexedDB is unprotected and readable.
- **Likelihood:** medium (devices get lost)
- **Severity:** high
- **Risk:** medium

### R9 — Prompt injection / jailbreak
- **Scenario:** chat content contains embedded prompt injection that drives the AI to unintended outputs (e.g. manipulation strategy, unwanted PII return).
- **Likelihood:** low (the tool-use schema constrains the output form)
- **Severity:** medium
- **Risk:** low–medium

---

## 6. Mitigations / safeguards

### 6.1 Re R1 (transfer confidentiality)
- HTTPS / TLS 1.3 mandatory
- HSTS header
- No body logging in the proxy, size cap 500 KB
- API key only server-side, never in the client
- Strict Content Security Policy (CSP)

### 6.2 Re R2 (Anthropic breach)
- DPA + EU SCCs with Anthropic
- TIA documented
- Aim for zero-data-retention as soon as volume permits
- Monitoring of the Anthropic security status
- Breach notification process prepared (72-hour deadline under Art. 33)

### 6.3 Re R3 (re-identification)
- Pseudonymization of all participant names **prior to** transmission
- PII scrubbing (emails, URLs, phone numbers) **prior to** transmission
- Timestamps aggregated to the minute, no geolocation
- The user is informed in the consent screen that pseudonymization is not anonymization

### 6.4 Re R4 (consent of other party)
- **Structural decision:** only the user is psychologically profiled. Person B does not get their own profile.
- ToS clause: the user confirms they are themselves a participant in the chat
- Pseudonymization reduces identifiability
- UI notice in the upload flow + consent screen
- No cross-chat aggregation layer that would reconstruct Person B across multiple chats

### 6.5 Re R5 (misinterpretation)
- AI output tonality explicitly prompted: "No romantic forecasts", "no manipulation advice", "no coach talk"
- Disclaimer in the output ("A read, not a diagnosis. For the real stuff, see a professional.")
- Safety flag for red patterns → helpline links (DE 116 016, 0800 111 0 111 · US 1-800-799-7233, 988)

### 6.6 Re R6 (misuse)
- ToS clause against use for stalking / manipulation
- House-rules checkbox at upload confirms: the chat belongs to the user, not as a weapon
- Structurally: no mass-analysis features, no chat-partner profiles, no export features that build personality dossiers of the other party
- Safety flag in the output for gaslighting / control / threats → pointer to support

### 6.7 Re R7 (third country / Schrems II)
- Review of Anthropic certification under the EU-US Data Privacy Framework
- If DPF certified: transfer covered under Art. 45
- If not: SCCs (Module 2 or 3) + TIA
- Long term: evaluate alternative providers (AWS Bedrock EU region, Mistral EU, self-hosted)

### 6.8 Re R8 (local storage)
- User information in the Privacy Policy
- Settings page with a "Delete all data" function (one-click wipe)
- To evaluate in future: optional client-side encryption for IndexedDB (with a user password)

### 6.9 Re R9 (prompt injection)
- The system prompt wraps chat content as data, not as instruction
- The tool-use schema enforces output structure — free-form text outputs are limited by schema constraints
- Output validation: max_tokens set, response is checked against the schema

---

## 7. Measures under Art. 32 (technical / organizational)

- **Encryption in transit:** TLS 1.3
- **Encryption at Anthropic (at rest):** per Anthropic standard
- **Access control to proxy infrastructure:** provider standards (Vercel / Cloudflare)
- **Log minimization:** no request body logging, no IP logs
- **Updates:** dependency updates on a regular basis
- **Incident response:** breach plan is part of the ToS, 72-hour notification documented

---

## 8. Data subject rights operationally

| Right | Implementation |
|------|----------|
| Art. 15 access | The user has everything locally; we have nothing |
| Art. 16 rectification | n/a (no persistent profile data) |
| Art. 17 erasure | Settings → Delete all data (one click) |
| Art. 18 restriction | n/a (no further processing without trigger) |
| Art. 20 portability | Settings → Export all → JSON |
| Art. 21 objection | No Art. 6(1)(f) basis → not applicable |
| Art. 22 automated decision-making | The analysis does not produce legal or similarly significant decisions — but the disclaimer is clear |
| Art. 77 complaint | The Privacy Policy names BayLDA etc. |

---

## 9. Residual risk

After implementing the mitigations, **low to medium residual risks** remain in the following areas:
- Re-identification in context-rich chats (R3)
- Theoretical possibility of US authority access (R7)
- Social harm caused by misinterpretation (R5)

These are accepted because:
- Processing only runs on user initiative + explicit consent
- Users are clearly informed
- The architecture consistently applies minimization
- The purpose (self-reflection) provides measurable value to the user

**Conclusion:** no **high residual risks**, no prior consultation of the supervisory authority (Art. 36) required.

---

## 10. Consultation

- **Data subjects / stakeholders:** no structured involvement yet in the MVP; planned via beta user feedback
- **DPO:** not appointed; functional role with the Controller
- **Supervisory authority:** no prior consultation required under Art. 36 (no high residual risk)

---

## 11. Review cycle

- **Annually** or
- **On material change:** new module, new sub-processor, new type of data, change in the legal landscape (e.g. a new Schrems III)

Next planned review: **2027-04-21**.

---

*DPIA v1 · 2026-04-21 · confidential · internal document.*
