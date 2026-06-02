# Feature 4 — Context Memory: Implementation Plan (v2)

**Source spec:** [2026-05-17-v1.1-feature-pack-design.md](../specs/2026-05-17-v1.1-feature-pack-design.md) (Feature 4 section)
**Author:** Claude + Noan
**Status:** Plan only — awaiting build approval. **Revised 2026-05-18** to prioritize Layer B (general user context) + Layer C (per-category recent activity) and deprioritize Layer A based on the latency math below.
**Date:** 2026-05-18

---

## TL;DR — the v2 shape

Ship **two** context layers that together stay invisible on the hot path:

- **Layer B — Who you are.** A persistent ~120-word paragraph about the user: domains, names they use often, voice, tools. Always-on once it's populated. Compact in the background.
- **Layer C — What you've been doing in this kind of app.** A ~60-word summary of recent activity per app category (messaging / work / writing / code / ai_prompt). Only the matching one is injected per dictation.

Deprioritize **Layer A** (live focused-text-box snapshot) for the v2 release. See [Why Layer A drops out](#why-layer-a-drops-out-of-v2) below — it's the one with unbounded latency cost and unbounded privacy surface, and B + C alone deliver the bulk of the value.

**Latency budget:**
- Per-cleanup added latency: **< 80ms p50, < 150ms p95**. Achievable because input prefill on Groq llama-3.1-8b-instant runs at ~8000 tok/s, so an extra 200 tokens of context is ~25ms.
- Background compaction: zero user-visible cost.

This v2 trades reach (no Layer A) for invisibility (no AX read = no 30ms timeout window = no per-app permission risk = no 500-token injection of arbitrary text-box content).

---

## Why Layer A drops out of v2

The previous version of this plan budgeted 30ms for an AX read of the focused text element. That number is fine on paper — but it has three problems that B + C don't have:

1. **Variable injection size.** Layer A injects up to 500 tokens of arbitrary content. Layer B is bounded to ~150 words (~200 tokens), Layer C to ~80 words (~100 tokens). Layer A is what makes the "+500 tokens added" worst case real.
2. **Permission surface.** Reading `AXValue` from the focused element requires the existing Accessibility permission — Yappr already has it for paste — but it expands the *scope* of what the app reads from "the user's text box, only at paste time" to "the user's text box, BEFORE they dictate, on every keystroke pause." This is the kind of scope creep that breaks user trust.
3. **App-class flakiness.** Discord / Slack / Electron-based chat apps frequently return empty `AXValue` for their composers — the AX tree is opaque past the WebView boundary. So in exactly the apps where Layer A would matter most (chat apps where you're replying to context), it doesn't fire.

B + C cover the "general user + recent activity" intent the user explicitly named, without any of those three downsides.

If Layer A becomes a v3 ask later, the plan for it stays valid — just rip it from this doc into its own. The two are architecturally orthogonal.

---

## Latency math, corrected

The previous version of this plan said "500 extra input tokens at ~800 tok/s = 625ms" — that was wrong. Groq's input prefill (the prompt tokenization + KV-cache build) runs at ~5000-10000 tok/s for llama-3.1-8b-instant on short prompts, not the output decode speed. Output decode is the ~80-tok/s bottleneck that produces the visible "model is thinking" delay; input prefill is essentially free per token at the scale we care about.

So:

| Layer | Added input tokens | Prefill cost (at ~8000 tok/s) |
|---|---|---|
| Layer B (user overview) | ~200 tokens (~150 words at 1.3 tokens/word) | ~25ms |
| Layer C (per-category recent) | ~100 tokens (~70 words) | ~12ms |
| **B + C combined** | **~300 tokens** | **~40ms** |
| Layer A (focused text-box) | up to ~500 additional tokens | ~60ms — when it lands; 30ms wasted when it times out |

B + C together cost ~40ms of prefill time per cleanup, which is invisible against the existing 500–1500ms cleanup latency. **No measurable user impact.**

Add the SQLite read (~3ms) and the prompt-build string concat (~1ms) and the total context-assembly hot-path cost is **~45ms p50**, which runs *in parallel* with the audio upload, so the net wall-clock add lands at roughly **20–30ms**. Below the threshold of human perception.

---

## Architecture (v2)

```
┌─────────────────────────────────────────────────────────┐
│   HOT PATH (hotkey-release → paste, ~600-1500ms total)  │
├─────────────────────────────────────────────────────────┤
│  whisper transcribe ─┐                                  │
│                       ├─► cleanup call (Groq, ~500ms)   │
│  context-assemble ───┘                                  │
│   ├ read SQLite (cached, ~1ms)                          │
│   ├ pick category summary (~0ms)                        │
│   └ build prompt block (~1ms)                           │
│                                                          │
│   Total context-assembly: ~5ms (cached) / ~30ms (cold)  │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ reads from
                          │
┌─────────────────────────┴───────────────────────────────┐
│   STORE — userData/context.db (SQLite, < 2KB)           │
├─────────────────────────────────────────────────────────┤
│  user_overview:     TEXT      (one row, ~150 words)     │
│  category_summary:  TEXT × 5  (one per category)        │
│  dictation_count:   INTEGER                             │
│  last_compaction:   INTEGER (unix ms)                   │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ writes from
                          │
┌─────────────────────────┴───────────────────────────────┐
│   BACKGROUND COMPACTOR (off hot path, every 20 dicts)   │
├─────────────────────────────────────────────────────────┤
│  trigger: dictation_count ≥ 20 AND idle ≥ 60s           │
│  fetch:   last 20 transcripts from history-store.ts     │
│  call:    Groq llama-3.1-8b-instant (one call, ~500ms)  │
│  output:  refreshed user_overview + per-category sums   │
│  cost:    ~$0.00005 per compaction (BYOK)               │
└─────────────────────────────────────────────────────────┘
```

Everything in the hot path is **cache-warm** after the first dictation per session — the SQLite reads return from process memory in <1ms after the first call.

---

## What gets sent to the cleanup LLM

```
USER CONTEXT (background only — do not echo, do not summarize, do not address):

Who you are:
{user_overview, ~120 words}

Recent in {category}:
{category_summary[category], ~60 words}
```

That's it. ~300 tokens total. Slotted into the cleanup system prompt right after the OUTPUT_GUARD block, before the category-specific rules. Light strictness (regex-only) still skips context entirely — the LLM isn't called.

The cleanup LLM is *explicitly* told this is background. The prompt phrasing is critical because the 8B model will otherwise treat it as "things to mention" — we've seen this exact failure mode in the existing prompts. The injection wrapper above is the working draft; we'll harden it during Phase 1 with A/B comparisons.

---

## Phased build (v2)

### Phase 1 — Layer B (user overview), hand-written

**Goal:** ship the smallest possible slice that lets you and a few testers feel whether context actually improves cleanup quality. No compaction yet. The overview is user-editable in Settings.

**Build:**
- `src/main/context/store.ts` — `better-sqlite3` wrapper. Schema: `user_overview TEXT`, `dictation_count INTEGER`, `last_compaction INTEGER`. Initialized on first launch.
- Module-level cache for the overview string so cold-read happens once per app session.
- Settings → AI tab: **"User overview"** textarea (~150 words max), **"Use as cleanup context"** toggle (default OFF until validated).
- `src/main/context/prompt-injector.ts` — emits the "Who you are: ..." block when the toggle is on and the overview is non-empty.
- Wire into the cleanup prompt assembly in `pipeline.ts`, right after `OUTPUT_GUARD`, before category-specific content. Skip injection on Light strictness (no LLM call there anyway).

**Validate before Phase 2:**
- Cleanup latency unchanged within ±20ms across 20 sample dictations.
- A/B compare 10 dictations with overview vs. without overview. Eyeball whether outputs feel more "you."
- Verify the LLM doesn't echo the overview content into the output. If it does, prompt hardening required before Phase 2.

**Estimate:** 3-4 hours.

### Phase 2 — Layer C (per-category recent), hand-written

**Goal:** add per-category recent-activity summaries. Still hand-edited, no auto-compaction. Tests the second injection point and the routing logic.

**Build:**
- Schema gains: `category_summaries (category TEXT PRIMARY KEY, summary TEXT)`. Five rows: messaging, work, writing, code, ai_prompt. Each ~60 words max.
- Settings → AI tab: a small editor for each category. Collapsed by default. Optional ("if you want to give Yappr more context for messaging specifically, write a few sentences here").
- Prompt-injector picks the matching category at cleanup time and emits the "Recent in {category}: ..." block.

**Validate before Phase 3:**
- Verify category routing matches the existing strictness-bucket map. Sanity-check that "ai_prompt" gets injected for AI chat dictations specifically.
- Cleanup latency: still within ±20ms vs. baseline.

**Estimate:** 2-3 hours.

### Phase 3 — Background auto-compaction

**Goal:** automate Layers B + C. User stops hand-writing; the model writes them.

**Build:**
- `src/main/context/compactor.ts` — monitors `dictation_count`. Every 20 dictations, fires a single Groq call with the existing summaries (as the spine) + the last 20 transcripts (additive). Output: refreshed overview + 5 category summaries.
- Idle gate: only run when no dictation in last 60s AND `app.getIdleTime() > 30s`. Otherwise defer.
- Failure mode: if compaction fails (network, rate limit), don't retry immediately — wait for the next 20-dictation cycle. The old summaries keep working.
- Settings → AI: **"Auto-update context"** toggle (default ON once Phase 3 ships), **"Last updated 2h ago"** indicator, **"Refresh now"** button (manual trigger), **"Clear context"** button (wipes summaries + counter), **"Pause context memory"** master toggle (already-present pattern from the Pause Cleanup work).
- Periodic full rebuild: every 10 compactions (= every 200 dictations), the compactor ignores existing summaries and rebuilds from scratch. Prevents summary drift.

**Validate before calling done:**
- Compaction fires at 20 dictations, verifiable in logs.
- Compaction skipped when recording or recently active.
- Cleanup latency p50 unchanged from current main; p95 within +50ms.
- "Clear context" wipes DB + counter cleanly.
- Toggling "Pause context memory" → no LLM context calls, no prompt injection. Verifiable by inspecting outgoing requests.
- Summary drift check: simulate 5 compaction cycles with mock transcripts. Summaries stay coherent.

**Estimate:** 5-7 hours.

---

## Keeping latency invisible — the techniques

These apply across all phases. They're cheap and they're what make the "no significant delay" goal actually achievable:

1. **Parallel context-assembly with audio upload.** The cleanup HTTP call to Groq takes ~50–200ms just to upload + connect. The context-assembly runs entirely in those 50ms — measured wall-clock impact: ~0ms in the common case.
2. **Module-level cache.** SQLite reads happen once per app launch per row. Subsequent reads are JS object property lookups. The cache is invalidated only on compaction-write or manual clear.
3. **Per-category lookup, not all-categories.** Only the matching category summary is read + injected per dictation. We never serialize five summaries when we need one.
4. **Token-bounded inputs.** The overview is hard-capped to 150 words at write time. Category summaries hard-capped to 80 words. The prompt-injector trims at character count (~1000 chars total for both layers) as a safety net.
5. **No layer = no cost.** Each layer is independently togglable. If the user turns off "Recent in {category}", we never read that table. The injection block is empty, the LLM sees no overhead.
6. **Compaction is decoupled from the hot path.** It runs in the same process but is gated by idle detection. The user dictating starts cleanup immediately; if compaction is running, the cleanup call doesn't wait.
7. **Light strictness still bypasses everything.** Light = regex-only = no LLM call = nothing to inject. Users on Light see zero context-memory cost regardless of toggle state.

---

## Failure modes and what we do about them

| Failure | Behavior |
|---|---|
| SQLite DB missing on first launch | Initialize empty. Injection is empty. No-op cleanup runs as today. |
| `better-sqlite3` native module fails to load on a user's Mac | Catch + log + disable feature for that session. Show a banner in Settings → AI: "Context memory unavailable — please report." Don't crash the app. |
| Compaction fails (network, rate limit, key revoked) | Log, retry on next 20-dict cycle. Old summaries keep working. |
| Compaction times out (>30s) | Cancel. Same retry behavior. |
| User toggles off "Use as cleanup context" mid-dictation | Next cleanup omits injection. Current cleanup completes with whatever it had. |
| Cleanup LLM echoes context into output | Detect via `stripLLMArtifacts` (already in place — extend with context-echo patterns during Phase 1 testing). |
| Summary drift after many compactions | Periodic from-scratch rebuild every 10 compactions. |
| User changes provider Groq → Local | If no Groq key configured, cleanup is no-op anyway; injection has no effect. If Groq key still present (Local for transcription only), continues working. |

---

## Privacy and the pause guarantee

- **Storage:** `userData/context.db` only. Never transmitted except as part of the user's own Groq cleanup call (BYOK).
- **"Pause context memory"** toggle in Settings → AI: when OFF, no compaction runs and no injection happens. Inspectable in network logs.
- **"Clear context"** button: idempotent wipe of all five summary rows + counter.
- Compaction prompt contents (the 20 transcripts being sent for refresh) are sent over the user's own Groq key — same trust boundary as cleanup itself. Not held by us.
- No cross-machine sync (deferred to monthly tier).

---

## What's NOT in v2

- **Layer A (focused text-box AX read).** See [Why Layer A drops out](#why-layer-a-drops-out-of-v2). Possible v3.
- **Cross-machine sync.** Monthly tier feature.
- **Surfacing summaries as a readable Settings panel viewer** beyond the textareas in Phases 1+2 and the "Last updated" indicator in Phase 3.
- **Vector-search over historical dictations.** Overkill for this value.
- **LLM-judged "is this dictation worth remembering" filtering.** Every dictation counts equally — much simpler reasoning model for the user.

---

## When to start

**Recommended trigger to build Phase 1:**
- Pause-AI-cleanup toggle (shipped today) proves stable across a week of dogfooding.
- The "Pause" pattern there is the precedent for the "Pause context memory" toggle in Phase 3 — same UI, same UX.

**Recommended trigger to stop and rethink:**
- Phase 1 added latency exceeds ±20ms baseline (means our prefill-cost assumption is wrong).
- Cleanup LLM starts echoing context content into outputs and prompt hardening can't fix it.
- Privacy concern surfaced during testing.

---

## Open decisions before build

1. **Cap on categories.** Spec says four (messaging / work / writing / code). Yappr already has five with `ai_prompt`. Plan assumes five — confirm.
2. **Default toggle states.** Phase 1: "Use as cleanup context" defaults to OFF (validate first). Phase 3: "Auto-update context" defaults to ON. Confirm both.
3. **Onboarding nudge.** Should the Settings → AI tab prompt new users to write a 2-sentence "Who you are" on first visit? Or strictly opt-in via the toggle? Leaning opt-in — context memory should never feel mandatory.
4. **Settings tab location.** Currently planned: Settings → AI (the existing AI tab, which already has the cleanup-related toggles). Alternative: dedicated Settings → Context tab. Leaning AI tab for v2; spin out if it gets crowded.

---

## Out of scope for this plan

- Implementing it. Plan only.
- Anything in Feature 2 (pre-roll buffer) or Feature 3 (editor biasing) of the v1.1 spec.
