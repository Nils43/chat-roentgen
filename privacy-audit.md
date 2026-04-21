# Privacy Audit · tea

> DSGVO-First-Audit. Was wir heute tun, wo wir rechtlich stehen, und was zu tun ist.
> Stand: 2026-04-21. Live-Dokument.

---

## 1. Datenfluss heute — wohin geht was?

### Zone 1 — On-device (Browser)
- **Chat-Upload** (`Upload.tsx` → `parser/whatsapp.ts`): .txt/.zip wird im Browser geparst. Keine HTTP-Requests. Unzip läuft via `jszip` lokal.
- **Hard Facts Analyse** (`hardFacts.ts`): reines JS-Rechnen, keine Netzwerk-Calls.
- **Speicherung:** Chat-Inhalte liegen in **IndexedDB** (`sessionStore.ts`), Meta in **localStorage** (`chatLibrary`). Alles pro Browser.

### Zone 2 — Proxy (Server, transient)
- **POST /api/analyze** (`server/proxy.ts`): nimmt `{model, max_tokens, system, messages, tools, tool_choice}` entgegen, leitet an Anthropic weiter.
- Body nur im RAM während des Requests. Kein Disk-Log, kein Request-Body-Logging. Size-Cap 500 KB.
- API-Key wird nie an den Browser geschickt.

### Zone 3 — Anthropic (Third-Party, EU → USA)
- **Evidence Packet** (~500 Tokens JSON) + **12 kuratierte Nachrichten** (~1500 Tokens Text) gehen raus.
- Vorher **pseudonymisiert**: Namen → "Person A/B", E-Mails → `[email]`, Links → `[link]`, Telefonnummern → `[phone]`.
- **Anthropic-Policy:** keine Training-Nutzung, 30 Tage Retention für Trust & Safety.

### Third-Party Externals (heute)
- **Google Fonts** (`index.css`): `fonts.googleapis.com` lädt Bebas Neue + Courier Prime beim ersten Seitenbesuch. **→ DSGVO-Problem**, siehe Kap. 4.1.
- **Keine Analytics**. Kein GA, kein Plausible, kein Fathom, kein Sentry.
- **Keine Cookies** (nur IndexedDB + localStorage, technisch notwendig).

---

## 2. Rechtslage (DSGVO)

### 2.1 Rollen
| Rolle | Wer | Basis |
|------|-----|-------|
| **Controller** | Der User für die eigenen Chat-Daten (Haushaltsausnahme greift für private Nutzung) | Art. 2(2)(c) DSGVO |
| **Controller** | tea für Account-/Tech-Daten (wenn wir welche hätten — haben wir heute nicht) | Art. 4(7) |
| **Processor** | tea für Chat-Daten die an die AI gehen | Art. 28 |
| **Sub-Processor** | Anthropic (via Proxy → Third-Country) | Art. 28(2) |

### 2.2 Rechtsgrundlagen
- **Account/Login**: brauchen wir aktuell nicht → Thema entfällt.
- **Eigene Chat-Daten** (Teil der Haushaltsausnahme): keine DSGVO-Anwendung.
- **AI-Verarbeitung der Ausschnitte**: **Einwilligung** nach Art. 6(1)(a) — explizit, informiert, widerrufbar.
- **Sensible Kategorien** (Art. 9): Chats können Gesundheit, Sexualleben, politische Meinungen enthalten → **explizite Einwilligung** nach Art. 9(2)(a) nötig, nicht nur Art. 6.
- **Daten der anderen Person**: Haushaltsausnahme greift für den User. tea als Processor verarbeitet im Auftrag des Users. Pseudonymisierung minimiert das Risiko.

### 2.3 Drittland-Transfer (Anthropic = USA)
- Nach **Schrems II** problematisch ohne zusätzliche Garantien.
- Braucht: **Data Processing Addendum (DPA)** mit Anthropic **plus EU SCCs** plus **TIA (Transfer Impact Assessment)**.
- Anthropic hat Standard-DPA: https://www.anthropic.com/legal/dpa → abschließen + verlinken.
- Aktueller EU-US Data Privacy Framework (adäquanzbeschluss seit 2023): Anthropic muss zertifiziert sein, sonst brauchen wir SCCs zusätzlich.

### 2.4 Google Fonts = rechtliche Altlast
- LG München 2022 (20.01.2022, Az. 3 O 17493/20): **Einbindung via CDN = rechtswidrig** bei fehlender Einwilligung.
- Massenabmahnungen 2022 in Deutschland.
- Lösung: **Self-hosting** der Fonts (Google Fonts Helper / download + locally serve).

### 2.5 Betroffenenrechte (Art. 15-22)
| Recht | Wie heute | Gap |
|-------|-----------|-----|
| Auskunft (15) | User hat alle Daten selbst im Browser | Klarstellung im Policy-Text |
| Berichtigung (16) | n/a — keine Profile angelegt | — |
| Löschung (17) | `chatLibrary.remove(id)` löscht Chat + Session | Kein "alles löschen"-Button |
| Portabilität (20) | Chat-Export fehlt | **Export als JSON implementieren** |
| Widerruf (7) | Consent-Screen vorhanden aber Widerruf nach dem Call unmöglich (Data schon bei Anthropic) | Klarstellung |
| Beschwerde (77) | Aufsichtsbehörde nennen (z.B. BayLDA wenn Firma in Bayern) | Im Policy-Text |

---

## 3. Gaps — was wir heute NICHT haben

1. **Keine Datenschutzerklärung** im Produkt. Harter GDPR-Breaker wenn live.
2. **Kein Impressum** (§5 TMG + §18 MStV Pflicht für Dienstanbieter in DE).
3. **Google Fonts** via CDN = Abmahn-Radar.
4. **Kein Datenexport** für den User — scheitert Art. 20.
5. **Kein "alles löschen"**-Knopf — nur einzel-delete. Art. 17 verlangt "ohne Umstände".
6. **Keine expliziten Hinweise** auf Art. 9-Risiko (Chats enthalten sensible Kategorien) im Consent-Flow.
7. **Fehlende Transfer-Klarstellung** im AI-Consent-Screen (ja es steht "an Anthropic", aber ohne Hinweis auf USA, SCCs, Widerruf-Folgen).
8. **Kein DPIA** (Art. 35) dokumentiert — bei solchen sensiblen Daten formal erforderlich.

---

## 4. Plan — in Implementierungs-Reihenfolge

### 4.1 Google Fonts self-hosten (URGENT)
**Aufwand:** klein, **Risiko:** sofort abmahnfähig aktuell.
- Fonts runterladen, in `public/fonts/` legen, per `@font-face` selbst einbinden
- `@import` aus `index.css` raus

### 4.2 Datenschutzerklärung als Route
Neue Komponente `PrivacyPolicy.tsx`, erreichbar via Footer-Link + Zahnrad. Inhalte:
- Verantwortlicher (Name, Adresse, E-Mail) — für privaten Demo: Platzhalter
- Rechtsgrundlagen der drei Zonen
- Liste der Daten-Empfänger (Anthropic, Stripe, Hosting)
- Drittland-Transfer + SCCs + DPF-Hinweis
- Betroffenenrechte inkl. Beschwerderecht (BayLDA genannt)
- Datenkategorien, Zwecke, Speicherdauern
- Ehrlich über Anthropic 30-Tage-Retention

### 4.3 Impressum als Route
Neue Komponente `Imprint.tsx`:
- Name, Anschrift, Kontakt
- Verantwortlich für Inhalt nach §18 MStV
- Haftungsausschluss

### 4.4 Settings-Panel
Neue Route/Modal mit:
- **"Export all data"** — JSON-Dump aller Chats + Ergebnisse
- **"Delete all data"** — wipes IndexedDB + localStorage, "sure?"-Bestätigung
- Status: wie viele Chats, wie viele Analysen
- Link zu Privacy + Imprint

### 4.5 Consent-Screen härten
- Explizit nennen: *"Ein Ausschnitt wird an **Anthropic (USA)** gesendet. Speicherdauer dort: 30 Tage. Kein Training."*
- Hinweis: *"Chats können sensible Themen enthalten (Gesundheit, Sexualleben, politische Ansichten). Durch "Start" erteilst du **explizite Einwilligung** nach Art. 9 DSGVO für diese Verarbeitung."*
- Checkbox (nicht vorausgewählt) für Art. 9 consent

### 4.6 Upload-Screen mit Art. 9 Hinweis
- Bestehende House-Rules Checkbox ergänzen um Verweis auf die **explizite Einwilligung bei AI-Start**

### 4.7 Privacy-Hinweis bei erstem App-Start
Einmaliger Banner (localStorage-Flag) beim ersten Besuch:
- *"Wir analysieren lokal. Für tiefe Einblicke geht ein kleiner Teil an eine AI in den USA. Deine Chats werden nie gespeichert."*
- [Ok, got it] [Read the policy]

### 4.8 DPIA dokumentieren
Neues Dokument `dpia.md` im Repo: Art. 35 Data Protection Impact Assessment. Wird nicht im Produkt gezeigt, dokumentiert intern.

### 4.9 DPA mit Anthropic abschließen (operativ, nicht im Code)
- Anthropic DPA unterzeichnen
- SCCs anhängen
- TIA (Transfer Impact Assessment) schreiben

---

## 5. Was wir nicht tun müssen

- **Cookie-Banner:** wir setzen keine Cookies. IndexedDB + localStorage ist "strictly necessary" für den Hauptzweck (Chat-Speicher) — fällt unter Art. 5(3) ePrivacy-Ausnahme.
- **Newsletter-Double-Opt-in:** kein Newsletter.
- **IP-Logging:** wir logen gar nichts auf dem Proxy, das bleibt so.

---

## 6. Was wir jetzt implementieren (V1-Privacy)

In dieser Reihenfolge im Code:

1. ✅ Self-hosted Fonts — Google Fonts raus aus `index.css`, lokal in `/public/fonts/`
2. ✅ `PrivacyPolicy.tsx` Route mit voller DSGVO-Policy (deutscher Tone, englische UI-Strings)
3. ✅ `Imprint.tsx` Route  
4. ✅ Settings-Panel mit Export + Delete-All + Stats
5. ✅ Footer-Links zu Privacy + Imprint in allen Hauptviews
6. ✅ Consent-Screen: Art.-9-Hinweis + expliziter Anthropic/USA/30-Tage-Text
7. ✅ First-visit Privacy-Hinweis

Dokumente außerhalb Code:

8. `dpia.md` als interne Dokumentation (dieses Repo)
9. DPA Anthropic + SCCs → operativ zu klären

---

*V1 · 2026-04-21 · Live-Dokument.*
