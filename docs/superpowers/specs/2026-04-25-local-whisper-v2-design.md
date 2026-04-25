# Local Whisper (v2) — Design

**Date:** 2026-04-25
**Status:** Spec — implementation deferred
**Depends on:** v1 (cloud-only Groq) shipped

## Goal

Add an opt-in **local** transcription path so privacy-sensitive users and people without an API key can run Whisper directly on their machine. Must be:

1. Zero-config — bundled binary, no Python, no pip, no manual model downloads.
2. Reasonably fast on Apple Silicon (target <2× audio duration on M1).
3. Doesn't ship with the app (model is downloaded on first use to keep the .dmg under 50MB).
4. Falls back gracefully — if the local model isn't available, the app stays cloud-mode.

## Non-goals

- Replacing Groq as the default. Cloud stays default for new users — fast, free tier covers most.
- LLM cleanup pass for local mode. Local transcription pastes raw Whisper output. Cleanup is cloud-only (or off).
- Windows/Linux first-class support. Mac-first, others best-effort.

## Approach

Use **whisper.cpp** via the `smart-whisper` npm package. It's:
- C++ port of OpenAI Whisper, no Python
- Native Node addon, ships pre-built binaries for darwin-arm64 / darwin-x64 / linux-x64 / win32-x64
- Supports streaming and chunked transcription
- Apple Silicon: uses Core ML for acceleration

Alternative considered: `nodejs-whisper` (CLI-shelling) — rejected because spawning a process per dictation adds latency and the CLI binary needs separate distribution.

## Models

Ship support for three sizes; user picks in Settings:

| Model      | Size  | Quality | Speed (M1)       | Recommended for           |
|------------|-------|---------|------------------|---------------------------|
| `tiny.en`  | 75MB  | OK      | ~6× realtime     | Low-RAM, casual notes     |
| `base.en`  | 145MB | Good    | ~3× realtime     | **Default** — most users  |
| `small.en` | 466MB | Great   | ~1.2× realtime   | Quality-conscious, M2/M3+ |

`.en` (English-only) variants are smaller and faster than multilingual. We don't currently support multilingual dictation (Whisper's `language: 'en'` is hardcoded), so `.en` is fine.

Models download on first selection from Hugging Face's whisper.cpp repo to `~/Library/Application Support/openflow/models/`. Show download progress in Settings.

## Architecture

New provider file `src/main/providers/local-whisper.ts`:

```ts
import { Whisper } from 'smart-whisper'
import type { TranscriptionProvider } from './types'

let cached: Whisper | null = null
let cachedModelPath = ''

async function getInstance(modelPath: string): Promise<Whisper> {
  if (cached && cachedModelPath === modelPath) return cached
  cached?.free()
  cached = new Whisper(modelPath, { gpu: true })
  cachedModelPath = modelPath
  return cached
}

export function createLocalWhisperProvider(modelPath: string): TranscriptionProvider {
  return {
    name: 'Local',
    async transcribe(audio /* webm Buffer */) {
      // smart-whisper expects 16kHz mono PCM Float32. We need to decode
      // webm/opus -> raw PCM. wav-decoder + node-webm-decoder, or shell to
      // ffmpeg-static (already a dep we removed; reintroduce conditionally).
      const pcm = await decodeWebmToPCM16k(audio)
      const inst = await getInstance(modelPath)
      const { result } = await inst.transcribe(pcm, { language: 'en' })
      return result.map(r => r.text).join('').trim()
    },
  }
}
```

Provider settings extend with:
- `provider: 'local'` becomes valid again
- `localModel: 'tiny.en' | 'base.en' | 'small.en'`
- `localModelPath: string` (set after download completes)

`pipeline.ts` skips the cleanup step when `provider === 'local'` (since users opting into local typically also want privacy — no LLM round-trip).

## Settings UI

New tab "Local" or option within "Provider":

- Provider radio gains a 4th option: **Local · Whisper (offline)**
- When selected, show: model picker (tiny / base / small) with size + speed estimate
- "Download model" button → progress bar inline → "Downloaded ✓" with size on disk
- Toggle: "Run cleanup via cloud anyway" (off by default; pairs local transcription with cloud LLM cleanup if user wants the formatting but local mic privacy)

## Audio decoding

Whisper.cpp wants 16kHz mono PCM Float32. We currently send webm/opus to Groq, which decodes server-side. For local we have to decode in-process.

Two viable paths:
1. **wasm**: `@webav/av-cliper` or `extendable-media-recorder-wav-encoder` decode in renderer before IPC. Slower; pure JS.
2. **ffmpeg-static**: bring back `ffmpeg-static` and shell out, write to a temp file, read back PCM. Fast but adds 60MB to bundle.

Recommended: **renderer-side wasm decode** to keep the main bundle slim. The renderer already has the audio in MediaRecorder; it can decode and send PCM directly. Adds ~1MB wasm dep.

## File structure

- `src/main/providers/local-whisper.ts` — new
- `src/main/providers/local-model-download.ts` — new, manages model fetch + progress
- `src/shared/types.ts` — extend `Provider` union to include `'local'`, add `localModel` and `localModelPath` to `ProviderSettings`
- `src/shared/constants.ts` — `LOCAL_MODELS` map (id → URL + size + sha)
- `src/renderer/settings/tabs/AIProviderTab.tsx` — local option + model picker UI
- `src/main/pipeline.ts` — branch on `provider === 'local'` to skip cleanup or honor the cleanup-anyway toggle

## Risks

1. **smart-whisper native binary**: must be packaged correctly via electron-builder's `extraResources`. Mis-pack = runtime crash. Test on clean Mac.
2. **Apple Silicon Core ML**: needs the `.mlmodelc` companion file alongside the .bin. smart-whisper handles this if present; otherwise falls back to CPU (much slower). Models from Hugging Face's `ggerganov/whisper.cpp` repo include both.
3. **First-launch UX**: 145MB download takes ~30s on average broadband. Need a non-blocking progress indicator + the user shouldn't be locked out of cloud while it downloads.
4. **License**: whisper.cpp is MIT, OpenAI Whisper models are MIT. We're clear to bundle.

## Estimated scope

- ~1 day implementation (binary integration is fiddly)
- ~1 day testing across Macs (M1 / M2 / Intel / 8GB / 16GB)
- ~half day UI polish for model picker + download progress

Total: 2.5 working days.

## Decision log

- **smart-whisper over nodejs-whisper**: in-process speed.
- **.en models only**: matches current single-language hardcoding; avoids 2× model size.
- **Skip cleanup by default for local**: matches "local = private" expectation; togglable for users who want formatting.
- **Renderer-side audio decode**: keeps main bundle small.
