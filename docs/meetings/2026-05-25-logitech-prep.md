# Meeting Prep — Logitech keyboard leads

**Meeting title:** *Voice app Idea*
**Counterparty:** Logitech — senior MX-team leadership exploring a voice/dictation product (possibly hardware-integrated)
**My posture:** Yappr is a **solo / founder-led project**, still in beta with no public users. Don't oversell as a team. The pitch is: *Logitech* should build the hardware-integrated dictation product; Yappr brings the polish/software IP and would partner / power it. Strength is the product, not the org chart.

**Goal of meeting:** Trade notes, learn what Logitech is building, and surface a partnership angle (Yappr as the software layer behind Logitech-branded hardware). Walk away with at least one concrete follow-up.

---

## 0. Who's in the room

This is a senior room — VP/GM + VP of MX + MX product head + tech office head. Read: strategic-level conversation, not a junior PM scoping call.

| Attendee | Role | Read |
|---|---|---|
| **Delphine Donné** *(organizer)* | VP / General Manager, Personal Workspace Solutions (mice, keyboards, cameras, lights, mics). 25+ years at Logitech. Lausanne. | The decision-maker. Pitch should ladder up to *strategy and category positioning* — why dictation matters for the workspace business, not just feature talk. [LinkedIn](https://www.linkedin.com/in/delphinedonne/) |
| **Anatoliy Polyanker** | VP / Head of Logitech MX. Lausanne. Owns the MX (premium) brand. | Brand and positioning lens. Cares about how dictation fits MX's "professional / power user" identity and pricing tier. [LinkedIn](https://ch.linkedin.com/in/apolyanker) |
| **Jean-Christophe Hemes** | Director, Head of Product & Innovation — MX Business. 10+ yrs PM. Holds patents. Lausanne. | The product lead who'd actually own building it. Will ask the hardest "how does this actually work / what's the spec" questions. Most aligned audience for the per-app polish + dictionary + context-engineering depth. [LinkedIn](https://www.linkedin.com/posts/jhemes_pmf21-productmanagement-activity-6864964707879661568-_W7t) |
| **Jean-Michel Chardon** | Head of Logitech Technology Office, Site Leader. Works on novel input modalities — MX Ink stylus, Creative Console SDKs, AI/ML. Lausanne. | Technical credibility check. Cares about the *new input modality* angle — voice as an input class alongside keys/mouse/stylus. Will dig into latency, on-device vs. cloud, SDK extensibility. [LinkedIn](https://www.linkedin.com/in/jchardon/) |

**Implications for how to present:**
- Lead with **category framing** (voice as the next MX input modality) before features — Delphine and Anatoliy live at that altitude.
- Have depth ready on **per-app polish, context engineering, dictionary** for Hemes.
- Have depth ready on **latency, on-device path, SDK extensibility (Logi Options+ hooks)** for Chardon.
- All four are Lausanne-based — meeting likely in CET-friendly hours.

---

## 1. 30-second elevator pitch — Yappr

> Yappr is push-to-talk voice dictation for macOS. Hold Right Option, speak, release — cleaned-up text lands wherever your cursor is. Three things make it different from Wispr Flow and Superwhisper:
>
> 1. **Polish is per-app.** Slack stays casual, Gmail keeps the greeting, terminal stays command-shaped, code editors preserve camelCase / snake_case / file paths.
> 2. **Context engineering for AI tools.** When you're talking to Claude / Cursor / ChatGPT / Notion AI, Yappr restructures the message so the AI understands it — not just transcription, but prompting.
> 3. **Background context.** Yappr asks who you are at setup and updates its understanding every 50 dictations. The polish gets sharper the longer you use it.
>
> Plus a user dictionary for names/jargon, a local whisper.cpp fallback, and a privacy story by design — no screenshots, no telemetry.

**Business model — lead with this:** Yappr is a **managed software product on a $10/mo subscription.** Inference (STT + polish) runs through Yappr's own backend; users pay monthly for the full experience. The freemium tier (2,000 words/week) is the on-ramp. This is the model — *not BYOK, not "bring your own Groq key."*

**One-liner:** *"Wispr Flow, but the polish actually fits the app you're typing into — and it learns you over time. Managed service, monthly subscription."*

> ⚠️ **Framing note for the room:** Don't talk up "BYOK" or "Groq API" as the angle. Those are *current implementation details* — the way it's wired today, not the business. The business is **managed inference, monthly recurring revenue.** Groq happens to be our STT provider behind the proxy; it could be Deepgram tomorrow. Users don't know or care.

> **For deeper context, just send / point at:**
> - Landing page: `yappr.app` (sections: hero, three behaviors, per-app polish, AI coding, dictionary, privacy, pricing)
> - Pricing and unit economics doc: `docs/pricing-and-economics.md`
> - v1.1 feature pack: `docs/superpowers/specs/2026-05-17-v1.1-feature-pack-design.md`

---

## 2. Answers to likely questions about Yappr

> For most of these I'll just link to the relevant landing-page section live in the meeting rather than re-narrate.

### "What does it actually do?"
Three behaviors on one key (Right Option ⌥):
- **Push-to-talk dictation** — speak → polished text at cursor
- **Command mode** — highlight text + ⌘⇧Space + voice instruction → rewrite ("tighten this", "make this a bullet list", "translate to French")
- **Dev mode** — in code editors and terminals, preserves identifiers / casing / paths / jargon instead of "humanizing" them

### "What makes the polish per-app?"
The desktop app detects the focused app (Slack, iMessage, Gmail, VS Code, Notion, terminal, Claude, Cursor…) and applies a different polish prompt per destination. iMessage stays lowercase. Gmail keeps "Hi X,". Slack is casual. Terminal is command-shaped. This is **the** differentiator from Wispr — generic transcribers polish the same way everywhere.

### "What's 'context engineering for AI tools'?"
When you're typing into Claude, Cursor, ChatGPT, or Notion AI, Yappr does more than transcribe — it **restructures** the message so the AI gets a well-formed prompt. Voice → prompt engineering, in-line. That's a whole different problem from email polish.

### "Background context — how does that work?"
- At setup, Yappr asks a few questions about who you are / what you do
- Every **50 dictations**, Yappr compacts recent transcripts into an updated profile (additive, plus a full rebuild every 10 compactions)
- Polish then leans on that profile — your jargon, your tone, your recurring names
- All processed via your provider (or local), gated by an `autoContextUpdate` setting

### "Dictionary?"
Add custom words/names/jargon ("Logitech", internal codenames, your coworkers' names, technical terms) with optional pronunciation hints. Transcription and polish both respect it.

### "Privacy?"
No screenshots. No telemetry. No audio retention. Privacy is by design — the polish layer reads what you dictate, not what's on your screen.

### "Pricing / business model?"
*(Decided, see `docs/pricing-and-economics.md`)*

**This is a managed software product on a monthly subscription.** Users pay Yappr; Yappr runs inference behind the scenes.

| Plan | Price | Includes |
|---|---|---|
| **Free** | $0 | 2,000 words/week of managed cloud transcription + polish • Light cleanup • Local Whisper fallback |
| **Pro** | **$10/mo or $96/yr** | Unlimited cloud transcription + full LLM polish • Command mode • Emoji injection • Priority queue • All local tiers |
| **Lifetime** | ~$199–249 (planned) | One-time, locks in everything |

**Positioning vs comp:** Wispr $15/mo, Willow $15/mo, Superwhisper $8.49/mo. Yappr undercuts at $10/mo. Margin floor stays 90%+ at current STT/LLM COGS.

### "How does inference actually work under the hood?"
*(Implementation detail — don't lead with this, but be ready if asked):*
- Backend proxy → currently routing STT to Groq (`whisper-large-v3-turbo`) and polish to `llama-3.1-8b-instant`, with prompt caching
- Provider-agnostic by design — could swap to Deepgram / OpenAI / Anthropic / on-device tomorrow without touching the user surface
- Local whisper.cpp ships bundled as an offline fallback
- An advanced BYOK toggle exists for the privacy-maximalist niche — but it's not the product, and it's not the pitch

### "Platforms?"
- **macOS** is primary. Right Option hotkey, AppleScript paste, osascript focused-app detection.
- Windows builds exist; feature parity in progress.
- No Linux yet. No mobile — *interesting in a hardware-partner conversation*.

### "Who's building it?"
Solo / founder-led. Not pretending to be a team. The differentiation is the product, not the headcount.

### "Roadmap?"
v1.1 feature pack (May 2026): lifetime tier, pre-roll buffer (catch the first half-second), editor biasing, deeper context memory. Local Whisper v2 in flight.

### "Traction?"
- **Honest answer: still in beta, no public users yet.** The conversation here is product-led, not metrics-led.
- The pitch is the product surface (per-app polish, AI-coding context engineering, background context, dictionary) and the strategic fit with MX — not a user-count flex.
- If pressed: positioning Yappr to launch publicly with a managed-inference Pro tier at $10/mo; full v1.1 feature pack lands before public launch. (Refer to `docs/pricing-and-economics.md`.)

---

## 3. Questions to ask Logitech

### What they're building
1. Is it **hardware-integrated** (dedicated key / mic / LED on the keyboard) or a **software-only** layer that ships through Logi Options+? Or both?
2. **Which segment** — MX series (MX Keys, MX Mechanical, MX Master)? Or down-line into mainstream / accessibility?
3. **Timeline** — what's the target ship window? *(Specifically: anything around September?)*
4. **Inference model** — managed cloud (Logitech pays), BYOK, or fully on-device?
5. **STT + cleanup pipeline** — in-house, licensing (Whisper / Deepgram / 11 Labs), or partnering?
6. **Polish layer** — generic transcript, or context-aware per app like Yappr?
7. **What is the hardware actually doing** that a software hotkey can't?
   - Lower latency (USB HID vs. global key listener)?
   - Hardware mic mute LED (real privacy signal)?
   - Tactile feedback during push-to-talk?
   - Always-on background wake?
8. **Distribution** — flagship MX-tier only, or pushed across the lineup?
9. **OS coverage** — Mac, Windows, ChromeOS, mobile (via Bolt / Bluetooth)?
10. **Pricing structure** — hardware bundle, subscription, one-time premium, freemium?
11. **What do you already have built** vs. what's still open?
12. **Where are you stuck?**

### About a working relationship
13. Looking for a software partner, build-vs-buy intel, acquihire signal, or just industry conversation today?
14. Would Logitech be open to Yappr powering the software side (white-label / co-brand)?
15. How locked-down is Logi Options+ as a distribution surface — could a third-party app hook a dictation key event?
16. What would unblock a deeper conversation on either side?

---

## 4. My pitch — what Logitech should build

> **Framing:** I'm not pitching Yappr-as-hardware-startup. I'm pitching Logitech-as-the-natural-home for hardware-integrated dictation, with Yappr as a possible software partner.

### Thesis

**Logitech already sells more keyboards than anyone. The differentiated bet isn't "another Wispr Flow." It's a dictation product where the hardware is the moat — and Logitech is uniquely positioned to ship that.**

Software dictation — Wispr, Superwhisper, Yappr — is one cancel-click away from churn. A keyboard with a dedicated dictation key, a hardware mic-mute LED, and tactile push-to-talk is **sticky in a way software alone cannot be**. You don't cancel a key on your MX Keys.

This plays directly to Logitech's strengths:
- You already own the input surface
- Logi Options+ is already on millions of machines as a distribution channel
- MX-tier customers already pay a premium for productivity hardware
- Decades of credibility on input ergonomics — software-only startups can't fake that

### Proposed shape

**Phase 1 — 0 to 6 months: Ship hardware-integrated dictation.**
- Take an existing MX-tier SKU and add:
  - **Dedicated push-to-talk key** (or repurpose a layer key via firmware + key-cap option)
  - **Status LED** — recording / processing / idle. Hardware-level mic state visible.
  - Optional v2: on-key mic, or a physical mic mute switch
- Paired desktop app (Logi Options+ extension or standalone) does STT + per-app polish + paste
- Sell as a **bundle**: hardware buyer gets dictation built in — **6 months free**, then convert to paid or lose access (or fall back to a limited free tier)

**Phase 2 — 6+ months: Layer in PPU / bundle upsell (Google-style).**
- After the 6-month free window, users decide: pay for the full experience or step down. By then the key is in their muscle memory and the switching cost is the entire keyboard.
- Pay-per-use credits for premium polish / advanced models, *or* a Pro subscription (custom prompts, longer context memory, multi-device sync, team admin)
- "Pay for anything" model — small upsells on power features

### Why hardware-integrated beats software-only

| | Software-only (Wispr / Yappr) | Hardware-integrated (Logitech) |
|---|---|---|
| Cancel friction | One click | Throw away your keyboard |
| Daily reminder to use | Remember the hotkey | The key is literally under your finger |
| Discovery surface | App store / blog posts | Every MX keyboard sold |
| Upsell path | Free → paid software | Hardware sold → 6-month free → paid |
| Switching cost out | Near zero | Whole device |
| Trust story | "Trust the software" | "There's a hardware LED for the mic" |

### Where Yappr could fit in
- **White-label / power the software layer** — Yappr's per-app polish, AI-coding context engineering, background-context system, and dictionary become the engine; Logitech owns hardware, brand, and distribution.
- **Co-brand:** "Logi MX Dictate, polished by Yappr."
- **At minimum:** keep the channel warm. Both sides win if the category grows.

---

## 5. Pre-meeting checklist

- [ ] Skim the latest Logi Options+ release notes + Logitech AI announcements (Logi AI Prompt Builder etc.) — know what they've already shipped
- [ ] Skim Jean-Michel Chardon's recent LinkedIn posts on MX Ink and "new input modalities" — frame voice as the next modality in that line
- [ ] Demo plan: live Yappr on the laptop in **Slack + Cursor + Gmail** (best showcase of per-app polish + AI-coding context engineering). Bring a backup screen recording in case live mic fails.
- [ ] Pull up `yappr.app` in a tab for live linking
- [ ] `docs/pricing-and-economics.md` open in a tab in case pricing comes up
- [ ] Be ready to ask specifically: **what's happening around September** on their timeline
- [ ] Be ready to honestly position Yappr as **solo / founder-led, in beta, pre-launch** — lead with the product, not the org chart
- [ ] Have a clear *one concrete ask* ready: an NDA follow-up call with Hemes + Chardon to go deeper on integration
