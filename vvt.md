# Verzeichnis von Verarbeitungstätigkeiten · tea

> Art. 30 DSGVO. Internes Dokument. Wird auf Anfrage der Aufsichtsbehörde vorgelegt, **nicht** im Produkt angezeigt.
> Stand: 2026-04-21. Review bei jeder Architekturänderung.

---

## 0. Verantwortlicher

| Feld | Wert |
|------|------|
| Name | [Your Name / Company] |
| Anschrift | [Street, Postal Code, City, Country] |
| E-Mail | [contact@your-domain] |
| Datenschutzbeauftragter | Nicht bestellungspflichtig; funktionale Rolle beim Controller |
| Zuständige Aufsichtsbehörde | [z.B. BayLDA — Bayerisches Landesamt für Datenschutzaufsicht] |

---

## VT-01 · On-Device Analyse (Hard Facts)

| Feld | Inhalt |
|------|--------|
| **Zweck (Art. 30(1)(b))** | Quantitative Analyse des vom User hochgeladenen Chats zur Selbstreflexion. |
| **Kategorien Betroffene** | Nutzer; Chat-Teilnehmer:innen (Person B) — nur indirekt. |
| **Kategorien Daten** | Chat-Nachrichten (Text, Zeitstempel, Author). Enthält potenziell besondere Kategorien nach Art. 9. |
| **Rechtsgrundlage** | Haushaltsausnahme Art. 2(2)(c) DSGVO für den User. Technisch notwendige Speicherung nach §25 Abs. 2 Nr. 2 TDDDG. |
| **Empfänger** | Keine. Ausschließlich browserlokal (IndexedDB, localStorage). |
| **Drittland-Transfer** | Nein. |
| **Speicherdauer** | Bis zur User-Löschung (per Chat oder "Delete all data" in Settings). |
| **Technische/organisatorische Maßnahmen** | Keine Server-Kommunikation; XSS-Prevention im Parser (Text-Rendering, keine HTML-Interpolation); Dateigrößen-Limit beim Upload; kein Logging. |

---

## VT-02 · AI-gestützte Analyse (Personal + Relationship)

| Feld | Inhalt |
|------|--------|
| **Zweck** | Vertiefende psychologische Interpretation des eigenen Kommunikationsmusters (Personal) bzw. der Paar-Dynamik (Relationship). |
| **Kategorien Betroffene** | Nutzer (mit Einwilligung); Chat-Teilnehmer:innen (pseudonymisiert, nicht profiliert). |
| **Kategorien Daten** | Pre-computed Evidence Packet (~500 Tokens JSON): Statistiken, Tone-Hints, Flags, pseudonymisierte Namen. 12 kuratierte Nachrichten-Ausschnitte (≤ 140 Zeichen je Moment), pseudonymisiert und PII-gescrubbt. Potenziell besondere Kategorien (Art. 9). |
| **Rechtsgrundlage** | Art. 6(1)(a) Einwilligung + Art. 9(2)(a) explizite Einwilligung (Consent-Screen pro Analyse). |
| **Empfänger** | Anthropic PBC (Auftragsverarbeiter, USA) via eigenen Proxy. |
| **Drittland-Transfer** | Ja — USA. Safeguards: DPA mit Anthropic, EU SCCs (Modul 2), ggf. EU-US Data Privacy Framework (Art. 45), TIA dokumentiert. |
| **Speicherdauer** | Auf tea-Seite: nicht gespeichert (transient im Proxy-RAM). Auf Anthropic-Seite: bis zu 30 Tage Trust & Safety Retention, dann Auto-Löschung. Kein Training. |
| **Technische/organisatorische Maßnahmen** | TLS 1.3 ende-zu-ende; kein Body-Logging im Proxy; API-Key nur server-side; Pseudonymisierung + PII-Scrubbing vor Versand; Request-Size-Cap 500 KB; Tool-Use-Schema begrenzt Output-Form; Prompt-Injection-Guards im System-Prompt. |

---

## VT-03 · Local Session Storage

| Feld | Inhalt |
|------|--------|
| **Zweck** | Wiedereröffnung bereits analysierter Chats ohne erneuten Upload; Persistenz von AI-Ergebnissen. |
| **Kategorien Betroffene** | Nutzer; Chat-Teilnehmer:innen. |
| **Kategorien Daten** | Chat-Rohtext + berechnete Ergebnisse (HardFacts, ProfileResult, RelationshipResult), Metadaten (Dateiname, Teilnehmer, Zeitraum). |
| **Rechtsgrundlage** | Art. 2(2)(c) Haushaltsausnahme / §25(2) TDDDG (technisch unbedingt erforderlich für Kern-Funktion). |
| **Empfänger** | Keine. Nur im Browser des Users. |
| **Drittland-Transfer** | Nein. |
| **Speicherdauer** | Bis zur User-Löschung. One-Click-Wipe verfügbar (Settings → Delete all data). |
| **Technische/organisatorische Maßnahmen** | IndexedDB + localStorage scope-gebunden auf Origin; kein Cross-Site-Zugriff; Export-Funktion für Art. 20. |

---

## VT-04 · Asset-Delivery (Fonts)

| Feld | Inhalt |
|------|--------|
| **Zweck** | Laden der UI-Schriften (Bebas Neue, Courier Prime). |
| **Kategorien Betroffene** | Webseiten-Besucher. |
| **Kategorien Daten** | IP-Adresse + User-Agent beim Font-Fetch (technisch unvermeidbar bei HTTPS-Assets). |
| **Rechtsgrundlage** | Art. 6(1)(f) Berechtigtes Interesse (funktionale Darstellung). |
| **Empfänger** | BunnyWay d.o.o. (bunny.net / Bunny Fonts), Slowenien (EU). |
| **Drittland-Transfer** | Nein (EU-basiert, GDPR-konformes CDN, kein IP-Logging laut Anbieter). |
| **Speicherdauer** | Kein persistentes Speichern durch tea. Bunny Fonts loggt laut eigener Policy keine IP-Adressen. |
| **Technische/organisatorische Maßnahmen** | Bunny Fonts statt Google Fonts gewählt explizit wegen GDPR-Konformität (LG München 2022, 3 O 17493/20). Preconnect + TLS. |

---

## VT-05 · Hosting / Deployment

| Feld | Inhalt |
|------|--------|
| **Zweck** | Ausliefern der statischen Assets und des API-Proxys. |
| **Kategorien Betroffene** | Webseiten-Besucher. |
| **Kategorien Daten** | IP-Adresse, User-Agent, Request-URL (Standard-Webserver-Metadaten, transient, nicht persistiert). |
| **Rechtsgrundlage** | Art. 6(1)(f) Berechtigtes Interesse (Betrieb der Webseite). |
| **Empfänger** | [Hosting-Provider — z.B. Vercel Inc. (USA) oder Cloudflare Inc. (USA)]. |
| **Drittland-Transfer** | [Ja, falls USA — SCCs + DPF wenn zertifiziert]. Falls EU-Region gewählt: nein. |
| **Speicherdauer** | Request-Log laut Provider-Default. IP-Logs auf tea-Seite: keine. |
| **Technische/organisatorische Maßnahmen** | TLS 1.3; HSTS; CSP (Content Security Policy); keine Request-Body-Logs; Proxy-Code Open-Source-fähig für Audit. |

---

## VT-06 · Betroffenenrechte-Prozess

| Feld | Inhalt |
|------|--------|
| **Zweck** | Umsetzung von Auskunfts-/Löschungs-/Portabilitäts-Anfragen nach Art. 15, 17, 20 DSGVO. |
| **Kategorien Betroffene** | Nutzer; theoretisch jede betroffene Person, die einen Antrag stellt. |
| **Kategorien Daten** | Identifikations-Daten der antragstellenden Person (Name, Kontakt-E-Mail), soweit für die Bearbeitung nötig. |
| **Rechtsgrundlage** | Art. 6(1)(c) Rechtliche Verpflichtung (DSGVO-Compliance). |
| **Empfänger** | Keine. |
| **Drittland-Transfer** | Nein. |
| **Speicherdauer** | Auftragskorrespondenz nach Verfahrensabschluss max. 3 Jahre aus Rechenschaftspflicht (Art. 5(2)). |
| **Technische/organisatorische Maßnahmen** | In-App: Settings → Export / Delete all. E-Mail-Kontakt für Anträge im Impressum + Privacy Policy. Manuell bearbeitet mit 1-Monats-Frist nach Art. 12(3). |

---

## 1. Übergreifende technisch-organisatorische Maßnahmen

- **Vertraulichkeit:** TLS 1.3 ende-zu-ende; API-Key server-side; keine Body-Logs.
- **Integrität:** Kein persistentes Chat-Content-Storage auf Server-Seite; Tool-Use-Schema validiert AI-Output.
- **Verfügbarkeit:** Provider-Standards; kein aktiver DR-Plan nötig mangels persistentem Server-State.
- **Belastbarkeit:** Rate-Limit im Proxy (über Hosting-Provider-Standards); Size-Cap 500 KB pro Request.
- **Überprüfung:** Jährliche Review dieses VVT, der Privacy Policy und des DPIA; Dependency-Updates laufend.

---

## 2. Liste Auftragsverarbeiter (Art. 28)

| Nr. | Name | Zweck | Vertrag | Region |
|----|------|-------|---------|--------|
| 1 | Anthropic PBC | AI-Inferenz | DPA + SCCs + (ggf.) DPF | USA |
| 2 | [Hosting-Provider] | Static + Proxy Hosting | DPA | [EU oder USA mit SCCs] |
| 3 | BunnyWay d.o.o. | Font-CDN | DPA vorhanden (Bunny DPA) | EU (Slowenien) |

---

## 3. Änderungshistorie

| Version | Datum | Änderung |
|---------|-------|----------|
| 1.0 | 2026-04-21 | Erstversion |

---

*VVT V1 · 2026-04-21 · vertraulich · internes Dokument nach Art. 30 DSGVO.*
