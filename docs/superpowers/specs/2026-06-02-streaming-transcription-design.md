# Streaming Transcription — Design Spec

**Date:** 2026-06-02
**Status:** Draft for review
**Product:** Yappr (folder: OpenFlow)

---

## 1. Goal

Reduce the **perceived** latency of a dictation by transcribing audio in **chunks
during the hold**, so that when the user releases the hotkey, nearly all the audio
is already transcribed and only a short final chunk plus the existing cleanup pass
remain. The user feels the result appear almost immediately after they stop talking.

This must work for **both** transcription backends:

- **Cloud Groq Whisper** — the default/managed path (`provider: 'groq'`, the path
  most users pay for).
- **Local whisper.cpp** — the opt-in privacy/BYOK path (`provider: 'local'`).

### Non-goals

- **Changing anything downstream of the assembled transcript.** The cleanup LLM
  call, the deterministic regex passes, emoji, paste, and history all stay exactly
  as they are. Cleanup runs **once**, on the **full assembled transcript**, at
  release — never per chunk.
- **A real-time streaming ASR session to Groq.** Groq's Whisper endpoint is strict
  request/response (verified: no streaming/partial API). We chunk client-side and
  fire one fast request per chunk; we do not hold a streaming socket.
- **No live transcript in the pill.** Decided: the pill shows `listening` during the
  hold, `polishing` on release (when the assembled transcript is sent to the cleanup
  LLM), then `pasted` — never streamed words. The win is latency, not visible text.
  This means the renderer-facing partial-transcript path is **removed**, not
  repurposed; the orchestrator assembles chunk results internally in the main process.

### Hard requirement

- **Multilingual code-switching must keep working.** A user who says an English
  sentence with a French phrase mid-way (`"... j'aime bien travailler sur mon
  ordinateur ..."`) must still get the foreign span transcribed in its own
  language. Chunking must not break this.

---

## 2. Why this is worth doing (the latency case, from real data)

Measured on the user's machine (M5 Pro, local `large-v3-turbo`):

| Dictation | Audio length | Transcribe | Cleanup | Post-release wait |
|---|---|---|---|---|
| "Okay so ideally…" | 90.4s | 2615ms | 819ms | **3436ms** |
| "Really the way…" | 63.1s | 2043ms | *skipped* | **2044ms** |
| "I'm writing an email…" | 36.1s | 1470ms | 837ms | **2319ms** |
| "Can you figure out…" | 21.0s | 972ms | *skipped* | **973ms** |

Two facts drive the design:

1. **Whisper turbo runs ~25–35× real-time** here. A 10s chunk transcribes in ~350ms,
   far faster than it takes to speak the next chunk. So transcribing chunks *during*
   the hold is effectively free — the worker idles between chunks.
2. **Transcription is 76–100% of the post-release wait.** Moving it onto the hold
   collapses the wait to "final short chunk + cleanup + paste."

Projected post-release wait with streaming:

| Dictation | Now | Streamed (est.) | Saved |
|---|---|---|---|
| 90.4s | 3.4s | ~1.0s | ~70% |
| 63.1s | 2.0s | ~0.3s | ~85% |
| 36.1s | 2.3s | ~1.0s | ~57% |

The win scales with dictation length — biggest exactly where the current wait
annoys people.

---

## 3. Current architecture (and the one seam we touch)

Today, on hotkey release, the renderer sends one WebM blob to the main process,
which runs `runDictationPipeline` (`src/main/pipeline.ts:786`):

| # | Step | Code |
|---|---|---|
| 1 | `onState('processing')` | `:798` |
| 2 | Pick providers (local vs groq) + build Whisper bias dictionary | `:800–801` |
| 3 | Refresh focused app **concurrently** (overlaps transcription) | `:810` |
| 4 | **🎯 Transcribe** `transcription.transcribe(audioBuffer, {dictionary, onPartial})` | `:813` |
| 5 | Silence/hallucination bail (`isLikelySilence`) | `:827` |
| 6 | Resolve category + AI-chat-surface detection (AX role) | `:832–866` |
| 7 | Kick off emoji judge in parallel (separate Groq call on raw transcript) | `:897` |
| 8 | Cleanup decision: paused / fast-path skip / **LLM** + length-guard | `:910–980` |
| 9 | Post-LLM regex passes (always): quickFixes → dictionary → self-correct → spelled-name → question-marks | `:985–1018` |
| 10 | Append emoji | `:1024` |
| 11 | `pasteText` (paste or clipboard fallback) | `:1031` |
| 12 | `onState('done')`, return `{transcript, cleaned, …}` | `:1038` |

**The seam is line `:813`.** Steps 5–12 operate on the assembled `transcript` and
stay byte-for-byte unchanged. Streaming swaps *how step 4 produces the transcript*;
nothing else moves. This isolation is what makes the change safe — and it is a
load-bearing invariant of this spec.

---

## 4. The streaming design

### 4.1 Mechanism — chunk at silence, cap at ~8s (Approach A)

An **orchestrator** in the main process receives audio chunks during the hold,
transcribes each via the active provider, reassembles them in order, and on release
produces the full transcript that feeds step 4's seam.

Chunk boundaries are chosen by **voice-activity / energy**, not a fixed clock:

- Cut at a **natural pause** (silence) → never split a word.
- If the user speaks continuously, force a cut at a **~8s cap** so streaming keeps up.
- Each chunk is a self-contained phrase → near-one-shot accuracy; the **existing
  final cleanup pass** smooths any residual boundary roughness.

We considered and rejected (documented for posterity):

- **B: overlapping windows + timestamp dedup** — highest accuracy but ~1.5–2× cloud
  cost on the overlap and notably more reconciliation logic. Kept as a fallback if
  the eval (§8) shows Approach A's boundaries hurt quality.
- **C: native per-backend streaming** — best per backend, but two code paths and it
  breaks the "one mechanism for everybody" goal.

### 4.2 The five rules

1. **Silence-cut + 8s cap.** Boundaries at pauses (from the energy signal the
   capture graph already computes), hard cap to bound the final-chunk size.
2. **Code-switching preserved.** Detect language **per chunk** (each silence-delimited
   phrase is long enough to detect reliably). For **sub-~1.5s fragments**, *inherit*
   the neighboring chunk's language instead of detecting from noise. This keeps the
   French-phrase-in-English case working while killing the short-fragment misfires
   seen in the logs (`"clean."`→fr, `"Gracias…"`→es).
3. **Short final-chunk handling.** If the release leaves a near-empty final chunk,
   pad or merge it with the previous chunk rather than transcribing ~50ms of audio
   (kills the `input too short — 50ms` hallucination).
4. **Single-worker queue (local).** The whisper worker processes one chunk at a
   time; with 25–35× real-time headroom, chunks finish long before the next arrives.
   (Requires the 2-context cache from Phase 0 so tier switches don't reload mid-stream.)
5. **Session guard.** A per-recording session id is stamped on every chunk and
   checked at assembly, so a stale chunk from a superseded dictation can't bleed in.

### 4.3 Backend differences

- **Cloud Groq:** each chunk is an independent `audio/transcriptions` request
  (~20ms compute at 216× real-time + network RTT). No streaming socket; the
  orchestrator fires per-chunk requests and assembles results by sequence index.
- **Local whisper.cpp:** chunks are queued to the in-process worker. (Native
  sliding-window streaming exists but is deferred; chunk-and-transcribe unifies both
  backends.)

**Key decision: chunk orchestration lives in the pipeline/session layer, not inside
the providers.** `transcribe()` stays a single-buffer call for both providers; the
orchestrator owns chunking, ordering, language-inheritance, and assembly. This
avoids forcing a streaming contract onto the cloud provider that it can't honor.

### 4.4 New interfaces (the architectural backbone)

These are the clean seams that make streaming sound *and* make future work easier.
They replace today's god-file + stringly-typed surfaces (see Phase 0):

- **`RecordingSession` controller (main).** Owns `sessionId`, chunk assembly, the
  transcription-session lifecycle, and the dictation state machine — extracted out
  of `index.ts`. Created at hotkey press, fed chunks during the hold, finalized at
  release.
- **`StreamingTranscriptionSession` abstraction.** `pushChunk({seq, pcm, isFinal})`,
  `finalize(): Promise<string>` (transcribes the final chunk and returns the ordered
  assembled transcript), `onPartial(text)`. Cloud impl = per-chunk requests; local
  impl = queued worker calls.
- **Structured indicator events.** Replace the prefix-string `broadcastState`
  (`'partial:'` / `'error:'` / state) with a discriminated union defined once in
  `shared/types` (`{kind:'state'|'partial'|'error', …}`) or separate IPC channels.
- **Chunk IPC contract.** `{sessionId, seq, pcm, isFinal}` — replaces the
  identity-less `sendAudioChunk(ArrayBuffer)` that today treats chunks as fragments
  of one WebM file.
- **Worker protocol.** Add a session/request id, echo model identity in `loaded`
  replies, support `cancel`, and cache up to 2 contexts (small + large) to end the
  reload thrash.
- **`createCaptureGraph(deviceId)` (renderer).** One shared AudioWorklet-based
  capture helper (PCM out + RMS/energy for silence detection + waveform), replacing
  the MediaRecorder-WebM approach and the 3–4 duplicated mic-setup blocks.

---

## 5. Phase 0 — Foundation (from the architecture audit)

A multi-agent audit (8 subsystem auditors + adversarial verification, 60/64 findings
confirmed) surfaced issues that we fix **before** building chunking. Most are
prerequisites for streaming; the rest are shipping bugs we want gone regardless.
Rationale: a latency feature must not be built on god files, stringly-typed
protocols, and a transcription layer that corrupts output.

### 0a. Ship-now correctness bugs (run on every dictation, incl. local/no-LLM + code)

- **`applyQuestionMarks` splits on ANY period** (`pipeline.ts:539`) →
  `"open app.tsx"`→`"open app?tsx"`, `"version 3.2"`→`"version 3?2"`. Guard against
  intra-token periods; scope to no-LLM/code-safe paths. **[HIGH]**
- **`applySelfCorrection` deletes real clauses** (`pipeline.ts:420`) →
  `"I love Paris, actually Rome is better"`→`"I love Rome is better"`. Tighten the
  NAME-vs-NAME rewrite. **[HIGH]**
- **`"GPT for"`→`"GPT-4"`** (`pipeline.ts:273`) eats the preposition. Drop the rule. **[MED]**
- **Discord bundle ID wrong** — `com.discord` vs real `com.hnc.Discord`
  (`constants.ts:31`, `pipeline.ts:309`). **[MED]**
- **Code-switching has zero prompt-level protection** (`prompts.ts`) — add an explicit
  "preserve the user's language, including mid-sentence switches" instruction. The
  artifact-stripping/loopback regexes are English-only and could leak foreign meta-text. **[MED]**

### 0b. Dead-weight removal (shrink the surface streaming touches)

- **Partial-transcript path (renderer-facing)** — fully plumbed worker→host→provider→
  pipeline→main→preload→renderer but never rendered. Since we've decided **not** to
  surface live text (§1), **delete** the renderer-facing partial path (the
  `partial:` broadcast, `setPartial`, and the dead pill branch). The orchestrator
  still consumes per-chunk results *internally in main* to assemble the transcript —
  that stays — but nothing is sent to the renderer for display. Also fix the wrong
  "cumulative" comments on the internal segment callback (fugood emits only new
  segments, not the running transcript).
- **`looksEnumerated` + 3 regexes** (`pipeline.ts:207`) — zero call sites. Delete.
- **`perAppRules` / `customPrompt`** (`types.ts:45`) — plumbed end-to-end, no UI to
  populate it. Delete or ship the UI (out of scope here → delete).
- **`audioCues` toggle** — shown in Settings, plays no sound. Implement or remove.
- **`EMOJI_BLOCK`** + dead `emojiInMessages` prompt branch; `canSkipCleanup` unused
  `_strictness` (computed twice); dead model-helper exports; `whisperCli` always-true
  stub; `LocalBinaryMissingError` dead `which` param.

### 0c. Streaming-prep refactors (these ARE phase one of the feature)

- **2-context model cache in the worker** (`whisper-worker.ts:58`) — end the
  `large→small→large` GPU release + Metal recompile thrash (~150ms + ~500ms per
  switch). Prerequisite: can't reload a 573MB model mid-stream. **[HIGH]**
- **Extract `runDictationPipeline`** (`pipeline.ts:786`, 260-line god fn) into
  routing / post-processing / paste units so the `:813` seam is clean. **[HIGH]**
- **Extract a session controller from `index.ts`** (716-line god file). **[MED]**
- **Replace the stringly `broadcastState` protocol** with structured events. **[HIGH]**
- **Structured chunk IPC** with session id + seq + isFinal. **[HIGH]**
- **Worker protocol:** request id, model identity in `loaded`, `cancel` support. **[MED]**
- **De-duplicate** the triplicated hallucination/silence string set into one module. **[MED]**
- **`createCaptureGraph` helper** + AudioWorklet PCM capture. **[HIGH]**

---

## 6. Phases 1–N — The streaming feature

1. **Capture** — AudioWorklet PCM + energy-based silence detection + chunk emission
   over the structured IPC contract (`createCaptureGraph`).
2. **Orchestrator** — `StreamingTranscriptionSession`: queue, order, language-inherit,
   short-chunk merge, `finalize()`, `onPartial`.
3. **Provider adaptation** — per-chunk WAV/PCM for cloud Groq and local; tier locked
   at hold-start for local (full duration is unknowable mid-stream).
4. **Wire the seam** — `pipeline.ts:813` calls `session.finalize()` instead of
   `transcribe(fullBlob)`. Steps 5–12 unchanged; assert `transcript` is the full
   assembled text.
5. **Pill UX** — `listening` (hold) → `polishing` (release / cleanup) → `pasted`. No
   live transcript text (decided §1).
6. **Eval gate** — see §8.

---

## 7. Execution — the agent team

A communicating team, coordinated through brainstorming → writing-plans → execution.

- **👤 Integration Lead** — owns the `:813` seam + the shared contracts (chunk IPC,
  session lifecycle, structured events); sequences merges; the only integrator.
- **🎙️ Capture Agent** — `createCaptureGraph`, AudioWorklet PCM, silence cuts, chunk
  emission. ⇄ Orchestrator on the IPC contract.
- **⚙️ Orchestrator Agent** — `StreamingTranscriptionSession`, ordering, assembly,
  language inheritance, `finalize()`. ⇄ Capture, ⇄ Provider.
- **🧠 Provider/ASR Agent** — per-chunk transcription for cloud + local, tier lock,
  short-chunk merge, per-chunk hallucination reject. → Eval.
- **📊 Eval/Quality Agent** — the WER + latency + code-switch harness; the merge gate.
- **🔪 Adversarial Reviewer** — races: out-of-order chunks, release mid-flight, stale
  session, mid-stream chunk failure, the worker load-state race.

**Merge order:** Capture + Provider land first; Orchestrator integrates; Eval +
Reviewer gate before anything touches `pipeline.ts:813`. Phase 0 lands before all of
this (foundation), with 0a (bug fixes) shippable independently as quick wins.

---

## 8. Risks & the eval gate

- **Accuracy regression (headline risk).** Chunked independent transcription is
  inherently a bit worse than whole-clip Whisper. **Gate:** a WER eval harness on a
  sample corpus comparing one-shot vs streamed transcripts, plus a dedicated
  **code-switch test** (the French-phrase-in-English case) and a **latency delta**
  measurement. Streaming does not ship if WER regresses meaningfully. If Approach A's
  boundaries hurt, fall back to Approach B (overlapping windows).
- **Slow-machine headroom.** The 25–35× factor is an M5 Pro; on older Macs the
  headroom shrinks but turbo is still fast. The eval runs on a representative slower
  tier too.
- **Cloud cost per chunk** — *only relevant if transcription stays on cloud Groq.*
  Under **local** transcription (the intended model — see §9) there are **no
  per-chunk cloud calls at all**: the only cloud request is the single LLM cleanup,
  billed once, exactly as today — so this risk disappears. If cloud transcription is
  kept, N small requests replace 1; with no overlap (Approach A) total billed audio
  ≈ unchanged, per-request overhead is the only delta.
- **Tier selection under streaming (local).** Auto-elevation keys off full audio
  duration, unknowable mid-stream. Lock the tier at hold-start (focused-app +
  prewarm) and accept it for the whole utterance.

---

## 9. Decisions & open questions

**Resolved (2026-06-02 review):**

- **No live transcript in the pill.** `listening` → `polishing` → `pasted`.
- **Cleanup stays a single call** on the full assembled transcript after release —
  never per chunk. (Per-chunk LLM cleanup would lose cross-sentence context and
  defeat the "one fast call at the end" goal.)
- **Tier-lock at hold-start** for local (Accurate for code apps as today, the user's
  pick otherwise), since full duration is unknowable mid-stream.

**Open — the one consequential decision:**

- **Is transcription local or cloud?** Streaming-during-the-hold fits **local**
  whisper.cpp cleanly — on-device, zero per-chunk network cost, and it matches the
  intended model ("transcribe locally, cloud only for the LLM"). But the product's
  *current default* is **cloud Groq** transcription (`provider: 'groq'`,
  `store.ts:9`). Adopting the local model means **local transcription becomes the
  streaming path, and likely the default**, with the cloud reserved for the single
  LLM cleanup. To settle: does local transcription become the default for everybody,
  or does streaming apply **only** when the user is in local mode (cloud-transcription
  users keep today's one-shot path)? This choice reshapes §4.3 and the cost risk in §8.

---

## 10. Success criteria

- Post-release wait on long dictations (≥30s) drops by ≥50% on the reference machine.
- WER on the eval corpus is within a small, agreed threshold of one-shot.
- Code-switching test passes (foreign-language spans preserved).
- No regression in cleanup, regex passes, paste, or history (they run unchanged on
  the assembled transcript).
- Phase 0 bugs (0a) fixed and verified; dead weight (0b) removed.
