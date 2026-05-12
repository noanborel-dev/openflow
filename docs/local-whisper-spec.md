# Local Whisper — Implementation Spec

**Status:** Ready to build. Replaces all previous attempts.

## Goal

Ship local on-device transcription as an alternative to the current cloud (Groq/OpenAI/Anthropic) providers. Match Wispr Flow / Willow Voice's sub-1-second consistent latency, offline operation, and free-after-purchase business model.

## Why

Cloud Whisper has a hard floor:

- Short clips (~20–40 chars output): ~700–900ms typical, includes ~150ms TLS + ~400–700ms Groq processing + ~50ms paste
- Long clips: scales linearly with audio length (Groq processes at ~real-time speed)
- Network tail outliers: 2–3s spikes on Groq's slow days

whisper.cpp on M-series Apple Silicon:

- Short clips: ~300–500ms steady
- Long clips: ~3–5× faster than real-time (a 30s clip = ~200ms)
- No network tail
- Battery: ~0.005% per dictation; ~1–2% per heavy day. Not noticeable.

This is what Willow Voice ships. They charge $12/mo and pocket the margin because per-dictation cost is zero.

## What we already have (and what got reverted)

We attempted this in commit **`7a2a3cb`** (`feat(local): scaffold local Whisper provider via whisper-cli + ffmpeg`) and reverted it in commit **`38efdbf`**. That attempt:

- Shelled out to `/opt/homebrew/bin/whisper-cli` and `/opt/homebrew/bin/ffmpeg`
- Required user to `brew install whisper-cpp ffmpeg` manually
- Stored `ggml-large-v3-turbo-q5_0.bin` (547MB) at `~/Library/Application Support/OpenFlow/models/`
- Wired `provider: 'local'` into the type union and `buildProviders()` in `src/main/pipeline.ts`
- Added basic hallucination detection mapping (same thresholds as the Groq provider)

It was reverted because (a) Homebrew is a non-starter for distribution to end users, and (b) the user kept changing direction. The reasons no longer apply — distribution is now table stakes (we have `electron-builder` set up, a GitHub Actions release workflow, the whole landing-page plan), and the user has committed to this path.

The reverted code is at `git show 7a2a3cb` — useful as a starting reference for the provider interface, IPC plumbing, and hallucination thresholds. **Don't restore it as-is** — see Distribution below for why.

## Constraints

1. **No Homebrew dep.** The user runs `OpenFlow.app`; they should not need to install anything else. Ship the `whisper-cli` binary inside the `.app`'s `Resources/`.
2. **Mac + Windows.** macOS Apple Silicon is the primary target (where whisper.cpp's Metal acceleration shines). Windows comes second; whisper.cpp has Windows binaries but no Metal — performance gap is acceptable.
3. **Model lives in user-data, not the bundle.** The `ggml-large-v3-turbo-q5_0.bin` model is ~547MB. Bundling it doubles the installer size and most users would never use the local mode. First-run download UX instead: settings tab "Local" button → download with progress → ready to use.
4. **Cloud must keep working alongside.** Existing Groq/OpenAI/Anthropic flows continue. Provider switch is in Settings → Provider (already has the radio cards). Local becomes a fourth card.
5. **Battery budget.** ~300–500ms compute on M-series per short clip. Acceptable. Don't keep whisper.cpp warm in memory between dictations — spawn fresh per call.

## Architecture

```
┌─ User hotkey ─┐
│  audio out    │
└────┬──────────┘
     ▼
┌────────────────────────────────────┐
│ pipeline.ts — runDictationPipeline │
│   transcription.transcribe(audio)  │ ← provider abstraction
└──────┬─────────────────────────────┘
       ▼
┌─────────────────────────┐
│ createLocalWhisperProvider │
│  if model not downloaded │
│   → throw LocalModelMissingError
│  else                    │
│   → fork whisper-cli     │
│   → pipe webm audio thru ffmpeg-static into 16kHz mono wav
│   → parse JSON output    │
│   → apply hallucination check (same thresholds as groq.ts)
│   → return transcript    │
└─────────────────────────┘
```

The `TranscriptionProvider` interface in `src/main/providers/types.ts` already exists. We just need a new file `src/main/providers/local.ts` and a switch in `buildProviders()`.

## Distribution

This is the part we got wrong last time. Two binaries need to ship inside the `.app`:

1. **`whisper-cli`** — compiled from whisper.cpp source, Metal enabled on macOS, statically linked where possible.
2. **`ffmpeg`** — to convert the renderer's webm/opus audio into 16kHz mono PCM wav for whisper.cpp.

### Two options for shipping these

**A. Use prebuilt npm packages** (recommended start)

- `whisper-cpp-prebuilt` or similar — bundles compiled whisper.cpp binaries per platform/arch
- `ffmpeg-static` — well-known npm package with prebuilt ffmpeg binaries

These live in `node_modules/` and get bundled via `electron-builder.yml`'s `asarUnpack` (so the spawned subprocess can find them). We had `ffmpeg-static` in the deps list earlier; it's referenced in older `electron-builder.yml` (now cleaned out — re-add).

**B. Compile + commit our own binaries**

- Clone whisper.cpp at a pinned commit, build with `WHISPER_METAL=1`, commit the `whisper-cli` binary to `bin/macos-arm64/whisper-cli`
- Same for `bin/macos-x64/whisper-cli`, `bin/win32-x64/whisper-cli.exe`
- ffmpeg: same approach or download in CI

A is faster to ship and we can swap to B later when we want to control the binary version. Start with A.

### Code-signing implications

When a `.app` ships embedded binaries:

- They have to be signed with the same Developer ID Application certificate as the parent app, or Gatekeeper rejects them at launch
- electron-builder handles this automatically as long as `mac.hardenedRuntime: true` is set (it is) and the binaries are inside `Contents/Resources/`
- The `node_modules/<pkg>/bin/<binary>` path of an npm prebuilt package needs to be in `asarUnpack` so it survives asar packing AND so the file system path stays valid for `spawn()`
- Test signing locally with `CSC_IDENTITY_AUTO_DISCOVERY=true` once you have a cert, but the release workflow (`.github/workflows/release.yml`) already handles signing/notarization when secrets are present

## First-run UX

When the user picks "Local" in Settings → Provider:

1. Check `whisperModelDownloaded()` (we have this helper, see reverted `src/main/local-models.ts`)
2. If not downloaded:
   - Replace the provider card body with a "Download model (547MB)" button + a progress bar
   - Stream the model from HuggingFace (`https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin`) to `~/Library/Application Support/OpenFlow/models/ggml-large-v3-turbo-q5_0.bin` with a `.partial` rename-on-completion pattern
   - On completion, flip the radio to selected
3. If downloaded:
   - Show a "✓ Ready" badge and the model size
   - Add an "Uninstall model" button that deletes the file

The same flow should be in the onboarding Provider step (step 3) — currently shows only Cloud providers.

## Acceptance criteria

A user should be able to:

1. Download the `.dmg` from GitHub Releases (or whatever distribution channel we land on)
2. Install OpenFlow, complete onboarding choosing "Local"
3. See a model download with progress (~30–60s on typical broadband)
4. Press the hotkey, dictate, see text appear in their target app within ~500ms for short clips, ~800ms for medium-length clips
5. Disconnect WiFi entirely, repeat step 4 — same result
6. Switch back to Cloud in Settings, dictate again — uses Groq as before

Battery hit per dictation should be measurable but unremarkable in `pmset` logs. Total app size after model download: ~600MB.

## Phasing

Suggested chunks for the new session:

1. **Re-add `local` provider type + skeleton** — `Provider` union in `src/shared/types.ts`, `local` entry in `MODELS` in `src/shared/constants.ts`, dead `createLocalWhisperProvider` function that throws "not implemented". Verify it doesn't break anything. ~30 min.
2. **Wire `whisper-cpp-prebuilt` + `ffmpeg-static` deps and bundling** — npm install, `electron-builder.yml` `asarUnpack`, smoke test by spawning `whisper-cli --version` from main process. ~1 hr.
3. **Implement transcribe()** — full audio → wav → whisper → text flow with hallucination detection. Test locally with the model file dropped into `userData/models/`. ~1–2 hr.
4. **Model download UX** — IPC, progress events, partial-file resume, file integrity check. Wire into Settings → Provider Local card. ~2 hr.
5. **Onboarding integration** — surface Local as a fourth provider card in onboarding step 3, with the download flow inline. ~30 min.
6. **CI + signed build** — verify the next release workflow run produces a signed `.dmg` where Local mode works on a fresh machine. ~1 hr.

Total: ~half a day of focused work for a developer who already has Apple Developer signing credentials configured.

## Things we deliberately are NOT doing

- **Bundling the model.** Doubles installer size; most users never use Local. Download on demand.
- **Multiple model sizes.** Just `large-v3-turbo-q5_0`. Smaller models (medium, small) have noticeably worse quality and the disk savings aren't compelling. If we add sizes later it's a settings toggle.
- **Streaming transcription.** whisper.cpp supports streaming via `--stream` but the integration is messy (continuous audio buffer management, partial-result paste vs. final-result paste decisions). Ship one-shot first; streaming is a v2 optimization.
- **Local cleanup LLM.** Out of scope. Cleanup stays cloud (Groq llama-8b) for now. Local LLM via Apple Foundation Models is a separate future bet.

## Starter prompt for the new session

Paste this into the new Claude Code tab:

> I want to add local on-device transcription to OpenFlow using whisper.cpp. Read `docs/local-whisper-spec.md` for the full plan, then start with phase 1: re-add the `local` provider type and skeleton without breaking anything. We're in `/Users/noanborel/OpenFlow`, on `main`. The reverted earlier attempt is at `git show 7a2a3cb` if you want reference code for the provider interface.

That's enough context — the new session can read the spec, look at the reverted commit for reference, and start clean.
