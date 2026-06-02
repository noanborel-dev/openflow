# Shared `transcribeCore` Seam (Phase 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the local-transcription decode parameters, bias-prompt construction, and silence/hallucination filtering into one shared module (`transcribe-core.ts`) so the one-shot provider and the future streaming session build **identical** decode options — eliminating the bias/decode-param drift the spec flags as the concrete code-switch divergence hazard.

**Architecture:** Today `src/main/providers/local.ts` builds Whisper decode options (`beamSize/bestOf/temperature/maxThreads/language/prompt`) inline and owns a single permissive `HALLUCINATION_STRINGS` set. We move that into `src/main/transcribe-core.ts` as: a pure `buildDecodeOptions()`, **two** distinct artifact sets (whole-utterance-permissive vs per-chunk-strict, per spec §4.4), and a thin `transcribeCore()` wrapper over `workerTranscribe`. The local provider is rewired onto these with **identical** runtime behavior. Pure functions get exhaustive unit tests; the provider rewire is a behavior-preserving refactor verified by typecheck + the existing dictation path.

**Tech Stack:** TypeScript, `@fugood/whisper.node` (`TranscribeOptions`), vitest (added in the previous plan). The new helpers are pure (no Electron/native deps) so their tests run cleanly under vitest.

**Scope — deferred (with reasons):**
- **Detected-language echo, forced per-chunk language, `cancel`** — the binding supports all of these (`TranscribeResult.language?`, `TranscribeOptions.language?`, `transcribeData().stop()`), but **nothing consumes them yet**. They're driven by the orchestrator's M5 language-inheritance + abort logic, so they ship in that plan (built + tested against their consumer). YAGNI. `transcribeCore` therefore returns `{text, segments, ms}` for now and grows `language` then.
- **Full triplicate-dedup of hallucination sets across `pipeline.ts`** — `pipeline.ts` keeps its own whole-utterance set for now; this plan relocates *local.ts's* copy into the shared module and adds the strict per-chunk set. The grand dedup is part of the later pipeline-refactor plan (noted to avoid pretending it's done).

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/main/transcribe-core.ts` | `buildDecodeOptions`, `WHOLE_UTTERANCE_HALLUCINATIONS` + `CHUNK_ARTIFACTS` sets, `isLikelyHallucination` (permissive, whole-utterance), `isChunkArtifact` (strict, per-chunk), `transcribeCore` wrapper. | **Create** |
| `src/main/transcribe-core.test.ts` | Unit tests for the pure helpers. | **Create** |
| `src/main/providers/local.ts` | Rewire onto `transcribe-core` (remove inline decode-opts + the local hallucination set). Behavior-identical. | **Modify** |

---

## Task 1: `buildDecodeOptions` (TDD)

**Files:**
- Create: `src/main/transcribe-core.ts`
- Test: `src/main/transcribe-core.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/main/transcribe-core.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildDecodeOptions } from './transcribe-core'

describe('buildDecodeOptions', () => {
  it('uses deterministic greedy decode params', () => {
    const o = buildDecodeOptions()
    expect(o.beamSize).toBe(1)
    expect(o.bestOf).toBe(1)
    expect(o.temperature).toBe(0)
    expect(o.maxThreads).toBe(4)
  })

  it("defaults language to 'auto'", () => {
    expect(buildDecodeOptions().language).toBe('auto')
    expect(buildDecodeOptions({ language: undefined }).language).toBe('auto')
  })

  it('honors a forced language', () => {
    expect(buildDecodeOptions({ language: 'fr' }).language).toBe('fr')
  })

  it('joins the dictionary into the bias prompt', () => {
    expect(buildDecodeOptions({ dictionary: ['Yappr', 'tRPC'] }).prompt).toBe('Yappr, tRPC')
  })

  it('omits prompt entirely when the dictionary is empty', () => {
    expect('prompt' in buildDecodeOptions()).toBe(false)
    expect('prompt' in buildDecodeOptions({ dictionary: [] })).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./transcribe-core"`.

- [ ] **Step 3: Implement `buildDecodeOptions` (create the module)**

Create `src/main/transcribe-core.ts`:
```ts
import { workerTranscribe } from './whisper-host'
import type { TranscribeOptions } from '@fugood/whisper.node'

export interface DecodeParams {
  // Whisper bias dictionary → initial prompt (biases toward known spellings).
  dictionary?: string[]
  // Forced language code, or undefined to auto-detect. Defaults to 'auto'.
  language?: string
}

// The canonical decode options shared by EVERY local transcribe — the
// one-shot provider, command mode, and (soon) streaming chunks — so
// decode params and the bias prompt never drift between paths. Drift is
// the concrete code-switch divergence hazard the spec calls out.
export function buildDecodeOptions(params: DecodeParams = {}): TranscribeOptions {
  const dict = params.dictionary ?? []
  const prompt = dict.length > 0 ? dict.join(', ') : undefined
  return {
    // Greedy decoding (beam=1, best_of=1, temp=0): faster AND
    // deterministic. Dictation values "same audio -> same transcript".
    beamSize: 1,
    bestOf: 1,
    temperature: 0,
    // M-series has ~6 perf cores; >4 threads spills onto E-cores
    // (3-4x slower per thread).
    maxThreads: 4,
    // All local models are multilingual; 'auto' lets users code-switch
    // without rebinding the setting.
    language: params.language ?? 'auto',
    ...(prompt ? { prompt } : {}),
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npm test`
Expected: PASS — 5 `buildDecodeOptions` tests green.

- [ ] **Step 5: Commit**

```bash
git add src/main/transcribe-core.ts src/main/transcribe-core.test.ts
git commit -m "feat(transcribe): add buildDecodeOptions (shared local decode params)"
```

---

## Task 2: Two hallucination sets + checks (TDD)

**Files:**
- Modify: `src/main/transcribe-core.ts`
- Modify: `src/main/transcribe-core.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `src/main/transcribe-core.test.ts` (add the import for the two new functions to the existing import line, then add the describe block):

Change the top import line to:
```ts
import { buildDecodeOptions, isLikelyHallucination, isChunkArtifact } from './transcribe-core'
```

Add at the end of the file:
```ts
describe('isLikelyHallucination (whole-utterance, permissive)', () => {
  it('flags empty / pure-punctuation / known artifacts', () => {
    expect(isLikelyHallucination('')).toBe(true)
    expect(isLikelyHallucination('...')).toBe(true)
    expect(isLikelyHallucination('[blank_audio]')).toBe(true)
    expect(isLikelyHallucination('Thanks for watching!')).toBe(true)
  })

  it('flags bare real-word artifacts as a WHOLE utterance', () => {
    expect(isLikelyHallucination('you')).toBe(true)
    expect(isLikelyHallucination('thanks')).toBe(true)
  })

  it('flags sub-2-char output', () => {
    expect(isLikelyHallucination('a')).toBe(true)
  })

  it('passes real speech', () => {
    expect(isLikelyHallucination('ship the pricing tomorrow')).toBe(false)
  })
})

describe('isChunkArtifact (per-chunk, strict)', () => {
  it('flags only true artifact tokens', () => {
    expect(isChunkArtifact('')).toBe(true)
    expect(isChunkArtifact('[silence]')).toBe(true)
    expect(isChunkArtifact('(soft music)')).toBe(true)
  })

  it('does NOT drop real words that the whole-utterance set rejects', () => {
    // Mid-stream, "thanks" / "you" can be real speech — never drop them.
    expect(isChunkArtifact('thanks')).toBe(false)
    expect(isChunkArtifact('you')).toBe(false)
  })

  it('does NOT reject on length (a short chunk can be real)', () => {
    expect(isChunkArtifact('a')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — verify the new ones fail**

Run: `npm test`
Expected: FAIL — `isLikelyHallucination`/`isChunkArtifact` are not exported.

- [ ] **Step 3: Implement the two sets + checks**

Add to `src/main/transcribe-core.ts` (after the imports, before `buildDecodeOptions`):
```ts
// Whisper-cpp hallucinates these strings on silent / near-silent audio.
// TWO distinct sets (spec §4.4):
//
//  - WHOLE_UTTERANCE_HALLUCINATIONS: PERMISSIVE — used to bail on a full
//    assembled transcript (the one-shot / pipeline silence bail).
//    Includes real words like "you" / "thanks" that, as an ENTIRE
//    utterance, are almost always silence artifacts.
//
//  - CHUNK_ARTIFACTS: STRICT — used per-chunk during streaming. ONLY true
//    Whisper artifact tokens, NEVER real words: dropping a chunk that
//    legitimately said "thanks" mid-stream would delete real speech. A
//    pure-artifact chunk is dropped-and-continue, never aborts the session.
export const WHOLE_UTTERANCE_HALLUCINATIONS = new Set<string>([
  '', '.', '...',
  'thanks for watching', 'thanks for watching!',
  'thank you', 'thank you.',
  'thanks', 'you', 'bye', 'bye.',
  '[blank_audio]', '[silence]', '[music]', '[no audio]',
  '(silence)', '(soft music)',
])

export const CHUNK_ARTIFACTS = new Set<string>([
  '', '.', '...',
  '[blank_audio]', '[silence]', '[music]', '[no audio]',
  '(silence)', '(soft music)',
])

function normalizeForArtifactCheck(text: string): string {
  return text.trim().toLowerCase().replace(/[.!?,]+$/g, '')
}

// Whole-utterance check: is this assembled transcript just a silence
// artifact? Permissive (real-word artifacts included); also rejects
// sub-2-char output.
export function isLikelyHallucination(text: string): boolean {
  const cleaned = normalizeForArtifactCheck(text)
  if (cleaned.length === 0) return true
  if (WHOLE_UTTERANCE_HALLUCINATIONS.has(cleaned)) return true
  if (cleaned.length < 2) return true
  return false
}

// Per-chunk check: is this chunk PURE artifact (drop it, keep streaming)?
// STRICT — only true artifacts, never real words, and NO length rejection
// (a legit 1-char chunk like "A" can be real mid-stream).
export function isChunkArtifact(text: string): boolean {
  const cleaned = normalizeForArtifactCheck(text)
  if (cleaned.length === 0) return true
  return CHUNK_ARTIFACTS.has(cleaned)
}
```

- [ ] **Step 4: Run tests — verify all pass**

Run: `npm test`
Expected: PASS — all `transcribe-core` tests (buildDecodeOptions + both hallucination describes).

- [ ] **Step 5: Commit**

```bash
git add src/main/transcribe-core.ts src/main/transcribe-core.test.ts
git commit -m "feat(transcribe): two distinct hallucination sets (whole-utterance vs per-chunk)"
```

---

## Task 3: `transcribeCore` wrapper + rewire the local provider

**Files:**
- Modify: `src/main/transcribe-core.ts`
- Modify: `src/main/providers/local.ts`

- [ ] **Step 1: Add the `transcribeCore` wrapper**

Append to `src/main/transcribe-core.ts`:
```ts
export interface TranscribeCoreResult {
  text: string
  segments: Array<{ text: string; t0: number; t1: number }>
  ms: number
}

// The shared transcription core: given PCM + a model path + decode
// params, run one inference through the whisper worker and return the
// raw result. Stateless. The one-shot provider (and, soon, the streaming
// session) both call this so they build identical decode options.
// Hallucination filtering and tier selection stay with the CALLER —
// they differ per path (whole-utterance bail vs per-chunk drop).
export async function transcribeCore(
  modelPath: string,
  pcm: ArrayBuffer,
  params: DecodeParams = {},
  onPartial?: (text: string) => void,
): Promise<TranscribeCoreResult> {
  return workerTranscribe(modelPath, pcm, buildDecodeOptions(params), onPartial)
}
```

- [ ] **Step 2: Typecheck the new wrapper**

Run: `npm run typecheck`
Expected: exit 0. (`workerTranscribe` returns `{text, segments, ms}`, which matches `TranscribeCoreResult`.)

- [ ] **Step 3: Rewire `local.ts` — imports**

In `src/main/providers/local.ts`:

Replace the worker-host import:
```ts
import { workerTranscribe, workerFree } from '../whisper-host'
```
with:
```ts
import { workerFree } from '../whisper-host'
import { transcribeCore, isLikelyHallucination } from '../transcribe-core'
```

- [ ] **Step 4: Rewire `local.ts` — delete the relocated hallucination set + local check**

Delete the entire `HALLUCINATION_STRINGS` set declaration (the `const HALLUCINATION_STRINGS = new Set([ ... ])` block near the top, including its leading comment) and the local `isLikelyHallucination` function (the `function isLikelyHallucination(text: string): boolean { ... }` block) — both now come from `../transcribe-core`.

- [ ] **Step 5: Rewire `local.ts` — use `transcribeCore` in the transcribe body**

Replace this block (the decode-options construction + `workerTranscribe` call):
```ts
      const dict = options.dictionary ?? []
      const prompt = dict.length > 0 ? dict.join(', ') : undefined
      // All current local models are multilingual; auto-detect lets
      // users switch between languages without rebinding the setting.
      // The detection pass is fast on small/base (~10-20ms) and the
      // wins for bilingual / trilingual users are large.
      const language = options.language ?? 'auto'

      // Inference runs in the whisper utility process — see
      // src/main/whisper-host.ts and src/main/whisper-worker.ts.
      // Doing it there instead of in main avoids Chromium's macOS
      // QoS class downgrade (especially under LSUIElement) which
      // would otherwise halve the Metal command-queue throughput.
      const inferStart = Date.now()
      const result = await workerTranscribe(
        localModelPath(modelId),
        pcm,
        {
          // Greedy decoding (beam=1, best_of=1, temp=0) is faster AND
          // more deterministic than the default beam=5. Dictation
          // values determinism — same audio → same transcript —
          // and the accuracy delta on clean speech is negligible.
          beamSize: 1,
          bestOf: 1,
          temperature: 0,
          // M-series has ~6 performance cores; more threads pushes
          // work onto efficiency cores (3-4x slower per thread).
          // 4 threads ties 8 threads on M5 Pro standalone and leaves
          // headroom for the rest of the app.
          maxThreads: 4,
          language,
          // Dictionary becomes Whisper's initial prompt — biases
          // toward known spellings.
          ...(prompt ? { prompt } : {}),
        },
        // Forward fugood's per-segment callback through the worker IPC
        // to the pipeline. The caller drives the indicator pill with
        // these so the user sees words appearing as whisper produces
        // them — perceived latency on a 35s clip drops from ~1400ms to
        // ~200ms (time to first segment).
        options.onPartial
      )
      const inferMs = Date.now() - inferStart
```
with:
```ts
      // Inference runs in the whisper utility process — see
      // src/main/whisper-host.ts and src/main/whisper-worker.ts.
      // Doing it there instead of in main avoids Chromium's macOS QoS
      // class downgrade (especially under LSUIElement) which would
      // otherwise halve the Metal command-queue throughput. Decode
      // params + bias prompt come from the shared transcribeCore so the
      // one-shot and streaming paths never drift.
      const inferStart = Date.now()
      const result = await transcribeCore(
        localModelPath(modelId),
        pcm,
        { dictionary: options.dictionary ?? [], language: options.language },
        // Forward fugood's per-segment callback so the indicator can show
        // words as whisper produces them (time-to-first-segment ~200ms).
        options.onPartial,
      )
      const inferMs = Date.now() - inferStart
```

- [ ] **Step 6: Typecheck + tests + full review**

Run:
```bash
npm run typecheck && npm test
```
Expected: typecheck exit 0; all tests pass.

Then confirm by reading the modified `local.ts`:
- `transcribeCore` and `isLikelyHallucination` are imported from `../transcribe-core`; `workerTranscribe` is no longer imported (only `workerFree`).
- No remaining local `HALLUCINATION_STRINGS` / local `isLikelyHallucination` definitions.
- The `logInfo('Local whisper inference', ...)` call still reads `result.ms` and the `text`/hallucination check below it is unchanged (still calls `isLikelyHallucination(text)`).
- Behavior is identical: same decode params (1/1/0/4 + `language ?? 'auto'` + dict-prompt), same hallucination bail.

- [ ] **Step 7: Commit**

```bash
git add src/main/transcribe-core.ts src/main/providers/local.ts
git commit -m "refactor(local): route one-shot transcription through shared transcribeCore"
```

---

## Self-Review

**1. Spec coverage.** Implements the 0c [MED] "Shared `transcribeCore` extraction" and the §4.4 "two distinct hallucination/silence sets (per-chunk strict vs whole-utterance permissive)". Deferred items (language echo / forced language / cancel / full pipeline-set dedup) are listed under "Scope" with reasons — none silently dropped.

**2. Placeholder scan.** No `TBD`/`TODO`/"handle edge cases"; every code step has complete code; every run step has a command + expected result.

**3. Type consistency.** `buildDecodeOptions(params?: DecodeParams): TranscribeOptions` and `transcribeCore(modelPath, pcm, params?: DecodeParams, onPartial?) : Promise<TranscribeCoreResult>` are used identically in `local.ts`. `TranscribeCoreResult` (`{text, segments, ms}`) matches `workerTranscribe`'s current return type, so the wrapper is a pass-through and `result.ms` keeps working in `local.ts`'s log line. `DecodeParams.dictionary?: string[]` matches `options.dictionary ?? []`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-02-streaming-phase0-transcribe-core.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between.
2. **Inline Execution** — execute here with checkpoints (the rhythm we used for Plan 1).

Which approach?
