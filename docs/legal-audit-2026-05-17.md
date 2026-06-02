# Yappr Legal & Compliance Audit

**Date:** 2026-05-17
**Scope:** Closed-source commercial Electron desktop dictation app + Next.js marketing site
**Auditor:** Internal technical review (Claude). This is not a legal opinion. Engage counsel before relying on any conclusion below.

---

## TL;DR

Yappr's actual code-level privacy posture is genuinely strong (BYOK, no proxy, no telemetry, no screenshots, no analytics). The legal risk surface is almost entirely **documentation drift** — what the repo and UI claim about the product contradicts what the product is, and a handful of dependency / attribution obligations are unmet.

**Five things are material and were auto-fixed in this pass:**

1. **`LICENSE` was MIT** while the product is closed-source commercial. Replaced with a proprietary copyright notice.
2. **README.md, AboutTab.tsx, CONTRIBUTING.md** claimed "open source / MIT / PRs welcome." Stripped.
3. **`ffmpeg-static` is GPL-3.0-or-later** and was being shipped in a closed-source binary. Replaced with `@ffmpeg-installer/ffmpeg` (LGPL-2.1), which is compatible with closed-source distribution.
4. **No third-party attribution file existed.** Added `THIRD_PARTY_LICENSES.md` covering all production deps, native binaries, and ML model weights, plus LGPL re-link instructions for ffmpeg and the "Built with Llama" notice required by the Llama 3 Community License.
5. **No `SECURITY.md`.** Added a minimal vulnerability disclosure policy (precursor work for the EU Cyber Resilience Act reporting obligations effective 2026-09-11).

**Eight things are judgment calls and are left to you** in §§ "Decisions you need to make" below. The biggest are: (1) write a real Privacy Policy at yappr.app/privacy, (2) get a trademark clearance search for the name "Yappr" (collision with the SDN protocol is real), and (3) before the `/api/demo` Vercel edge function ships, get its data flow and a Terms-of-Service in place — that endpoint, not the desktop app, is the actual GDPR exposure.

---

## What was fixed

### 1. LICENSE file
- **Before:** `/Users/noanborel/Yappr/LICENSE` was the MIT license, granting an irrevocable copy/modify/sublicense right to anyone who pulled the repo.
- **After:** Replaced with a proprietary "All Rights Reserved" notice.
- **Note:** If the repo was previously public on GitHub with the MIT LICENSE, any version someone already cloned **remains MIT-licensed for that version** (MIT is irrevocable for distributed copies). Make the repo private going forward; the change above governs all future distributions only.

### 2. README.md
- Removed: "Free, open-source voice dictation" headline, "Open source ✓" comparison row, "Free and open source" FAQ, "MIT licensed — PRs welcome" footer.
- Replaced positioning with: "Bring your own key. Audio goes mic → your provider directly. Our servers are not in the path."

### 3. AboutTab.tsx (in-app)
- Removed the `"MIT license"` and `"open source"` pills.
- Replaced with a `"BYOK"` pill (factually correct, matches the actual differentiation).
- Replaced the "Check for updates" button's `github.com/yappr-app/yappr/releases` link with `yappr.app/download` — closed-source products do not surface a public source repo to users.

### 4. CONTRIBUTING.md
- The file invited external PRs and described internal architecture. Removed both. Replaced with a one-page internal-only contributor note that does not solicit outside contributions.

### 5. ffmpeg-static → @ffmpeg-installer/ffmpeg
- **The problem:** `ffmpeg-static` v5.3.0 is published under GPL-3.0-or-later. Distributing a GPL-3.0 binary inside a closed-source commercial product without offering the entire combined work under GPL-3.0 is a license violation. The binary itself was being unpacked into `app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg` per `electron-builder.yml`.
- **The fix:** Replaced with `@ffmpeg-installer/ffmpeg` (LGPL-2.1). LGPL is compatible with closed-source distribution as long as (a) the LGPL notice is shipped, (b) the user can replace the LGPL component (the ffmpeg binary is a separate file in `asarUnpack`, so this is satisfied by construction), and (c) source for the LGPL component is offered.
- **Files changed:**
  - `package.json` — dep swapped
  - `src/main/local-binaries.ts` — `require('ffmpeg-static')` → `require('@ffmpeg-installer/ffmpeg').path`
  - `electron-builder.yml` — `asarUnpack` paths updated
  - `THIRD_PARTY_LICENSES.md` includes LGPL notice + source-availability statement + link to ffmpeg.org/download.html
- **You still need to run `npm install`** to materialize the new dep in `node_modules`.
- **Heads-up:** I left the AIProviderTab + Onboarding "ffmpeg not found" copy referencing `ffmpeg-static` by name in error messages. Those are technical diagnostics, not legal claims; not worth churning. If you'd rather I update them, say so.

### 6. THIRD_PARTY_LICENSES.md (new)
Created at `/Users/noanborel/Yappr/THIRD_PARTY_LICENSES.md`. Covers:
- All direct production deps (react, react-dom, electron-store, @fugood/whisper.node, @ffmpeg-installer/ffmpeg, groq-sdk, node-global-key-listener, @electron-toolkit/utils, simple-icons)
- Whisper model weights (OpenAI, MIT)
- whisper.cpp + ggerganov's GGML quantizations (MIT)
- ffmpeg (LGPL-2.1) with source-availability statement
- Apache-2.0 NOTICE redistribution for groq-sdk
- Llama 3 Community License attribution ("Built with Llama")
- Trademark notice covering Slack/Gmail/iMessage/Notion/Cursor/ChatGPT/Claude/Groq

The file is referenced from `AboutTab.tsx` via a new "Third-party licenses" link in the Resources card.

### 7. "Built with Llama" attribution
- **Why required:** The Llama 3 Community License § 5(a) requires any product whose outputs derive from Llama to "prominently display 'Built with Llama' on a related website, user interface, blog post, about page, or product documentation." Yappr's cleanup pipeline calls `llama-3.1-8b-instant` (Groq-hosted) for polish.
- **Where added:** AboutTab footer + landing-page Footer credit line. Both link to the Llama 3 license text.

### 8. SECURITY.md (new)
- Adds `security@yappr.app` as the disclosure address, 90-day disclosure window, scope (the desktop binary + the landing live-demo endpoint when shipped), and safe-harbor language.
- This is **precursor work for the EU Cyber Resilience Act** — Article 14 vulnerability reporting goes live **2026-09-11** (≈4 months from this audit date). Before then Yappr needs (a) the disclosure intake (done by this file), (b) a defined support period and update mechanism (still owed — see decisions below), and (c) an incident-response runbook covering the 24h/72h/14d ENISA reporting timer.

### 9. Privacy.tsx headline
- **Before:** "It all stays on your machine." This was misleading because for the default (cloud) BYOK flow, audio is uploaded to the user's chosen provider.
- **After:** "Your audio goes straight to your provider." Body copy now explicitly distinguishes the cloud-BYOK flow (audio uploaded to user's chosen provider on user's key, Yappr servers never in the path) from the local-whisper.cpp flow (truly on-device).
- This was a marketing-copy issue, not a code issue — the underlying claim that Yappr servers don't proxy is correct and verified in code.

### 10. Groq logo modification removed
- Found at `AIProviderTab.tsx:460` and `OnboardingApp.tsx:705`: `className="brightness-0 invert opacity-95"` was inverting the Groq wordmark. Most brand guidelines prohibit color-inversion of the logo.
- Replaced the inverted-image approach with the literal word "Groq" rendered in Groq's accent color. Nominative fair use of the name without modifying the logo image is the safest path. The PNG file is left in the repo so you can put it back if you obtain Groq's brand permission.

### 11. Trademark notice added
- Added to README and to `THIRD_PARTY_LICENSES.md`:
  > Slack, Gmail, iMessage, Notion, Cursor, ChatGPT, Claude, Groq, Llama, and Whisper are trademarks of their respective owners. Yappr is not affiliated with or endorsed by these companies.
- Standard nominative-fair-use safe-harbor language.

---

## Decisions you need to make

The items below are real risks that I deliberately did **not** auto-fix because they involve product positioning, legal entity questions, or external dependencies you control.

### A. Write a real Privacy Policy at `yappr.app/privacy` — **HIGH priority**

You have **no privacy policy**. The Footer links `Privacy policy / Terms / Contact` all point to `href="#"`. The `Privacy.tsx` section on the landing page is marketing copy, not a GDPR Article 13 notice.

**Why this matters even with zero server-side data collection:**
- GDPR Art. 13 requires the disclosure itself, not just the absence of collection.
- The moment the `/api/demo` Vercel edge function ships (planned per `YapprLanding/CLAUDE.md`), Yappr becomes a GDPR **controller** for audio uploads, IPs (Upstash counter), and outputs.
- Apple App Store / Microsoft Store both require a privacy policy URL if you ever submit.

**What it needs to cover:**
- Controller identity (legal entity name + EU rep if you ship to EU at scale)
- The desktop-app data flow (settings stored locally; mic audio → user's chosen provider; Yappr servers not in the path)
- The landing-page demo data flow (audio → Yappr's Groq + Anthropic keys, IP hashed for rate counter, 24h max retention — once it ships)
- What's not collected (no analytics, no telemetry, no voiceprints, no biometric identifiers)
- DSAR contact + EU/CA rights statements + cookie statement (none used)
- The transcript-preview local logging (`pipeline.ts:312` writes first 60 chars to local log file — local-only but should be disclosed)

**Effort:** ~½ day with a template; have counsel review before ship.

---

### B. Trademark clearance on "Yappr" — **HIGH priority, slow burn**

"Yappr" is a well-known industry term: it's the registered Software-Defined-Networking control-plane protocol managed by the Open Networking Foundation, founded by Google/Facebook/Microsoft. The mark is in adjacent goods/services (developer tooling), the audiences overlap (developers), and a USPTO application is likely to draw an opposition.

There are also several other "Yappr" registrations in foreign and adjacent classes.

**Recommendation:**
- Get a real trademark clearance opinion from a TM attorney ($500–$2k). Expect bad news.
- Decide before paid launch whether to rename. Rebranding at v0.1 is dramatically cheaper than at v1.0 or post-acquisition.
- Candidates: "Yappr Voice", "Flowtype", "Speakflow", or something distinctive that survives a knock-out search.

**Effort:** 1 week (attorney) + product decision.

---

### C. Before `/api/demo` ships, lock down the wrapper-pattern surface — **HIGH priority, blocks landing v1.1**

The planned Vercel edge function in `YapprLanding/CLAUDE.md` uses Yappr's **own** `GROQ_API_KEY` and `ANTHROPIC_API_KEY` to run a free trial demo. This is the only place Yappr is not BYOK, and it's exactly the architecture Anthropic's 2025 commercial terms tightened against (the "wrapper" pattern).

It is plausibly defensible as a marketing demo (rate-limited 5/IP/day, $50 daily key ceiling, no audio retention), but it inverts the privacy claim ("our servers are not in the path") at the URL most of your acquisition traffic will land on.

**Before shipping it:**
- Publish the Privacy Policy first (see A).
- Add a clear in-page disclosure: *"This is a hosted demo — the shipped app is BYOK and audio never reaches our servers. For the demo only, audio is sent through yappr.app on our keys, rate-limited 5/day/IP, deleted after processing, never stored."*
- Geofence or full GDPR-compliant flow for EU IPs (the demo records IP for rate-counting; that's personal data under GDPR).
- Add a Terms of Service for the hosted demo (not the desktop app — different surface).
- Consider replacing the demo with a "paste your own Groq key" widget — eliminates the wrapper exposure entirely at the cost of friction.

---

### D. Commit to a CRA support window and update mechanism — **MEDIUM priority, deadline 2026-09-11 for reporting**

EU Cyber Resilience Act obligations phase in:
- **2026-09-11:** Vulnerability + incident reporting to ENISA (24h initial, 72h update, 14d post-fix). The new `SECURITY.md` is the intake side; you still need (a) a published support period — how long after a release will you ship security updates? — and (b) an internal runbook for who files with ENISA when something happens.
- **2027-12-11:** Full Annex I conformity assessment, CE marking, SBOM, technical documentation.

**Recommended near-term steps:**
- Publish a support-period statement (e.g., "Yappr ships security updates for the latest minor version for 24 months after release"). Add to landing footer + AboutTab.
- Set up SBOM generation in CI: `@cyclonedx/cyclonedx-npm` produces a CycloneDX JSON; attach to each GitHub release.
- Document the incident-response runbook in a private repo (24h/72h/14d ENISA timer, named individual responsible).

---

### E. Provider logo audit (low-cost, finish the job) — **MEDIUM priority**

The landing page (`AiCoding.tsx`, `Hero.tsx`, `Dictionary.tsx`) and the in-app Settings/Onboarding use brand marks for ChatGPT, Claude, Cursor, Slack, Gmail, iMessage, Notion, and Groq. Most usages are nominative fair use (identifying the third-party product), but two specific risks remain:

1. **OpenAI's brand guidelines** discourage logo use outside of their "Powered by OpenAI" badge program. The ChatGPT logo on the landing's "Built for AI coding" surfaces is in a gray area.
2. **Anthropic** requires brand permission for logo use in marketing.

**Recommendation:** Email each provider's brand inbox describing Yappr's use case. For BYOK products that drive provider signups, permission is usually granted. If permission doesn't land, downgrade the logos to text labels (one-day diff). The trademark notice added to README/THIRD_PARTY_LICENSES helps but doesn't substitute for permission where guidelines require it.

---

### F. Verify the Wispr comparison claim — **MEDIUM priority**

`FAQ.tsx:14` states: *"Wispr proxies your audio through their servers on their plan."* This is the only factual claim about a competitor on the marketing site, and the only Lanham Act §43(a) (false advertising) surface.

**Action:** Confirm against Wispr's currently-published privacy/data-flow documentation. If accurate, add an inline citation. If anything has changed in Wispr's docs since the line was written, soften to "per Wispr's published data-flow documentation as of [date]."

---

### G. Disclose local logging and key-storage mechanics — **LOW priority**

The desktop app writes a log file at `~/Library/Application Support/yappr/yappr.log` that includes:
- First 60 characters of each transcript (`src/main/pipeline.ts:312`)
- Bundle ID + name of the focused app at paste time (`src/main/pipeline.ts:316`)

Neither leaves the user's machine, but neither is disclosed. Add to the Privacy Policy:
> Yappr writes a diagnostic log to your machine containing the first 60 characters of each transcript and the name of the focused app at paste time. This file is local-only, never uploaded, and can be deleted any time from the About tab.

Also disclose key storage:
> Provider API keys are stored on your machine in `~/Library/Application Support/yappr/yappr-settings.json` as plaintext (the standard Electron pattern; macOS file permissions protect the file but it is not cryptographically encrypted).

---

### H. Onboarding microphone disclosure — **LOW priority**

The macOS `NSMicrophoneUsageDescription` in `electron-builder.yml` is already good. The in-app onboarding (`OnboardingApp.tsx:300-302`) could be one sentence stronger:

> "Audio is captured only while you hold the hotkey. It is sent only to the provider you choose in the next step, encrypted in transit, and never reaches Yappr servers."

This closes the in-app legal-notice gap independent of the website Privacy Policy.

---

## Things I checked and they were fine

- **No telemetry / analytics / crash reporting / auto-update phone-home.** Grep across `src/` for analytics, telemetry, posthog, mixpanel, segment, amplitude, sentry, datadog, bugsnag, electron-updater returned zero. Confirms the "no telemetry" claim.
- **No screen capture code.** Grep for desktopCapturer, getDisplayMedia, screenshot returned zero. Confirms the "no screenshots" claim.
- **No clipboard reads.** `clipboard.writeText` only; no `readText/readImage`.
- **AppleScript only pastes, doesn't inspect app contents.** Only reads accessibility role to decide whether to paste; no content extraction.
- **Global keyboard listener is filtered.** `node-global-key-listener` is registered with a filter for the configured hotkey only; stray keystrokes are not captured.
- **API key never sent to Yappr domains.** Grep'd every `fetch` / `https.request` / SDK constructor call. Keys flow only to the user's chosen provider SDK.
- **No ML model weights checked into the repo.** Weights are downloaded at runtime from `huggingface.co/ggerganov/whisper.cpp` (MIT, traveled from OpenAI's original Whisper MIT release).
- **Initial commit + git history.** No suspicious large dumps, no foreign copyright headers, no GPL/AGPL headers in source.
- **Fonts.** Landing uses Google Fonts only (SIL OFL). No font licensing exposure.
- **No GPL/AGPL in devDependencies.** Build toolchain (electron-vite, electron-builder, tailwind, eslint, typescript) is all permissive.
- **Provider ToS for BYOK.** Groq, OpenAI, and Anthropic all explicitly permit the exact pattern Yappr uses (third-party app using end-user's own API key). The new Anthropic terms target the *proxy/wrapper* pattern, which the desktop app does not use (but see §C — the planned `/api/demo` does).
- **Output usage rights.** All three providers grant the customer full IP ownership over outputs. The polish/post-process pipeline is permitted.
- **CCPA exposure.** Below thresholds today (no signup, no purchase, no PII collection). Will rise to relevant when paid plans ship with billing.

---

## Files modified in this audit

```
LICENSE                                              (replaced with proprietary notice)
README.md                                            (OSS language stripped)
CONTRIBUTING.md                                      (no longer invites public PRs)
SECURITY.md                                          (NEW — vuln disclosure policy)
THIRD_PARTY_LICENSES.md                              (NEW — full attribution)
docs/legal-audit-2026-05-17.md                       (NEW — this file)
package.json                                         (ffmpeg-static → @ffmpeg-installer/ffmpeg)
electron-builder.yml                                 (asarUnpack paths updated)
src/main/local-binaries.ts                           (require swap)
src/renderer/settings/tabs/AboutTab.tsx              (badges, links, license-link)
src/renderer/settings/tabs/AIProviderTab.tsx         (Groq logo modification removed)
src/renderer/onboarding/OnboardingApp.tsx            (Groq logo modification removed)
YapprLanding/components/Privacy.tsx               (headline accuracy)
YapprLanding/components/Footer.tsx                (Built with Llama line)
```

The Groq logo PNG is left in the repo (`src/renderer/shared/logos/groq.png`) so it can be reinstated unmodified if you obtain Groq's brand permission.

---

## Open items, not blocking but worth doing

- Add `license-checker` to CI to fail builds on new GPL/AGPL deps (preventative).
- Generate SBOM at every release (`@cyclonedx/cyclonedx-npm`).
- Set the GitHub repo to private if it isn't already.
- Decide the legal entity for Yappr (LLC / Inc.) — the Privacy Policy needs a controller name and an address.
- Set up a `security@yappr.app` mailbox (referenced in SECURITY.md).
- Add an Apple App-Store-compatible privacy nutrition label if you ever ship through the Mac App Store.
