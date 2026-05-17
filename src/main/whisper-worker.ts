// Whisper transcription worker process.
//
// Why this exists: when whisper.cpp runs in Electron's main process
// OR utility process, it inherits Chromium's macOS QoS class downgrade
// (especially under LSUIElement). Metal command-buffer scheduling
// defers GPU work submitted from background-QoS threads — ~2x slower.
//
// child_process.fork() with ELECTRON_RUN_AS_NODE=1 starts the Electron
// binary as plain Node (no Chromium init, no QoS shaping, no sandbox).
// The forked process runs at default user QoS like any other Node
// process, which is the only environment where we hit the standalone-
// Node speed envelope (~470ms warm for large-v3-turbo on M5 Pro).
//
// Wire protocol over Node IPC (child_process.send / process.send):
//
//   main → worker:
//     { type: 'load', modelPath: string }
//     { type: 'transcribe', id: number, pcmBase64: string, options: {...} }
//     { type: 'free' }
//
//   worker → main:
//     { type: 'ready' }
//     { type: 'loaded', ms: number }
//     { type: 'partial', id: number, text: string }    ← streaming
//     { type: 'result', id: number, text: string, segments: [...], ms: number }
//     { type: 'error', id: number | null, message: string }
//
// The 'partial' messages stream during transcription via fugood's
// onNewSegments callback. Each one carries the cumulative transcript
// so far. Hosts that don't want streaming just ignore them. This
// doesn't change total inference time — it just lets the indicator
// show words as they're transcribed instead of waiting for the
// complete result. Perceived latency drops dramatically on long
// clips: a 35s dictation that takes 1400ms total now shows the
// first words at ~200ms.
//
// Node IPC serializes payloads as JSON, so PCM travels as base64.
// Worker decodes back to Buffer → ArrayBuffer before calling fugood.

import { initWhisper, toggleNativeLog } from '@fugood/whisper.node'
import type { WhisperContext, TranscribeOptions } from '@fugood/whisper.node'

interface LoadMsg {
  type: 'load'
  modelPath: string
}
interface TranscribeMsg {
  type: 'transcribe'
  id: number
  pcmBase64: string
  options: TranscribeOptions
}
interface FreeMsg {
  type: 'free'
}
type IncomingMsg = LoadMsg | TranscribeMsg | FreeMsg

let ctx: WhisperContext | null = null
let loadingPromise: Promise<WhisperContext> | null = null
let currentModelPath: string | null = null

void toggleNativeLog(false).catch(() => { /* ignore */ })

function send(msg: Record<string, unknown>): void {
  if (process.send) {
    process.send(msg)
  }
}

async function load(modelPath: string): Promise<WhisperContext> {
  if (ctx && currentModelPath === modelPath) return ctx
  if (loadingPromise && currentModelPath === modelPath) return loadingPromise
  if (ctx) {
    try { await ctx.release() } catch { /* best-effort */ }
    ctx = null
  }
  currentModelPath = modelPath
  const start = Date.now()
  loadingPromise = initWhisper({
    filePath: modelPath,
    useGpu: true,
    useFlashAttn: true,
  }).then((c) => {
    ctx = c
    loadingPromise = null
    send({ type: 'loaded', ms: Date.now() - start })
    return c
  }).catch((err: unknown) => {
    loadingPromise = null
    currentModelPath = null
    throw err
  })
  return loadingPromise
}

async function handle(msg: IncomingMsg): Promise<void> {
  if (msg.type === 'load') {
    try {
      await load(msg.modelPath)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      send({ type: 'error', id: null, message })
    }
    return
  }
  if (msg.type === 'free') {
    if (ctx) {
      try { await ctx.release() } catch { /* ignore */ }
      ctx = null
      currentModelPath = null
    }
    return
  }
  if (msg.type === 'transcribe') {
    const { id, pcmBase64, options } = msg
    try {
      if (!ctx || !currentModelPath) {
        throw new Error('Worker received transcribe before load')
      }
      // Decode base64 → Buffer → ArrayBuffer slice. The slice() is
      // important because Node's Buffer wraps a shared pool — passing
      // buf.buffer directly would hand fugood a reference to MUCH
      // more memory than we intend.
      const buf = Buffer.from(pcmBase64, 'base64')
      const pcm = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
      const start = Date.now()
      // onNewSegments fires every time whisper completes a segment.
      // We forward each as a 'partial' so the host can drive the
      // indicator UI with the running transcript. The final result
      // still comes through `result` so callers can rely on a single
      // canonical "done" signal.
      const result = await ctx.transcribeData(pcm, {
        ...options,
        onNewSegments: (r) => {
          send({ type: 'partial', id, text: r.result })
        },
      }).promise
      send({
        type: 'result',
        id,
        text: result.result,
        segments: result.segments,
        ms: Date.now() - start,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      send({ type: 'error', id, message })
    }
  }
}

process.on('message', (msg: IncomingMsg) => {
  void handle(msg)
})

send({ type: 'ready' })
