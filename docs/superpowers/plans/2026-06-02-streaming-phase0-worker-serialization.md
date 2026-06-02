# Whisper Worker Serialization (Phase 0 / M1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guarantee that the whisper worker never runs two `ctx.transcribeData()` calls concurrently (must-fix **M1**), by routing every transcribe through a host-side FIFO `SerialQueue`.

**Architecture:** Today `workerTranscribe` (`src/main/whisper-host.ts`) `proc.send`s a `transcribe` message the instant it's called, and the worker (`src/main/whisper-worker.ts`) runs `void handle(msg)` per message. Nothing serializes them — fine today (the pipeline transcribes once per dictation) but a crash the moment streaming issues overlapping chunk transcribes onto the single, non-reentrant `WhisperContext`. We extract a tiny pure `SerialQueue` (at-most-one-task-in-flight, FIFO, error-isolated), unit-test it exhaustively, then wrap the body of `workerTranscribe` in `queue.run(...)`. The worker stays unchanged; serialization happens host-side, exactly as the spec prescribes ("chain on the existing pending ids in `workerTranscribe`").

**Tech Stack:** TypeScript, Node `child_process` IPC, `@fugood/whisper.node`. Tests: **vitest** (newly added — the repo has no test runner yet). The `SerialQueue` is pure and imports nothing, so its tests run under vitest with no Electron/native deps.

**Scope — what this plan does NOT cover (deferred to later Phase-0 plans, with reasons):**
- **2-context model cache** — an optimization for *between*-dictation tier switches. Within one utterance the tier is locked, so a single resident context suffices mid-stream (spec §4.4 RAM note: default cache=1). Not an M1 prerequisite.
- **Worker protocol additions** (echo `language` + forced per-chunk `language` + `cancel` + model identity) — these are [MED] and belong with the Orchestrator/Provider work that consumes them. Separate "Worker protocol for streaming" plan.
- **Routing `workerFree` through the queue** — `free` isn't called during active transcription today; the M1 crash is specifically *concurrent transcribes*. Noted as follow-up hardening.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/main/serial-queue.ts` | The `SerialQueue` primitive (at-most-one-in-flight, FIFO, error-isolated). Pure; no imports. | **Create** |
| `src/main/serial-queue.test.ts` | Unit tests proving the serialization invariant, FIFO order, and error isolation. | **Create** |
| `vitest.config.ts` | Vitest config (node environment, `src/**/*.test.ts`). | **Create** |
| `package.json` | Add `vitest` devDependency + `test` / `test:watch` scripts. | **Modify** |
| `src/main/whisper-host.ts` | Route `workerTranscribe`'s body through a module-level `SerialQueue` (the M1 fix). | **Modify** |
| `src/main/whisper-worker.ts` | Comment-only: correct the stale "cumulative transcript" note (fugood emits only new segments). No behavior change. | **Modify** |

---

## Task 1: Set up the vitest test runner

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/main/serial-queue.test.ts` (smoke test first; real tests in Task 2)

- [ ] **Step 1: Install vitest**

Run:
```bash
npm install -D vitest
```
Expected: `vitest` appears under `devDependencies` in `package.json`, lockfile updates.

- [ ] **Step 2: Create the vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Plain Node — the units under test (SerialQueue) are pure and
    // pull in no Electron / native deps.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Add test scripts to `package.json`**

In the `"scripts"` block of `package.json`, add (alongside the existing `lint` / `typecheck`):
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 4: Write a smoke test**

Create `src/main/serial-queue.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('vitest smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run it — verify vitest works**

Run:
```bash
npm test
```
Expected: PASS — `1 passed`. (If vitest can't find the config, confirm `vitest.config.ts` is at repo root.)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/main/serial-queue.test.ts
git commit -m "test: add vitest runner + smoke test"
```

---

## Task 2: The `SerialQueue` primitive (TDD)

**Files:**
- Create: `src/main/serial-queue.ts`
- Test: `src/main/serial-queue.test.ts` (replace the smoke test)

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `src/main/serial-queue.test.ts` with:
```ts
import { describe, it, expect } from 'vitest'
import { SerialQueue } from './serial-queue'

const tick = () => new Promise<void>((r) => setTimeout(r, 5))

describe('SerialQueue', () => {
  it('runs at most one task at a time (no overlap)', async () => {
    const q = new SerialQueue()
    let active = 0
    let maxActive = 0
    const task = async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await tick()
      active--
    }
    await Promise.all([q.run(task), q.run(task), q.run(task)])
    expect(maxActive).toBe(1)
  })

  it('runs tasks in FIFO submission order', async () => {
    const q = new SerialQueue()
    const order: number[] = []
    const make = (n: number) => async () => {
      await tick()
      order.push(n)
    }
    await Promise.all([q.run(make(1)), q.run(make(2)), q.run(make(3))])
    expect(order).toEqual([1, 2, 3])
  })

  it('propagates a task return value to its own caller', async () => {
    const q = new SerialQueue()
    await expect(q.run(async () => 42)).resolves.toBe(42)
  })

  it('does not let a rejecting task block later tasks', async () => {
    const q = new SerialQueue()
    const boom = q.run(async () => {
      throw new Error('boom')
    })
    const after = q.run(async () => 'ok')
    await expect(boom).rejects.toThrow('boom')
    await expect(after).resolves.toBe('ok')
  })

  it('interleaves start/end strictly (task N finishes before N+1 starts)', async () => {
    const q = new SerialQueue()
    const log: string[] = []
    const make = (n: number) => async () => {
      log.push(`start${n}`)
      await Promise.resolve()
      log.push(`end${n}`)
    }
    await Promise.all([q.run(make(1)), q.run(make(2))])
    expect(log).toEqual(['start1', 'end1', 'start2', 'end2'])
  })
})
```

- [ ] **Step 2: Run the tests — verify they fail**

Run:
```bash
npm test
```
Expected: FAIL — `Failed to resolve import "./serial-queue"` (the module doesn't exist yet).

- [ ] **Step 3: Implement `SerialQueue`**

Create `src/main/serial-queue.ts`:
```ts
// A FIFO queue that runs at most one async task at a time.
//
// Why this exists: the whisper worker holds a single, non-reentrant
// WhisperContext. Calling ctx.transcribeData() twice concurrently
// corrupts state / crashes. Streaming is the first code path that can
// issue overlapping transcribe requests (e.g. a final chunk arriving
// while an earlier chunk is still decoding on a slow machine). Routing
// every worker transcribe through one SerialQueue guarantees the
// invariant: at most one transcribeData in flight at a time, in
// submission (FIFO) order.
//
// A failed task does NOT block the queue — the next task still runs,
// and the rejection still propagates to the caller that submitted it.
export class SerialQueue {
  // The tail of the chain. Each run() appends to it. We keep the tail
  // as an error-swallowing promise so one rejecting task can't poison
  // the chain for everyone behind it.
  private tail: Promise<unknown> = Promise.resolve()

  run<T>(task: () => Promise<T>): Promise<T> {
    // Start `task` only after the previous task has SETTLED — whether
    // it resolved or rejected (both handlers run task()).
    const result = this.tail.then(() => task(), () => task())
    // Advance the tail to a promise that settles when `result` does but
    // never rejects, so the next task isn't blocked by this failure.
    this.tail = result.then(() => undefined, () => undefined)
    return result
  }
}
```

- [ ] **Step 4: Run the tests — verify they pass**

Run:
```bash
npm test
```
Expected: PASS — all 5 `SerialQueue` tests green.

- [ ] **Step 5: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/main/serial-queue.ts src/main/serial-queue.test.ts
git commit -m "feat(worker): add SerialQueue primitive (at-most-one-in-flight FIFO)"
```

---

## Task 3: Route `workerTranscribe` through the `SerialQueue` (the M1 fix)

**Files:**
- Modify: `src/main/whisper-host.ts`

This wraps the existing `workerTranscribe` body in `transcribeQueue.run(...)`. The whole body — `loadModel` + `proc.send({transcribe})` + awaiting the result — runs inside one serialized task, so the worker never receives a second `transcribe` until the prior one's `result`/`error` has come back. No deadlock: the `loaded`/`result` messages are delivered by `child.on('message')` independently of the queue, which resolves the awaited promises.

- [ ] **Step 1: Import `SerialQueue` and create the module-level queue**

In `src/main/whisper-host.ts`, add the import next to the existing imports at the top:
```ts
import { SerialQueue } from './serial-queue'
```

Then, immediately after the existing module-level state declarations (after the line `let nextRequestId = 1`), add:
```ts
// Serializes ALL worker transcribes so the single non-reentrant
// WhisperContext only ever has one transcribeData() in flight (M1).
// Streaming issues overlapping chunk transcribes; without this they
// would race on the shared context and crash.
const transcribeQueue = new SerialQueue()
```

- [ ] **Step 2: Wrap the `workerTranscribe` body in `transcribeQueue.run`**

Replace the current `workerTranscribe` function (the `export async function workerTranscribe(...) { ... }` block) with:
```ts
export async function workerTranscribe(
  modelPath: string,
  pcm: ArrayBuffer,
  options: TranscribeOptions,
  onPartial?: (text: string) => void,
): Promise<{ text: string; segments: Array<{ text: string; t0: number; t1: number }>; ms: number }> {
  // Serialize the entire load+send+await sequence. The queue guarantees
  // the worker never has two transcribeData() calls in flight at once
  // (M1). loadModel() is awaited INSIDE the task, so a model load can't
  // interleave with another task's transcribe either.
  return transcribeQueue.run(async () => {
    await loadModel(modelPath)
    const id = nextRequestId++
    const result = new Promise<{ text: string; segments: Array<{ text: string; t0: number; t1: number }>; ms: number }>((resolve, reject) => {
      pending.set(id, { resolve, reject, onPartial })
    })
    // Node IPC can't send ArrayBuffer directly. Buffer.from(pcm) wraps
    // it, then we encode as base64 in the message envelope. Worker
    // decodes back to ArrayBuffer. ~5ms encode + decode for 200KB of
    // PCM, vs ~1000ms inference — negligible.
    const pcmBase64 = Buffer.from(pcm).toString('base64')
    proc!.send({ type: 'transcribe', id, pcmBase64, options })
    return result
  })
}
```

- [ ] **Step 3: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: exit 0. (The change is a mechanical wrap; types are unchanged.)

- [ ] **Step 4: Re-run the SerialQueue tests (the invariant they prove now backs this call path)**

Run:
```bash
npm test
```
Expected: PASS — the 5 SerialQueue tests. These prove the at-most-one-in-flight invariant that `workerTranscribe` now relies on. (`whisper-host.ts` itself isn't imported in tests because it pulls in Electron + the native addon; the risky logic is the queue, which is fully covered.)

- [ ] **Step 5: Manual integration sanity check (reviewer checklist — no code)**

Confirm by reading the modified `workerTranscribe`:
- The `loadModel`, `nextRequestId++`, `pending.set`, base64 encode, and `proc!.send` all sit **inside** the `transcribeQueue.run(async () => { ... })` callback.
- The function `return`s `transcribeQueue.run(...)` (so callers still get the result promise).
- Nothing else in the file sends a `transcribe` message outside this path.

- [ ] **Step 6: Commit**

```bash
git add src/main/whisper-host.ts
git commit -m "fix(worker): serialize transcribes via SerialQueue (M1 — no concurrent transcribeData)"
```

---

## Task 4: Correct the stale "cumulative" worker comment (comment-only)

**Files:**
- Modify: `src/main/whisper-worker.ts`

The header comment claims each `partial` "carries the cumulative transcript so far," but fugood's `onNewSegments` delivers only the **newly completed** segments, not the running total. The renderer-facing partial path is being deleted in a later 0b task; until then, fix the misleading comment so no one builds on the wrong assumption. No behavior change.

- [ ] **Step 1: Replace the stale comment**

In `src/main/whisper-worker.ts`, find the comment block (around the wire-protocol header):
```ts
// The 'partial' messages stream during transcription via fugood's
// onNewSegments callback. Each one carries the cumulative transcript
// so far. Hosts that don't want streaming just ignore them. This
```
Replace those three lines with:
```ts
// The 'partial' messages stream during transcription via fugood's
// onNewSegments callback. Each one carries only the NEWLY completed
// segment(s), NOT the cumulative transcript — a host that wants a
// running total must accumulate them itself. Hosts that don't want
// streaming just ignore them. This
```

- [ ] **Step 2: Typecheck (comment-only, should be a no-op)**

Run:
```bash
npm run typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/main/whisper-worker.ts
git commit -m "docs(worker): fix stale 'cumulative' partial-transcript comment"
```

---

## Self-Review

**1. Spec coverage.** This plan implements the 0c [HIGH] item "Host-side single-worker FIFO queue enforcing the rule-4 invariant" and must-fix **M1** ("at most one `transcribeData` in flight per context"). Spec items intentionally **out of scope** and deferred (with reasons) are listed under "Scope" above: 2-context cache, the [MED] protocol additions (language echo / forced language / cancel / model identity), and routing `workerFree` through the queue. No M1-related requirement is left unimplemented.

**2. Placeholder scan.** No `TBD` / `TODO` / "handle edge cases" / "similar to" — every code step contains complete code; every run step has an exact command + expected result.

**3. Type consistency.** `SerialQueue.run<T>(task: () => Promise<T>): Promise<T>` is used identically in `workerTranscribe` (`transcribeQueue.run(async () => { ...; return result })` where `result: Promise<{text, segments, ms}>`, so `T = {text, segments, ms}` and the function's return type is unchanged). The `pending` map, `nextRequestId`, `loadModel`, and `proc` references inside the wrapped body match their existing declarations.

**Follow-up hardening (note for later plans, not this one):**
- Route `workerFree` through `transcribeQueue` too, so a `free` can't land mid-transcribe.
- Optional belt-and-suspenders: a worker-side guard that refuses a second `transcribe` while one is running (defense in depth even though the host now serializes).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-02-streaming-phase0-worker-serialization.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
