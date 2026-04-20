# Design System — Receipts Edition

> Bindend für alle UI-Entscheidungen. Ersetzt alle früheren visuellen Vorgaben aus `tea_brand_reference.md` und `chat-roentgen-konzept.md`.
> Wenn der Code und dieses Dokument sich widersprechen, wird das Dokument angepasst, nicht der Code — dieser Design-Stand ist der Ground Truth.

---

## 1. Was es ist

Ein Tabloid-Dossier fürs eigene Leben. Forensic-Gossip-Ästhetik: Bubblegum-Pink-Hintergrund, schwarze Tinte, gelber Akzent, harte Schatten ohne Blur, leicht schief getackerte Karten, laute Display-Headlines. Ein Chat-Report, der aussieht wie eine Beweiskiste in einem Tatort-Podcast.

**Self-description im Header:** *"forensic gossip os · vol. iii"* — das ist nicht Ironie, das ist das Genre.

**Vibe-Referenzen:**
- Zine- und Fanzine-Layouts, kopiert und getackert
- Tabloid-Titelseiten mit riesigen Serif-Versalien
- Detective-Pinwand mit Fotos, Markern und Notizen
- Aktenordner mit Exhibit-Labels und Dienststempeln
- Spy-vs-Spy, Lüge+Wahrheit, 70s-Crime-Jacket

**Was es nicht ist:**
- Kein SaaS-Dashboard
- Kein Wellness-App-Pastell
- Kein minimalistisches Editorial
- Kein Paper/Ink/Fraunces-Serif (das war eine alte Richtung — ist abgelöst)
- Kein Dark Mode
- Kein Material Design, kein iOS-Style

---

## 2. Farbpalette

| Name | Hex | Rolle |
|------|-----|-------|
| **pink** | `#FF90BB` | Page-Background. Bubblegum, nicht pastellig. Immer als Body-BG sichtbar. |
| **ink / black** | `#0A0A0A` | Text, Borders, harte Schatten, Buttons, Stempel. Das Strukturprinzip. |
| **white** | `#FFFFFF` | Karten-Oberfläche, "Papier". Nur auf Karten, nie als Seiten-BG. |
| **yellow** | `#FFE234` | Akzent-Primärfarbe: Sticker, Buttons, "done"-States, Completion-Chips. |
| **acid** | `#ECFD38` | Highlighter-Gelb (Marker-Strich). Schärfer, punchier. Nur für `.mark`. |
| **sky** | `#7CC9FF` | Selten — extra Personenfarbe bei Gruppenchats. |
| **purple** | `#C084FF` | Selten — extra Personenfarbe bei Gruppenchats. |

**Ink-Abstufungen für Text:**
- `ink` (`#0A0A0A`) — Haupttext
- `ink/72` (muted) — sekundärer Text
- `ink/48` (faint) — Metadaten
- `ink/40` oder `/60` — Labels, Hints

**Personenfarben:**
- **Person A** — solid black (`#0A0A0A`) + Variants (dim, deep, glow)
- **Person B** — yellow (`#FFE234`) + Variants — braucht immer schwarzen Kontext (border oder BG) für Lesbarkeit
- Person C, D — sky, orange, purple (nur Gruppenchats)

**Regeln:**
- Gelb ist **Akzent**, nicht Dekor. Ein Element pro Screen dominiert gelb (Sticker ODER Button ODER ein markiertes Wort) — nicht alle gleichzeitig.
- Acid-Yellow nur als Marker-Highlight über einem Wort. Nie als BG für größere Flächen.
- Schatten sind immer `#0A0A0A`, nie halbtransparent, nie blurred.

---

## 3. Typografie

Drei Schriften, strenge Rollen:

| Schrift | Rolle | Größen | Quelle |
|---------|-------|--------|--------|
| **Bebas Neue** | Display — riesige Hero-Versalien, große Metric-Numbers | `text-[14vw]` bis `text-[20vw]` für Hero, 3xl–6xl für Module-Titel | Google Fonts |
| **Courier Prime** | Alles andere — Body, UI-Labels, Gossip-Italic-Voice, Buttons, Sticker | 10–18px UI, 16–20px Body | Google Fonts |
| **Courier Prime Italic** | Voice-Ebene — wenn das Produkt "spricht" | 16–20px | Google Fonts |

**Keine** Fraunces, keine Inter, keine JetBrains Mono, keine Instrument Serif. Die Reduktion auf zwei Familien ist Feature — sie erzeugt die Fanzine-Konsistenz.

**Typografie-Rollen in Klassen:**

- `.metric-num` — Bebas Neue, `letter-spacing: 0.01em`, `line-height: 0.9`. Für die großen Zahlen.
- `.font-serif` → Bebas Neue (Tailwind-Alias). Für Hero-Versalien wie "LEAKS", "RECEIPTS", "PROFILES".
- `.label-mono` — Courier Prime bold, 11px, `letter-spacing: 0.16em`, uppercase. Für Meta-Labels über Sektionen und Tiles.
- `.serif-body` — Courier Prime **italic**, normale Größe, für Prose-Text. Das ist die "Gossip-Typewriter-Voice", trotz des `serif-` im Namen.
- `.pill-pop` — Courier Prime 10px uppercase auf schwarzem BG — für Pills mit pulsendem Dot.
- `.sticker` — Bebas Neue 14px, gelber BG — für das kursive "✦ THAT'S YOU"-Element.
- `.btn-pop` — Bebas Neue 18px, gelber BG, harte schwarze Border + 3px Schatten.
- `.exhibit-label` — Courier Prime 10px uppercase, weiß auf schwarz, absolut positioniert als Tab oben links auf Karten, rotiert `-2deg`.

**Hero-Formel (Page-Bleed):**
```
<div class="label-mono">intel · alice & bob · as of 04.18.2026</div>
<h1 class="font-serif text-[20vw] md:text-[180px] leading-[0.85] tracking-[-0.01em]">
  LEAKS
</h1>
```
Ein einzelnes Versal-Wort, riesig, pro Hauptbildschirm. **LEAKS** (Library), **RECEIPTS** (Hard Facts), **PROFILES** (Profile), etc. Das ist die wichtigste typografische Geste der App.

---

## 4. Layout-Prinzipien

**Grid:** `max-w-6xl mx-auto px-4 md:px-6`. Enge, dichte Layouts — kein Editorial-Whitespace.

**Seiten-Rhythmus (Hard Facts Standard):**

```
[Hero-Bleed: Versalien-Wort + Date-Label]
   ↓
[Quote-Box mit EXHIBIT-0-Label — der Premise-Absatz]
   ↓
[4er Tile-Grid — topline numbers]
   ↓
[Whisper — kleiner italic Courier-Absatz als Übergang]
   ↓
[Section 01 · Distribution — mit Kicker + Title + Body + Chart]
   ↓
[InlineTeaser — "finding + question" als CTA-Karte]
   ↓
[Section 02 · Speed] ...
   ↓
[BridgeCTA — Paywall-Bruch zur Tiefe]
   ↓
[Locked-Card-Grid — was noch wartet]
```

**Jede "Section" folgt:**
- `label-mono` Kicker oben: `"01 · Distribution"` — Nummer + Mittelpunkt + kleines Wort
- `font-serif` Title (Bebas Neue, groß)
- `serif-body` Body (Courier Italic)
- Chart oder Interaktion darunter

**Tilts & Rotation:**
- Karten dürfen leicht schräg sein: `rotate(-0.3deg)` bis `rotate(-1.4deg)`, für Library-Cards bis zu `1.1deg` positiv
- Array `TILTS = [-1.4, 0.6, -0.8, 1.1, -0.4, 0.9]` wird modulo-zyklisch auf eine Grid-Liste angewandt — gibt pro Seite einen lebendigen Rhythmus
- Sticker-Badges sind stärker gedreht: `rotate(-2deg)` bis `8deg`
- Nie über 3° für Karten — sonst wirkt es slapstick statt gossip

**Mobile-first:** Die Hero-Versalien skalieren über `text-[20vw]` — auf dem Handy werden sie automatisch groß und bleiben auf Desktop absolut `text-[180px]`. Das ist Teil des Looks.

---

## 5. Komponenten-Katalog

### `.card`
```css
@apply bg-white border-2 border-ink rounded-none p-6 md:p-8;
box-shadow: 4px 4px 0 var(--black);
```
Weiße Fläche, **scharfe schwarze 2px-Border**, **harter 4px-4px-Schatten** (kein Blur). Rounded-none — keine Ecken-Rundung. Padding 24–32px.

### `.exhibit-label`
Absolut positionierter schwarzer Tab oben links an einer Karte, weiß auf schwarz, Courier Prime 10px, letter-spacing `0.12em`, uppercase, rotiert `-2deg`. Der wichtigste "tabloid evidence"-Marker der App. Immer kurz (2–4 Wörter): "EXHIBIT 0: PREMISE", "EXHIBIT 03: LOCKED", "EXHIBIT 99: HOUSE RULES".

### `.sticker` / `.sticker-tilt`
Gelber Hintergrund, 1.5px schwarzer Border, 2px-2px harter Schatten, Bebas Neue 14px. Für "✦ THAT'S YOU" oder "ALL FILES ✦"-Badges an Karten-Ecken. `.sticker-tilt` hat `rotate(-2deg)` mit Hover auf `rotate(2deg)` — das "peel and stick"-Gefühl.

### `.btn-pop`
Primärer Button. Gelber BG, schwarze 2px-Border, 3px-Schatten, Bebas Neue 18px uppercase, letter-spacing `0.04em`. Hover: BG wird weiß, Button verschiebt sich `-1px/-1px`, Schatten wächst auf 4px. Active: BG drückt `1px/1px` rein, Schatten schrumpft auf 1px. Das ist das Kernspiel der Motion.

### `.pill-pop`
Schwarzer BG, weißer Text, Courier Prime 10px uppercase `0.16em`-Tracking. Wird für Status-Chips verwendet ("100% private · nobody reads along", "preview label"). Oft mit einem **pulsierenden kleinen farbigen Dot** davor — der "Aktivität"-Signal der App.

### `.mark`
Der Highlighter. Acid-Yellow linear-gradient (mit minimalem Fade-In/Fade-Out an den Rändern, damit es wirklich wie ein physischer Marker aussieht), Padding `0 0.18em`, negative margin zum Überlappen, `rotate(-0.3deg)`. Nur für Markierung **einzelner Wörter**, max 1–2 pro Satz.

### `.quote-box`
Weiß mit schwarzer Border, Courier Prime **italic**, 4px-Schatten, relatives Padding `18px 20px`. **Immer mit `exhibit-label`-Tab oben links** (`position: absolute; top: -10px`). Das ist der "screenshottable evidence block" der App — mit Stempel.

### `.circled`
Handgezeichneter Kreis um ein Wort — zweiter Absatz Position, schwarze 2px-Border, `border-radius: 50%`, leicht rotiert und vertikal gestaucht. Für Personen-Namen im Prose: "Between <circled>Alice</circled> and <circled>Bob</circled>".

### `.redact-line`
Schwarzer Zensurstrich: `display: block; background: black; height: 14px; margin: 8px 0`. Für "hier steht was, du darfst es noch nicht sehen" — Paywall-Teaser.

### `.black-box`
Inverse Karte: schwarzer BG, weißer Text, 4px-Schatten. Für Kontrast-Punkte ("TOXICITY LEVEL"), Refusal-Cards, Meta-Blöcke.

### `.gradient-text` / `.gradient-text-cool`
Nicht wirklich ein Gradient. Schwarzer Text auf **gelbem** (bzw. weißem mit schwarzer Border) BG, `box-decoration-break: clone`. Für einzelne Schlüsselwörter mitten im Hero-Text: "Drop your **chat**." wo "chat" gelb unterlegt ist.

### `.gradient-border`
Hart-schwarze 2px-Border + 4px-Schatten + `rounded-none`. Für Upload-Drop-Zones und andere "Drop-it-here"-Zonen.

### `.dotgrid`
Radial-Gradient mit maskierter Ellipse — für subtile Halbton-Textur-Overlays auf Drop-Zones. Das halftone-BG des Body ist das gleiche Pattern auf Gesamtpage-Niveau.

### `.shimmer-bg`
Linear-Gradient-Shimmer-Animation für "wait/loading"-States. Verwendet für geblurrte Paywall-Previews.

---

## 6. Motion

Schnell, popig, physisch. Keine weichen Easings außer wo explizit "smooth" gewollt ist.

**Keyframes im System:**
- `count-up` — Zahl fadet hoch + `translateY(8px→0)` in 600ms
- `fade-in` — 800ms
- `slide-up` — `translateY(20px→0)` in 600ms
- `pulse-soft` — 2.5s — für die Dot-Indicator in Pills
- `pop-in` — `scale(0.7) rotate(-3deg) → overshoot scale(1.04) rotate(1deg) → 1/0deg` mit Back-Easing (Ziel-Cubic `0.34, 1.56, 0.64, 1`)
- `wobble` — 2.6s Rotation `-4deg ↔ 4deg`
- `float-slow` / `float-med` — vertikales Atmen von Deko-Elementen (6s / 4.2s)
- `shimmer` — Gradient-Sweep für Loading-Skeletons
- `spin-slow` — 14s komplette Rotation für Deko-Spinner

**Hover-Regeln:**
- Karten: `translate(-2px, -2px)` bei Hover. "lift and tack again"
- `.btn-pop`: lift + größerer Schatten
- `.sticker-tilt`: flippt die Rotation zur anderen Seite
- Nie Shadow-Blur erhöhen — Schatten bleiben hart

**Nicht verwenden:**
- Weichzeichner (blur) für Shadows
- Gradient-Übergänge zwischen Farben (außer für `animated-gradient-text` Deko, selten)
- Lange (>1s) Smooth-Transitions für UI-Elements
- Parallax
- Spinning-Loader — nutze `shimmer-bg` oder `pop-in` sequenziert

---

## 7. Voice in UI-Copy

Der Ton im Code ist etabliert und bleibt:

- **Kleinbuchstaben dominieren** im Running-Text ("nothing here yet", "drop a chat")
- **VERSALIEN** in Hero-Worten ("LEAKS", "RECEIPTS", "EXHIBIT 99: HOUSE RULES", "I AM ALICE")
- **Detective/Tabloid-Slang**: "leaks", "receipts", "intel", "shred", "leak", "spill the tea", "files"
- **Direkte Anrede** ("honey", "you'll be sharper than 90% of people")
- **Keine Coach-Formulierungen**: kein "self-love", "energy", "authentic being"
- **Keine Fragezeichen-Ketten am Ende**: statt "How does that feel?" lieber "That shifted in April."
- **Datums-Stempel wie Aktenzeichen**: "as of 04.18.2026"
- **Verben aktiv**: "tap a card to open", "drop a WhatsApp export"

**Für Buttons:** kurze Verben, Versalien, optional Pfeil:
- `NEW LEAK`
- `UPLOAD FIRST LEAK`
- `UNLOCK ALICE`
- `TOP UP TICKETS`
- `SHOW THE DYNAMIC →`

---

## 8. Seiten-Rezepte

### Hero-Bleed
Kombination aus **Datum-Mono-Label** + **riesiges Versalien-Wort** + optional **kleine Copy-Zeile** oder **Button**. Immer links ausgerichtet, leading fast 0.85, tracking leicht negativ. Das einzelne Wort *bricht* visuell in die Seite ein.

### Section-Formel
```
[label-mono: "04 · Signal"]  [title: "Who holds on at night?"]
[serif-body body-text]
[chart / viz / interaction]
[optional InlineTeaser unten — "finding · question · CTA"]
```

### InlineTeaser
Nach jeder Sektion: eine compact Card mit einem **konkreten Finding** (eine Zahl, ein Name) + einer **aufgeworfenen Frage** + Button. Das ist der kontinuierliche Paywall-Nudge ohne Pressure.

### BridgeCTA
Seitenmitten-Bruch zwischen den freien Findings und dem geblurrten Rest. Setzt den Übergang emotional: "spill the tea · 10 findings down · now the real read begins".

### Locked-Card-Grid
2-Spalten-Grid mit geblurrten Preview-Karten der kostenpflichtigen Module. Jede Karte hat:
- Nummer (02, 03, 04, 05)
- Kurzer Emoji
- Titel ("Who's who?")
- 3 Teaser-Lines die anfangen und mit "…" brechen
- CTA-Button (UNLOCK / TOP UP)

### Library-Card
Als `ChatCard`: weiße Karte mit `exhibit-label` "EXHIBIT 01: WHATSAPP LOG", Personen-Namen als `font-serif` Versalien, Courier-Metadaten (Messages, Zeitraum), unten eine Reihe von Module-Chips (gelb wenn fertig, outlined wenn nicht). Tilt aus dem `TILTS`-Array, Schatten 6px.

---

## 9. Spezial-Elemente

**Halftone-Overlay:** Das ganze Body bekommt einen subtilen radial-gradient dot-pattern bei `opacity: 0.08`, `background-size: 8px 8px`. Sorgt für die "gedruckt" Textur ohne Dominanz.

**Scrollbar:** Pink Track, schwarzer Thumb mit 2px pinkfarbenem Innen-Border — die Scrollbar selbst ist Teil des Designs.

**Text-Selection:** Gelb auf Schwarz.

**Person-Marker im Body-Text:** Namen von Personen dürfen im Copy-Text mit `.circled` umkreist werden (handgemacht-Effekt).

---

## 10. Hart-Don'ts

- Kein Paper/Ink/Fraunces-Editorial-Look
- Kein Dark Mode als Default-Theme
- Kein Material Design, keine Gradient-BGs außer `pop-hero` u.ä. als bewusst gewählte Deko
- Keine Emoji-Parade in Buttons (einzelne Pop-Emojis OK: ✦, ＋, ×)
- Keine Soft-Shadows / Glow-Effekte (außer gezielt als `glow` für Person-Farben mit `blur-3xl` Hintergrund-Effekte)
- Keine Tabs (vertikaler Scroll dominiert)
- Keine Chat-Bubbles als generisches UI-Element (das ist die alte Richtung — raus)
- Kein Inter, kein Roboto, kein Arial
- Keine Lowercase-Tags an den Stellen wo VERSALIEN leben (Hero-Worte, Sticker, Exhibit-Labels, Buttons)

---

## 11. Bestehender Code als Referenz

Maßgebliche Dateien:

- `roentgen/tailwind.config.js` — Farb- und Schriftdefinitionen
- `roentgen/src/index.css` — Die Component-Klassen (`.card`, `.exhibit-label`, `.sticker`, `.btn-pop`, `.mark`, `.quote-box`, `.circled`, `.redact-line`, `.black-box`)
- `roentgen/src/components/Library.tsx` — Hero-Bleed + Chat-Card-Pattern
- `roentgen/src/components/HardFactsView.tsx` — Section-Rhythmus, InlineTeaser, BridgeCTA, LockedCard
- `roentgen/src/components/Upload.tsx` — Drop-Zone mit Halbton + Exhibit-Label
- `roentgen/src/App.tsx` (Header + Nav) — `tell.` Wordmark (nun `tea.`) und Bottom-Nav

Bei neuen Views zuerst diese Dateien lesen, dann bauen.

---

## 12. Änderungen an diesem Dokument

Dieses Dokument ist der Ground Truth. Wenn eine neue UI-Idee hier nicht reinpasst, wird **zuerst** entschieden, ob das Dokument erweitert wird — nicht "stillschweigend" ein anderer Look eingeführt. Code darf nie silently vom Dokument abweichen.

---

*Design System V1 — Receipts Edition — 2026-04-20. Live-Dokument.*
