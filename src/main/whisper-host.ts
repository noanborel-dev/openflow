import { app, utilityProcess, type UtilityProcess } from 'electron'
import path from 'node:path'
import { logInfo, logError } from './log'
import type { TranscribeOptions } from '@fugood/whisper.node'

// Host-side wrapper around the whisper utility process. Spawns the
// worker lazily on first transcribe, holds the singleton, dispatches
// transcribe requests via message-id correlation. The worker handles
// all NAPI interaction with @fugood/whisper.node so the main process
// stays free of GPU work (and the Chromium QoS downgrade that comes
// with it — see whisper-worker.ts).

interface PendingRequest {
  resolve: (result: { text: string; segments: Array<{ text: string; t0: number; t1: number }>; ms: number }) => void
  reject: (err: Error) => void
}

let proc: UtilityProcess | null = null
let readyPromise: Promise<void> | null = null
let loadedModelPath: string | null = null
let loadingModelPath: string | null = null
let loadResolve: (() => void) | null = null
let loadReject: ((err: Error) => void) | null = null
const pending = new Map<number, PendingRequest>()
let nextRequestId = 1

function workerScriptPath(): string {
  // After electron-vite build, main is emitted to out/main/index.js
  // and the worker module is emitted alongside it. Resolve relative
  // to the running entry so packaged builds and `npm run dev` both
  // work without a special-case path.
  return path.join(__dirname, 'whisper-worker.js')
}

function ensureProc(): Promise<void> {
  if (readyPromise) return readyPromise
  readyPromise = new Promise<void>((resolve, reject) => {
    const child = utilityProcess.fork(workerScriptPath(), [], {
      serviceName: 'OpenFlow Whisper Worker',
      // We deliberately do NOT inherit Chromium QoS — that's the
      // whole point. utilityProcess runs at default user QoS unless
      // we explicitly downgrade it.
      stdio: 'inherit',
    })
    proc = child

    child.on('spawn', () => {
      // We get a 'ready' message after the worker module finishes
      // its synchronous setup; that's what we actually await. spawn
      // alone isn't enough — the NAPI module needs a tick to load.
    })

    child.on('message', (msg: unknown) => {
      handleWorkerMessage(msg as Record<string, unknown>, resolve, reject)
    })

    child.on('exit', (code) => {
      logError('Whisper worker exited', { code })
      // Drop all pending requests and reset state — next call
      // re-spawns. We don't reject the readyPromise if it already
      // resolved; otherwise the caller of ensureProc() would never
      // see the error.
      for (const [, req] of pending) {
        req.reject(new Error(`Whisper worker exited (code ${code})`))
      }
      pending.clear()
      proc = null
      readyPromise = null
      loadedModelPath = null
      loadingModelPath = null
      if (loadReject) {
        loadReject(new Error(`Whisper worker exited during load (code ${code})`))
        loadReject = null
        loadResolve = null
      }
    })
  })
  return readyPromise
}

function handleWorkerMessage(
  msg: Record<string, unknown>,
  spawnResolve: () => void,
  _spawnReject: (err: Error) => void,
): void {
  const type = msg.type
  if (type === 'ready') {
    spawnResolve()
    return
  }
  if (type === 'loaded') {
    logInfo('Whisper worker loaded model', { ms: msg.ms, path: loadingModelPath })
    loadedModelPath = loadingModelPath
    loadingModelPath = null
    if (loadResolve) {
      loadResolve()
      loadResolve = null
      loadReject = null
    }
    return
  }
  if (type === 'result') {
    const id = msg.id as number
    const req = pending.get(id)
    if (!req) return
    pending.delete(id)
    req.resolve({
      text: msg.text as string,
      segments: (msg.segments as Array<{ text: string; t0: number; t1: number }>),
      ms: msg.ms as number,
    })
    return
  }
  if (type === 'error') {
    const id = msg.id as number | null
    const message = msg.message as string
    if (id != null) {
      const req = pending.get(id)
      if (req) {
        pending.delete(id)
        req.reject(new Error(message))
      }
      return
    }
    // Load-time or worker-global error — surface to the load promise
    // if one is in flight.
    if (loadReject) {
      loadReject(new Error(message))
      loadReject = null
      loadResolve = null
      loadingModelPath = null
    } else {
      logError('Whisper worker error (no caller)', { message })
    }
  }
}

async function loadModel(modelPath: string): Promise<void> {
  await ensureProc()
  if (loadedModelPath === modelPath) return
  if (loadingModelPath === modelPath && loadResolve) {
    // Another concurrent loadModel call is already in flight for the
    // same path — wait on its promise.
    return new Promise<void>((resolve, reject) => {
      const priorResolve = loadResolve!
      const priorReject = loadReject!
      loadResolve = () => { priorResolve(); resolve() }
      loadReject = (err: Error) => { priorReject(err); reject(err) }
    })
  }
  // A different model is loaded (or loading) — issue a new load. The
  // worker handles swap by releasing the prior context first.
  loadingModelPath = modelPath
  const loadPromise = new Promise<void>((resolve, reject) => {
    loadResolve = resolve
    loadReject = reject
  })
  proc!.postMessage({ type: 'load', modelPath })
  await loadPromise
}

export async function workerTranscribe(
  modelPath: string,
  pcm: ArrayBuffer,
  options: TranscribeOptions,
): Promise<{ text: string; segments: Array<{ text: string; t0: number; t1: number }>; ms: number }> {
  await loadModel(modelPath)
  const id = nextRequestId++
  const result = new Promise<{ text: string; segments: Array<{ text: string; t0: number; t1: number }>; ms: number }>((resolve, reject) => {
    pending.set(id, { resolve, reject })
  })
  // Transfer the ArrayBuffer to the worker so we avoid the implicit
  // structured-clone copy of audio data. Without transfer, sending a
  // few hundred KB of PCM per dictation would add 5-10ms of copy
  // overhead that's pure waste.
  proc!.postMessage({ type: 'transcribe', id, pcm, options }, [pcm])
  return result
}

export async function workerFree(): Promise<void> {
  if (!proc) return
  proc.postMessage({ type: 'free' })
  loadedModelPath = null
}

// Best-effort shutdown on app quit so we don't leave the helper
// process running. The exit handler in ensureProc takes care of
// cleanup if the worker dies on its own.
app.on('will-quit', () => {
  if (proc) {
    try { proc.kill() } catch { /* ignore */ }
    proc = null
  }
})
