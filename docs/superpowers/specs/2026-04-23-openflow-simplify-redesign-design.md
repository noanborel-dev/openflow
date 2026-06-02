# Yappr — Simplification & Visual Redesign

**Date:** 2026-04-23
**Status:** Spec
**Supersedes:** parts of `docs/superpowers/plans/2026-04-22-yappr.md` (local Whisper, toggle hotkey, current UI)

## Goal

Fix two user-blocking bugs and ship a distinctive visual identity. Specifically:

1. Dictation currently fails with a red "error" pill showing raw Python stderr ("FP16 is not supported on CPU; using FP32 instead") — the local Whisper path is broken for normal users.
2. The hotkey is a two-click toggle instead of the hold-to-talk behavior users expect.
3. The UI is generic and unpolished — app needs a cohesive, premium visual identity.

## Non-goals

- Native rewrite (stay on Electron).
- Windows polish (Mac-first v1, as already decided in project memory).
- Local transcription for v1 (deferred to a future release).
- New providers beyond Groq (OpenAI/Anthropic stay as they are — Groq is default).

## Scope

### 1. Drop local Whisper

Remove the local Whisper provider entirely from the shipped app. No Python shell-out, no `openai-whisper` install step, no model download UI. The pipeline becomes cloud-only for v1.

**Rationale:** The local path is brittle (requires `python3` + `pip3` + network + ~1 GB disk), produces confusing stderr-as-error surfaces, and doubles the surface area of the codebase. Simplest way to make the app work today is to remove it. We'll revisit local transcription later as a proper first-class path (likely via `whisper.cpp` bundled as a native dep, not Python).

**Files touched:**
- Delete `src/main/providers/local-whisper.ts`.
- Remove `local-whisper` from the provider union in `src/shared/types.ts` and `src/shared/constants.ts`.
- Remove the provider from `src/main/pipeline.ts` factory.
- Remove the "Local" option from `src/renderer/settings/tabs/AIProviderTab.tsx` (and from onboarding).
- Remove `downloading:*` states from indicator + IPC.
- Drop `ffmpeg-static` from runtime deps if unused elsewhere (verify first).

**Onboarding impact:** When no key is set, the onboarding window requires a Groq key to continue. "Skip" paths that pointed to local-Whisper are removed.

### 2. Hold-to-talk + double-tap to lock

Replace the current `globalShortcut` toggle with a **Ctrl** hold-to-talk + double-tap-to-lock interaction.

**Behavior:**
- **Hold Ctrl** → start recording on keydown, stop on keyup. Transcribe + paste.
- **Double-tap Ctrl** (two presses within 350ms) → start recording and *stay* recording (locked). Next single press stops + transcribes.
- **Idle** → recording not active.

**Why the switch:** Electron's `globalShortcut` only emits on press, not release — that's the reason the code was built as a toggle in the first place. The project already depends on `node-global-key-listener`, which exposes keydown and keyup; we use it directly for this one key.

**Key detection:** `node-global-key-listener` reports `CTRL` on macOS and Windows. On macOS this corresponds to the Control key. We listen only for this key.

**State machine:**
```
idle ──keydown──> holding ──keyup(<dblTapWindow)──> idle   (no-op, was a tap)
idle ──keydown──> holding ──keyup(>holdThreshold)──> transcribing  (hold-to-talk)
idle ──dbltap──> locked ──next keydown──> transcribing
holding ──dbltap detected (2nd press arrived)──> locked
```

- `holdThreshold` = 150 ms. Shorter presses don't record (prevents accidental triggers).
- `dblTapWindow` = 350 ms between keydown events of first and second tap.

**Settings:** Hotkey setting still exists and lets the user pick the key (default: Ctrl). The **mode** (hold-to-talk + double-tap) is fixed — no toggle mode. Simpler.

**Files touched:**
- `src/main/hotkeys.ts` — replace `globalShortcut` implementation with `node-global-key-listener`-based hold/double-tap detector. Exports `registerHotkey(key, { onStart, onStop })`.
- `src/main/index.ts` — update wiring: `onStart` triggers record, `onStop` triggers stop-and-transcribe.
- `src/renderer/settings/tabs/HotkeysTab.tsx` — show current key as a readonly pill with a "Change" button that listens for the next keypress; remove the modifier-chord builder UI (we only accept single modifier keys now).
- `src/shared/constants.ts` — default hotkey = `CTRL`; remove accelerator-style strings.

### 3. Visual redesign — "Electric Paper"

Single cohesive visual language across onboarding, settings, and the indicator. Three principles:

1. **Stark paper canvas.** `#FAFAF5` off-white backgrounds. No gradients, no glassmorphism.
2. **Electric accent.** `#D4FF3D` yellow-green used sparingly — highlight behind serif-italic words, accent on recording pill, focus ring.
3. **Type pairing.** SF Pro / system sans for UI; Cormorant Garamond (or Playfair Display) *italic* for display accents only. Mono (`SF Mono`) for keys, API values, timestamps.

**Color tokens (in `src/shared/theme.ts`, new file):**
```
--paper: #FAFAF5
--ink:   #0A0A0A
--ink-60: rgba(10,10,10,0.6)
--ink-45: rgba(10,10,10,0.45)
--rule:  rgba(10,10,10,0.08)
--card:  #FFFFFF
--volt:  #D4FF3D   /* electric accent */
--danger:#E84A3A   /* recording dot */
--ok:    #16A34A   /* pasted confirmation */
```

**Shared primitives:**
- Rounded radius: 10 (inputs), 14 (cards), 999 (pills).
- Pill button (primary): black bg `#0A0A0A`, paper text, 13–14 px medium.
- Pill button (recording): black bg, volt-accent waveform + red dot.
- Card: white bg, 1 px `--rule` border, 14 px radius.
- Toggle (on): black background, white knob. No gradient.

**Display headline pattern:** sans-serif phrase with *one* italic-serif word, optionally highlighted in volt:
> Start *speaking.* Skip the typing.

#### 3a. Onboarding window

- 3-step flow: **Welcome → Connect Groq key → Done**.
- Top pill-nav: logo mark + "Yappr" + step counter (`02 / 03`).
- Headline (large serif-italic accent), one-sentence sub, then content block per step.
- Single black pill CTA. No back button chrome (just a subtle `← back` text link).

#### 3b. Settings window

- Left sidebar (180 px): logo + name + 4 nav items (General, Provider, Hotkey, About). Active item: inverted (black background, paper text).
- Main pane: serif-italic page title, sub, then cards grouping related rows.
- Rows have a left label + hint, side control. Consistent height (~56 px).
- Remove tab component from current implementation — sidebar replaces it.

#### 3c. Indicator pill

States:
- **Idle:** hidden by default. Optional "Hold ⌃ to talk" hint pill appears on tray-icon click or briefly after app launch.
- **Listening:** black pill, red pulsing dot, 6-bar volt-green waveform driven by real mic input, tiny monospace `HOLD` or `LOCKED` tag.
- **Transcribing:** black pill, volt-green spinner, "Transcribing" monospace label.
- **Pasted:** black pill, volt-green `✓ Pasted` — auto-dismisses after 1.2 s.
- **Error:** black pill with red accent + one-line human message (no stack traces, no stderr). Auto-dismisses after 4 s; clicking opens Settings → About for logs.

**Waveform data:** keep current `AnalyserNode` plumbing; re-skin bars with `--volt` color and tighter spacing (2 px bars, 2 px gaps, 14 px max height).

**Error handling change:** the pipeline must never surface raw stderr. Provider `transcribe()` wraps errors into `{ code: 'TRANSCRIBE_FAILED', userMessage: string }`. Indicator only shows `userMessage`.

### 4. Error-message cleanup (cross-cutting)

- Central `toUserError(err)` helper in `src/main/errors.ts` converts raw exceptions to `{ code, userMessage }`.
- Known cases: missing API key → "Add your Groq key in Settings." · network failure → "Couldn't reach Groq. Check your connection." · provider 401 → "Groq key rejected. Update it in Settings."
- Default: "Transcription failed. Open Settings for logs."

## Architecture

No structural changes. The existing main/renderer/preload split stays. New concerns slot in:

```
src/
  main/
    hotkeys.ts          # REPLACED: node-global-key-listener hold/dbltap
    errors.ts           # NEW: toUserError, error codes
    pipeline.ts         # simplified (no local-whisper branch)
    providers/
      groq.ts, openai.ts, anthropic.ts   # unchanged
      local-whisper.ts  # DELETED
  shared/
    theme.ts            # NEW: color + radius tokens consumed by Tailwind config
    constants.ts        # updated
    types.ts            # narrowed provider union
  renderer/
    onboarding/         # redesigned per 3a
    settings/           # sidebar layout per 3b; tabs removed
    indicator/          # redesigned per 3c
```

**Tailwind config** (`tailwind.config.js`) — pull color tokens from `theme.ts` so all three renderer windows share the same palette.

## Testing

- Manual: run the app, hold  Ctrl, speak, release — transcribed text pastes into focused app.
- Manual: double-tap  Ctrl to lock; single press stops.
- Manual: missing API key → friendly onboarding prompt, not a red pill.
- Manual: kill network → pill shows "Couldn't reach Groq. Check your connection."
- Smoke: indicator reaches Idle → Listening → Transcribing → Pasted without stuck state.
- Visual: take screenshots of all 3 windows, verify palette matches tokens.

Unit testing is light on this codebase; no new unit tests required. Behavior is verified by the live app flow.

## Open questions (resolved inline)

- Hotkey key: ** Ctrl** (user choice C).
- Local transcription: **deferred**, tracked for future (`whisper.cpp` bundled native).
- Palette: **Electric Paper** (option D). Cobalt/electric-blue experiment parked for a future iteration if volt-green doesn't feel  in practice.
- Framework: **stay on Electron**.

## Out of scope

- AI post-processing (cleanup of filler words, punctuation). The existing LLM step can stay as-is for now; if it misbehaves we'll address it in a follow-up.
- Menu-bar-only mode / dock hiding.
- Auto-update and code signing — handled separately in packaging config.
