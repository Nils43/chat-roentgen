# Data Protection Impact Assessment (DPIA) · tea

> Art. 35 DSGVO. Internes Dokument, wird nicht im Produkt angezeigt.
> Stand: 2026-04-21. Review jährlich oder bei wesentlicher Änderung der Verarbeitung.

---

## 0. Meta

| Feld | Wert |
|------|------|
| Produkt | tea (Chat-Analyse-Tool) |
| Verantwortlicher | [Controller — Name, Anschrift, E-Mail] |
| Datenschutzbeauftragter | Nicht bestellungspflichtig (< 20 Personen mit Datenverarbeitung). DPO-Rolle liegt beim Controller. |
| Dokument-Autor | [Name] |
| Version | 1.0 |
| Letzte Revision | 2026-04-21 |
| Nächste Review | 2027-04-21 oder bei Architekturänderung |

---

## 1. Warum überhaupt ein DPIA?

Art. 35 Abs. 1 DSGVO verlangt ein DPIA, wenn die Verarbeitung **ein hohes Risiko für die Rechte und Freiheiten natürlicher Personen** zur Folge hat. Die Liste der DSK (Deutsche Datenschutzkonferenz, "Muss-Liste") nennt u.a.:

- Verarbeitung **besonderer Kategorien** (Art. 9) — Chats enthalten typisch Gesundheit, Sexualleben, politische Ansichten ✓
- **Profiling** / umfassende Bewertung von Persönlichkeit ✓
- Verarbeitung **großer Datenmengen** mit **Betroffenheit vieler Personen** — jeder User bringt 1 weitere betroffene Person mit (Chatpartner:in), die nicht selbst zugestimmt hat ✓
- **Einsatz innovativer Technologien** — LLM-basierte Interpretation ✓

→ DPIA ist hier **pflichtig**, nicht optional.

---

## 2. Systematische Beschreibung der Verarbeitung

### 2.1 Zweck
Dem User eine strukturierte psychologische Reflexion der eigenen Kommunikation in einem spezifischen Chat anzubieten. Drei Ebenen:

1. **Hard Facts** — quantitative Übersicht (lokal)
2. **Personal Analysis** — Persönlichkeitsportrait des Users (AI)
3. **Relationship Analysis** — Dyaden-Dynamik (AI)

### 2.2 Datenarten
- Chat-Nachrichten (Text, Zeitstempel, Author)
- Teilnehmernamen (im Export)
- Optional im Chat enthalten: E-Mails, URLs, Telefonnummern, Emojis, Medien-Referenzen
- Abgeleitet: Kommunikations-Statistiken, Sprachmuster
- AI-Output: Persönlichkeitsinterpretation, Beziehungsmuster

### 2.3 Besondere Kategorien (Art. 9)
Chats können — ohne technische Trennung — enthalten:
- Gesundheitliche Zustände (Art. 9(1))
- Sexualleben / sexuelle Orientierung
- Politische Meinungen
- Religiöse oder weltanschauliche Überzeugungen
- Rassische oder ethnische Herkunft

**Annahme:** Jeder Chat verarbeitet potenziell Art. 9-Daten. Mitigation: explizite Einwilligung nach Art. 9(2)(a).

### 2.4 Betroffene Personen
- **Der User** (direkt, mit Einwilligung)
- **Der/die Chat-Partner:in** (indirekt, ohne direkte Einwilligung — Haushaltsausnahme greift für den User als Controller)

### 2.5 Rechtsgrundlagen
| Verarbeitung | Rechtsgrundlage |
|--------------|------------------|
| On-device Parsen/Hard Facts | Haushaltsausnahme (Art. 2(2)(c)) + technisch erforderlich |
| Pseudonymisierung vor Versand | Risikomindernde Maßnahme, selbst keine neue Rechtsgrundlage |
| AI-Verarbeitung (Art. 6) | Einwilligung (Art. 6(1)(a)) |
| AI-Verarbeitung (Art. 9) | Explizite Einwilligung (Art. 9(2)(a)) |
| Drittland-Transfer (Art. 44) | Art. 46 (SCCs) + ggf. Art. 45 (DPF) |

---

## 3. Notwendigkeit und Verhältnismäßigkeit

### 3.1 Erforderlichkeit der AI-Verarbeitung
Die Hard Facts decken 80% des User-Werts ab und laufen rein lokal. Die AI-Analyse ist der **optionale Premium-Layer** — explizit nur auf User-Aktion, mit gesondertem Consent, separat bezahlt.

**→ Nicht-Notwendigkeit vermeidbar.** Wer kein AI will, bekommt trotzdem die Basis-Analyse.

### 3.2 Datenminimierung (Art. 5(1)(c))
| Maßnahme | Umfang |
|----------|--------|
| Nicht alle Nachrichten senden | Statt 5.000+ Messages gehen max. 12 kuratierte Moments raus |
| Statt Rohtext ein Evidence Packet | ~500-1500 Tokens statt 20.000+ |
| Pseudonymisierung | Alle Namen → "Person A/B" vor Versand |
| PII-Scrubbing | E-Mails, URLs, Telefonnummern lokal ersetzt |
| Zeitstempel gekürzt | Minuten-Level statt Sekunden |

### 3.3 Zweckbindung (Art. 5(1)(b))
Daten werden **ausschließlich** für die vom User beauftragte Analyse verarbeitet. Kein Training, kein Produktverbesserungs-Loop, keine Datenweitergabe an Dritte über Anthropic hinaus, kein Marketing.

### 3.4 Speicherbegrenzung (Art. 5(1)(e))
| Ort | Dauer |
|-----|-------|
| On-device (IndexedDB/localStorage) | Bis User-Löschung (explizit im UI möglich) |
| Proxy | Transient, nur während des HTTPS-Requests |
| Anthropic | Bis 30 Tage (Trust & Safety), dann Auto-Delete |

---

## 4. Datenflüsse (detailliert)

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
Keine HTTP-Requests. Keine externen Dienste (abgesehen vom initialen App-Load).

### 4.2 Zone 2 + 3 — AI-Kette (nur bei expliziter User-Aktion)
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

## 5. Risikoanalyse

Methodik: Skala **Eintrittswahrscheinlichkeit × Schadensschwere**, jeweils niedrig/mittel/hoch.

### R1 — Verletzung der Vertraulichkeit beim AI-Transfer
- **Szenario:** Ein Angreifer fängt den HTTPS-Request zwischen Browser und Proxy oder Proxy und Anthropic ab.
- **Wahrscheinlichkeit:** niedrig (TLS 1.3 beidseitig, HSTS, Zertifikats-Pinning technisch möglich)
- **Schaden:** hoch (sensible Chat-Inhalte, Art. 9)
- **Risiko:** mittel

### R2 — Anthropic-Daten-Breach
- **Szenario:** Anthropic erleidet Sicherheitsvorfall, die 30-Tage-Retention-Kopie wird kompromittiert.
- **Wahrscheinlichkeit:** niedrig (ISO 27001, SOC 2 Typ II zertifiziert)
- **Schaden:** hoch
- **Risiko:** mittel

### R3 — Re-Identifikation trotz Pseudonymisierung
- **Szenario:** Chat-Inhalte enthalten kontext-spezifische Details, die eine Re-Identifikation ermöglichen (Ortsnamen, Jobs, Hobbys).
- **Wahrscheinlichkeit:** mittel (kontextuell)
- **Schaden:** mittel (Pseudonymisierung ist nicht Anonymisierung per Art. 4(5))
- **Risiko:** mittel

### R4 — Fehlender Consent der Gegenseite
- **Szenario:** Person B wird vom User analysiert, weiß nichts davon, beschwert sich.
- **Wahrscheinlichkeit:** mittel
- **Schaden:** mittel (subjektive Persönlichkeitsrechte, ggf. Strafbarkeit bei Massennutzung)
- **Risiko:** mittel

### R5 — Falsch-Interpretation / fehlerhafte Diagnose
- **Szenario:** AI-Output wird vom User als klinische Wahrheit gelesen, führt zu Fehlentscheidungen in der Beziehung.
- **Wahrscheinlichkeit:** mittel
- **Schaden:** mittel (sozial, emotional)
- **Risiko:** mittel

### R6 — Missbrauch durch kontrollierende Partner:innen
- **Szenario:** Ein Stalker/Missbraucher lädt Chat-Exports hoch um die andere Person besser zu manipulieren.
- **Wahrscheinlichkeit:** niedrig-mittel
- **Schaden:** hoch
- **Risiko:** mittel-hoch

### R7 — Weitergabe via Drittland, Schrems-II-Kontext
- **Szenario:** US-Behörden erhalten unter FISA 702 / EO 12333 Zugriff auf Anthropic-Daten.
- **Wahrscheinlichkeit:** niedrig (Anthropic-spezifische Exposition), rechtlich abstrakt mittel
- **Schaden:** hoch (grundrechtsrelevant)
- **Risiko:** mittel

### R8 — Unautorisierter Zugriff auf lokale Speicherung
- **Szenario:** Gerät verloren, IndexedDB ungeschützt lesbar.
- **Wahrscheinlichkeit:** mittel (Geräte werden verloren)
- **Schaden:** hoch
- **Risiko:** mittel

### R9 — Prompt Injection / Jailbreak
- **Szenario:** Chat-Inhalt enthält eingebaute Prompt-Injection, die das AI zu ungewollten Ausgaben bewegt (z.B. Manipulations-Strategie, unerwünschte PII-Rückgabe).
- **Wahrscheinlichkeit:** niedrig (Tool-Use-Schema beschränkt die Output-Form)
- **Schaden:** mittel
- **Risiko:** niedrig-mittel

---

## 6. Mitigations / Safeguards

### 6.1 Zu R1 (Transfer-Vertraulichkeit)
- HTTPS/TLS 1.3 verpflichtend
- HSTS-Header
- Keine Body-Log im Proxy, Size-Cap 500 KB
- API-Key nur server-side, nie im Client
- Content Security Policy (CSP) strikt

### 6.2 Zu R2 (Anthropic-Breach)
- DPA + EU SCCs mit Anthropic
- TIA dokumentiert
- Zero-Data-Retention anstreben sobald Volumen ausreicht
- Monitoring des Anthropic Security Status
- Breach-Notification-Prozess vorbereitet (72h-Frist nach Art. 33)

### 6.3 Zu R3 (Re-Identifikation)
- Pseudonymisierung aller Teilnehmernamen **vor** Versand
- PII-Scrubbing (E-Mails, URLs, Telefonnummern) **vor** Versand
- Zeitstempel auf Minute aggregiert, keine Geolokation
- User wird im Consent-Screen darauf hingewiesen, dass Pseudonymisierung keine Anonymisierung ist

### 6.4 Zu R4 (Consent Gegenseite)
- **Strukturelle Entscheidung:** Nur der User wird psychologisch profiliert. Person B bekommt kein eigenes Profil.
- ToS-Klausel: User bestätigt, selbst Teilnehmer des Chats zu sein
- Pseudonymisierung mindert Identifizierbarkeit
- UI-Hinweis im Upload-Flow + Consent-Screen
- Kein Mehrfach-Chat-Aggregationslayer der Person B über mehrere Chats rekonstruieren würde

### 6.5 Zu R5 (Falsch-Interpretation)
- AI-Output-Tonalität explizit prompted: "No romantic forecasts", "no manipulation advice", "no coach talk"
- Disclaimer im Output ("A read, not a diagnosis. For the real stuff, see a professional.")
- Safety-Flag bei roten Mustern → Hilfelinks (DE 116 016, 0800 111 0 111 · US 1-800-799-7233, 988)

### 6.6 Zu R6 (Missbrauch)
- ToS-Klausel gegen Nutzung für Stalking/Manipulation
- House-Rules Checkbox im Upload bestätigt: Chat gehört dem User, keine Waffe
- Strukturell: keine Massen-Analyse-Features, keine Chat-Partner-Profile, keine Export-Features die Persönlichkeits-Dossiers von Gegenseite erstellen
- Safety-Flag im Output bei Gaslighting/Kontrolle/Drohungen → Hinweis auf Hilfe

### 6.7 Zu R7 (Drittland/Schrems II)
- Prüfung Anthropic-Zertifizierung nach EU-US Data Privacy Framework
- Falls DPF-Zertifikat: Transfer nach Art. 45 abgedeckt
- Falls nicht: SCCs (Modul 2 oder 3) + TIA
- Langfristig: Evaluation alternative Provider (AWS Bedrock EU-Region, Mistral EU, self-hosted)

### 6.8 Zu R8 (Lokale Speicherung)
- User-Aufklärung in Privacy Policy
- Settings-Seite mit "Delete all data"-Funktion (one-click Wipe)
- Zukünftig evaluieren: optionale Client-Side-Verschlüsselung für IndexedDB (mit User-Passwort)

### 6.9 Zu R9 (Prompt Injection)
- System-Prompt wrapped Chat-Content als Daten, nicht Instruktion
- Tool-Use-Schema erzwingt Output-Struktur — freie Text-Outputs sind durch Schema-Constraints limitiert
- Output-Validation: max_tokens gesetzt, Response wird gegen Schema geprüft

---

## 7. Maßnahmen nach Art. 32 (technisch/organisatorisch)

- **Verschlüsselung bei Übertragung:** TLS 1.3
- **Verschlüsselung in Anthropic (at rest):** laut Anthropic Standard
- **Zutrittskontrolle Proxy-Infrastruktur:** Provider-Standards (Vercel/Cloudflare)
- **Log-Minimierung:** kein Request-Body-Logging, keine IP-Logs
- **Updates:** Dependency-Updates regelmäßig
- **Incident-Response:** Breach-Plan ist Teil der ToS, 72h-Meldung dokumentiert

---

## 8. Betroffenenrechte operativ

| Recht | Umsetzung |
|------|----------|
| Art. 15 Auskunft | User hat alles lokal, wir haben nichts |
| Art. 16 Berichtigung | n/a (keine persistente Profildaten) |
| Art. 17 Löschung | Settings → Delete all data (ein Klick) |
| Art. 18 Einschränkung | n/a (keine weitere Verarbeitung ohne Auslöser) |
| Art. 20 Portabilität | Settings → Export all → JSON |
| Art. 21 Widerspruch | Keine Art. 6(1)(f)-Basis → nicht anwendbar |
| Art. 22 Automatisierte Entscheidungen | Analyse erzeugt keine rechtlichen/ähnlich erheblichen Entscheidungen — aber Disclaimer klar |
| Art. 77 Beschwerde | Privacy Policy nennt BayLDA etc. |

---

## 9. Restrisiko

Nach Umsetzung der Mitigations bleiben **niedrige bis mittlere Restrisiken** in den Bereichen:
- Re-Identifikation bei kontextreichen Chats (R3)
- US-Behördlicher Zugriff theoretisch möglich (R7)
- Sozialer Schaden durch Fehlinterpretation (R5)

Diese werden akzeptiert, weil:
- Die Verarbeitung nur auf User-Initiative + expliziter Einwilligung läuft
- Die User klar informiert werden
- Die Architektur Minimierung konsequent durchzieht
- Der Zweck (Selbstreflexion) für den User einen messbaren Wert hat

**Fazit:** keine **hohen Restrisiken**, keine vorherige Konsultation der Aufsichtsbehörde (Art. 36) erforderlich.

---

## 10. Konsultation

- **Betroffene/Stakeholder:** Im MVP noch keine strukturierte Einbindung; geplant über Beta-User-Feedback
- **DPO:** nicht bestellt; funktionale Rolle beim Controller
- **Aufsichtsbehörde:** keine vorherige Konsultation nach Art. 36 erforderlich (kein hohes Restrisiko)

---

## 11. Review-Zyklus

- **Jährlich** oder
- **Bei wesentlicher Änderung:** neues Modul, neuer Sub-Processor, neue Datenart, Änderung Rechtslage (z.B. neues Schrems III)

Nächste geplante Review: **2027-04-21**.

---

*DPIA V1 · 2026-04-21 · vertraulich · internes Dokument.*
