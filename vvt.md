# Record of Processing Activities · tea

> Art. 30 GDPR. Internal document. Provided to the supervisory authority on request, **not** displayed in the product.
> As of: 2026-04-21. Reviewed on every architecture change.

---

## 0. Controller

| Field | Value |
|------|------|
| Name | [Your Name / Company] |
| Address | [Street, Postal Code, City, Country] |
| Email | [contact@your-domain] |
| Data Protection Officer | Not required to be appointed; functional role at the Controller |
| Competent supervisory authority | [e.g. BayLDA — Bavarian State Office for Data Protection Supervision] |

---

## PA-01 · On-Device Analysis (Hard Facts)

| Field | Content |
|------|--------|
| **Purpose (Art. 30(1)(b))** | Quantitative analysis of the chat uploaded by the user for self-reflection. |
| **Categories of data subjects** | Users; chat participants (Person B) — only indirectly. |
| **Categories of data** | Chat messages (text, timestamps, author). May contain special categories under Art. 9. |
| **Legal basis** | Household exemption Art. 2(2)(c) GDPR for the user. Technically necessary storage under §25(2) No. 2 TDDDG. |
| **Recipients** | None. Browser-local only (IndexedDB, localStorage). |
| **Third-country transfer** | No. |
| **Retention period** | Until deletion by the user (per chat or "Delete all data" in Settings). |
| **Technical/organizational measures** | No server communication; XSS prevention in the parser (text rendering, no HTML interpolation); file-size limit on upload; no logging. |

---

## PA-02 · AI-assisted Analysis (Personal + Relationship)

| Field | Content |
|------|--------|
| **Purpose** | In-depth psychological interpretation of one's own communication pattern (Personal) or of the couple dynamic (Relationship). |
| **Categories of data subjects** | Users (with consent); chat participants (pseudonymized, not profiled). |
| **Categories of data** | Pre-computed Evidence Packet (~500 tokens JSON): statistics, tone hints, flags, pseudonymized names. 12 curated message excerpts (≤ 140 characters per moment), pseudonymized and PII-scrubbed. Potentially special categories (Art. 9). |
| **Legal basis** | Art. 6(1)(a) consent + Art. 9(2)(a) explicit consent (consent screen per analysis). |
| **Recipients** | Anthropic PBC (Processor, USA) via our own proxy. |
| **Third-country transfer** | Yes — USA. Safeguards: DPA with Anthropic, EU SCCs (Module 2), where applicable EU-US Data Privacy Framework (Art. 45), TIA documented. |
| **Retention period** | On the tea side: not stored (transient in proxy RAM). On the Anthropic side: up to 30 days Trust & Safety retention, then auto-deletion. No training. |
| **Technical/organizational measures** | TLS 1.3 end-to-end; no body logging in the proxy; API key server-side only; pseudonymization + PII scrubbing before transmission; request size cap of 500 KB; tool-use schema constrains output form; prompt-injection guards in the system prompt. |

---

## PA-03 · Local Session Storage

| Field | Content |
|------|--------|
| **Purpose** | Reopening previously analyzed chats without re-uploading; persistence of AI results. |
| **Categories of data subjects** | Users; chat participants. |
| **Categories of data** | Raw chat text + computed results (HardFacts, ProfileResult, RelationshipResult), metadata (filename, participants, time period). |
| **Legal basis** | Art. 2(2)(c) household exemption / §25(2) TDDDG (strictly necessary for the core function). |
| **Recipients** | None. Only in the user's browser. |
| **Third-country transfer** | No. |
| **Retention period** | Until deletion by the user. One-click wipe available (Settings → Delete all data). |
| **Technical/organizational measures** | IndexedDB + localStorage scoped to the origin; no cross-site access; export function for Art. 20. |

---

## PA-04 · Asset Delivery (Fonts)

| Field | Content |
|------|--------|
| **Purpose** | Loading the UI fonts (Bebas Neue, Courier Prime). |
| **Categories of data subjects** | Website visitors. |
| **Categories of data** | IP address + user agent on font fetch (technically unavoidable for HTTPS assets). |
| **Legal basis** | Art. 6(1)(f) legitimate interest (functional rendering). |
| **Recipients** | BunnyWay d.o.o. (bunny.net / Bunny Fonts), Slovenia (EU). |
| **Third-country transfer** | No (EU-based, GDPR-compliant CDN, no IP logging according to the provider). |
| **Retention period** | No persistent storage by tea. According to its own policy, Bunny Fonts does not log IP addresses. |
| **Technical/organizational measures** | Bunny Fonts chosen over Google Fonts explicitly for GDPR compliance (Munich Regional Court 2022, 3 O 17493/20). Preconnect + TLS. |

---

## PA-05 · Hosting / Deployment

| Field | Content |
|------|--------|
| **Purpose** | Serving the static assets and the API proxy. |
| **Categories of data subjects** | Website visitors. |
| **Categories of data** | IP address, user agent, request URL (standard web-server metadata, transient, not persisted). |
| **Legal basis** | Art. 6(1)(f) legitimate interest (operation of the website). |
| **Recipients** | [Hosting provider — e.g. Vercel Inc. (USA) or Cloudflare Inc. (USA)]. |
| **Third-country transfer** | [Yes, if USA — SCCs + DPF if certified]. If an EU region is selected: no. |
| **Retention period** | Request log per provider default. IP logs on the tea side: none. |
| **Technical/organizational measures** | TLS 1.3; HSTS; CSP (Content Security Policy); no request-body logs; proxy code suitable for open-source audit. |

---

## PA-06 · Data Subject Rights Process

| Field | Content |
|------|--------|
| **Purpose** | Handling access, deletion, and portability requests under Art. 15, 17, 20 GDPR. |
| **Categories of data subjects** | Users; in principle any data subject who submits a request. |
| **Categories of data** | Identification data of the requesting person (name, contact email), to the extent needed to process the request. |
| **Legal basis** | Art. 6(1)(c) legal obligation (GDPR compliance). |
| **Recipients** | None. |
| **Third-country transfer** | No. |
| **Retention period** | Case correspondence kept for max. 3 years after closure of the procedure to satisfy accountability obligations (Art. 5(2)). |
| **Technical/organizational measures** | In-app: Settings → Export / Delete all. Email contact for requests in the legal notice + privacy policy. Handled manually within the one-month deadline under Art. 12(3). |

---

## 1. Cross-cutting technical and organizational measures

- **Confidentiality:** TLS 1.3 end-to-end; API key server-side; no body logs.
- **Integrity:** No persistent chat-content storage on the server side; tool-use schema validates AI output.
- **Availability:** Provider standards; no active DR plan needed given the lack of persistent server state.
- **Resilience:** Rate limiting in the proxy (on top of hosting provider standards); 500 KB size cap per request.
- **Review:** Annual review of this Record of Processing Activities, the privacy policy, and the DPIA; dependency updates on an ongoing basis.

---

## 2. List of Processors (Art. 28)

| No. | Name | Purpose | Contract | Region |
|----|------|-------|---------|--------|
| 1 | Anthropic PBC | AI inference | DPA + SCCs + (where applicable) DPF | USA |
| 2 | [Hosting provider] | Static + proxy hosting | DPA | [EU or USA with SCCs] |
| 3 | BunnyWay d.o.o. | Font CDN | DPA in place (Bunny DPA) | EU (Slovenia) |

---

## 3. Change history

| Version | Date | Change |
|---------|-------|----------|
| 1.0 | 2026-04-21 | Initial version |

---

*RoPA V1 · 2026-04-21 · confidential · internal document under Art. 30 GDPR.*
