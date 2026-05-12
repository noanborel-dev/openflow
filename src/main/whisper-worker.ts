// Whisper transcription utility process.
//
// Why this exists: when whisper.cpp runs in Electron's main process,
// it inherits Chromium's macOS QoS class downgrade (especially under
// LSUIElement-tagged apps launched from a terminal). Metal command-
// buffer scheduling defers GPU work submitted from background-QoS
// threads behind foreground apps' work — deterministically ~2x
// slower. We confirmed this matches the observed gap (470ms
// standalone Node vs 970ms Electron main).
//
// utilityProcess is a fresh `node` fork that does NOT inherit
// Chromium's QoS shaping. Running whisper here gets us back to the
// standalone-Node speed envelope.
//
// Wire protocol over parentPort:
//
//   main → worker:
//     { type: 'load', modelPath: string }
//     { type: 'transcribe', id: number, pcm: ArrayBuffer, options: {...} }
//     { type: 'free' }
//
//   worker → main:
//     { type: 'ready' }
//     { type: 'loaded', ms: number }
//     { type: 'result', id: number, text: string, segments: [...], ms: number }
//     { type: 'error', id: number | null, message: string }
//
// We use numeric request ids so the host can multiplex multiple
// in-flight transcribes against a single response stream. Today the
// host only fires one transcribe at a time, but command-mode +
// dictation could overlap in the future.

import { initWhisper, toggleNativeLog } from '@fugood/whisper.node'
import type { WhisperContext, TranscribeOptions } from '@fugood/whisper.node'

interface LoadMsg {
  type: 'load'
  modelPath: string
}
interface TranscribeMsg {
  type: 'transcribe'
  id: number
  pcm: ArrayBuffer
  options: TranscribeOptions
}
interface FreeMsg {
  type: 'free'
}
type IncomingMsg = LoadMsg | TranscribeMsg | FreeMsg

interface OutgoingResult {
  type: 'result'
  id: number
  text: string
  segments: Array<{ text: string; t0: number; t1: number }>
  ms: number
}

let ctx: WhisperContext | null = null
let loadingPromise: Promise<WhisperContext> | null = null
let currentModelPath: string | null = null

void toggleNativeLog(false).catch(() => { /* ignore */ })

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
    process.parentPort.postMessage({ type: 'loaded', ms: Date.now() - start })
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
      process.parentPort.postMessage({ type: 'error', id: null, message })
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
    const { id, pcm, options } = msg
    try {
      if (!ctx || !currentModelPath) {
        throw new Error('Worker received transcribe before load')
      }
      const start = Date.now()
      // PCM arrives structured-cloned from main (utilityProcess's
      // postMessage doesn't support ArrayBuffer transfer — see
      // whisper-host.ts). Sub-ms copy cost for typical clips.
      const result = await ctx.transcribeData(pcm, options).promise
      const out: OutgoingResult = {
        type: 'result',
        id,
        text: result.result,
        segments: result.segments,
        ms: Date.now() - start,
      }
      process.parentPort.postMessage(out)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      process.parentPort.postMessage({ type: 'error', id, message })
    }
  }
}

process.parentPort.on('message', (event) => {
  // utilityProcess's parentPort wraps the payload in { data }.
  void handle(event.data as IncomingMsg)
})

process.parentPort.postMessage({ type: 'ready' })
