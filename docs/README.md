# tea

tea is a web app that analyzes exported WhatsApp conversations. The quantitative layer runs entirely in your browser — no data leaves your device. If you want a deeper read, you decide when that happens and exactly what gets sent.

The app shows patterns in your own communication. Not advice, not scores — just what is actually there in the data.

**Live:** https://chat-roentgen.vercel.app

---

## Installation

tea runs in the browser, so no installation is needed to use it. Open the link above and upload a WhatsApp export.

To run it locally for development:

1. Clone the repository: `git clone https://github.com/Nils43/chat-roentgen.git`
2. Move into the app directory: `cd chat-roentgen/roentgen`
3. Install dependencies: `npm install`
4. Create your environment file: `cp .env.example .env.local` and add your Anthropic API key
5. Start the dev server: `npm run dev` and open `http://localhost:3000`

For the full setup guide, see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

## Examples

Upload a WhatsApp `.txt` export and the app parses it locally. The Hard Facts module loads immediately — message split between participants, response times, who initiates conversations, emoji usage, and an activity heatmap by hour and day of week. None of this requires a server call.

If you unlock the AI modules, you get a profile of your own communication style, an analysis of the dynamic between both people, and a breakdown of the most significant moments in the chat. Moments are described as patterns, not quoted directly.

---

## Troubleshooting

**The file won't upload.**
The app currently supports WhatsApp `.txt` exports only. Make sure you chose "Without Media" when exporting and that the file extension is `.txt`. Files exported with media or renamed to a different extension will not be recognized.

**The parsing result looks incomplete or incorrect.**
WhatsApp export formats vary between iOS and Android and across different language settings. German-format exports use `DD.MM.YY, HH:MM:SS` timestamps, English-format exports use `MM/DD/YY, HH:MM AM/PM`. Both are supported, but edge cases exist. If your chat is not parsing correctly, open an issue on GitHub and attach a sanitized version of the file with names and personal details removed.

**Messages from one person are being attributed to the other.**
This can happen if a participant changed their display name at some point during the chat. WhatsApp records the name at the time of export, but older messages may carry a different name. This is a known limitation of the WhatsApp export format.

**The AI modules are not loading.**
If you are running locally, confirm that `ANTHROPIC_API_KEY` is set in your `.env.local` file and that you restarted the dev server after making changes. If you are on the live app and the modules stay loading for more than a minute, try refreshing the page and unlocking again — the session is not stored, but your payment carries over.

**The app is slow on large chats.**
Chats with more than 20,000 messages may take a few seconds to parse. This runs on your device, so performance depends on your hardware. The AI modules also take longer because more content needs to be sampled and sent.

---

## Changelog

**V1 — current**
- WhatsApp `.txt` parser for German and English export formats
- Hard Facts module: message split, response times, question ratio, conversation initiation, hedge word frequency, emoji density, activity heatmap, engagement curve over time — runs entirely in the browser, no server contact
- Profile module: AI-generated analysis of the user's own communication style, based on patterns in their messages only
- Highlights module: AI-generated description of the most significant moments in the chat, described as behavioral patterns without quoting original messages directly
- Consent screen before any AI call, showing the exact number of messages being sent and how they are handled
- Pseudonymization of names before any data leaves the browser
- Privacy indicator showing local vs. AI-active state throughout the session
- Stripe payment integration for single chat unlock

**V2 — planned**
Telegram and Instagram parser support, Dynamics module, Development module, Timeline visualization, share-as-image export with automatic anonymization, subscription model.

**V3 — planned**
Multi-chat comparison, Discord and iMessage support, localization.

---

## User Flow

This diagram shows the path a typical first-time user takes through tea, from landing on the site to saving their first insight.

```mermaid
flowchart TD
    Start([User opens<br/>chat-roentgen.vercel.app])
    
    Step1[User reads pitch<br/>and privacy note]
    Dec1{Trusts tea<br/>enough to upload?}
    Exit1([User leaves<br/>the site])
    
    In1[/User exports<br/>WhatsApp chat<br/>from phone/]
    In2[/User drops txt file<br/>into tea/]
    Proc1[tea parses chat<br/>locally in browser]
    Step2[User reads<br/>Hard Facts:<br/>message split,<br/>response times,<br/>heatmap]
    
    Dec2{Wants deeper<br/>AI analysis?}
    Out1[/User saves<br/>screenshot of<br/>Hard Facts/]
    
    Step3[User reads<br/>consent screen<br/>data counter shown]
    Dec3{Agrees to<br/>send sample?}
    
    In3[/User pays<br/>via Stripe<br/>single unlock/]
    Proc2[tea pseudonymizes<br/>names in browser]
    Proc3[Sample sent<br/>to Claude API]
    Step4[User reads Profile<br/>and Highlights]
    
    Out2[/User saves<br/>anonymized<br/>share card/]
    End([Session ends<br/>no account, no trail])
    
    Start --> Step1
    Step1 --> Dec1
    Dec1 -->|No| Exit1
    Dec1 -->|Yes| In1
    In1 --> In2
    In2 --> Proc1
    Proc1 --> Step2
    Step2 --> Dec2
    Dec2 -->|No| Out1
    Out1 --> End
    Dec2 -->|Yes| Step3
    Step3 --> Dec3
    Dec3 -->|No, stay local| Step2
    Dec3 -->|Yes| In3
    In3 --> Proc2
    Proc2 --> Proc3
    Proc3 --> Step4
    Step4 --> Out2
    Out2 --> End
    
    classDef startNode fill:#16140F,stroke:#16140F,stroke-width:2px,color:#ECFD38,font-weight:bold
    classDef endNode fill:#ECFD38,stroke:#16140F,stroke-width:2px,color:#16140F,font-weight:bold
    classDef process fill:#F0EBE0,stroke:#16140F,stroke-width:1px,color:#16140F
    classDef decision fill:#FFFAE0,stroke:#16140F,stroke-width:2px,color:#16140F
    classDef io fill:#E3DCCB,stroke:#16140F,stroke-width:1px,color:#16140F
    
    class Start startNode
    class End,Exit1 endNode
    class Step1,Step2,Step3,Step4,Proc1,Proc2,Proc3 process
    class Dec1,Dec2,Dec3 decision
    class In1,In2,In3,Out1,Out2 io
```

---

## Additional resources

- [`Concept.md`](./Concept.md) — architecture and design rationale
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — contribution guidelines
- [`tea_konzept.md`](../tea_konzept.md) — product concept document (German)

---

## License

MIT. Free to use, copy, modify, and distribute this code, as long as the original copyright notice is included.

---

## Maintained by

Antonia and Nils Heck — CODE University of Applied Sciences, Berlin

