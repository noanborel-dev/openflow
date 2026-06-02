import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import {
  LOCAL_MODELS,
  modelsDir,
  localModelPath,
} from './local-models'
import type { LocalModelId } from '../shared/types'
import { logInfo, logError } from './log'

// Per-model progress payload broadcast over LOCAL_MODEL_PROGRESS. The
// `modelId` lets the Settings UI map a progress event back to the
// specific card that issued the download — necessary now that users
// can download multiple model tiers and even queue them.
export interface ModelDownloadProgress {
  modelId: LocalModelId
  status: 'starting' | 'downloading' | 'done' | 'error' | 'idle'
  receivedBytes: number
  totalBytes: number
  error?: string
}

let currentDownload: { abort: AbortController; modelId: LocalModelId } | null = null
// Last-known progress per model — so the renderer can fetch the
// initial state of all three cards on mount without waiting for the
// next stream event.
const lastProgress: Map<LocalModelId, ModelDownloadProgress> = new Map()

export function getLocalModelProgress(modelId?: LocalModelId): ModelDownloadProgress | ModelDownloadProgress[] {
  if (modelId) {
    return lastProgress.get(modelId) ?? {
      modelId,
      status: 'idle',
      receivedBytes: 0,
      totalBytes: LOCAL_MODELS[modelId].bytes,
    }
  }
  // Return all known states; callers that just want one model pass
  // a modelId, callers that render multiple cards pass nothing.
  return Array.from(lastProgress.values())
}

function broadcast(progress: ModelDownloadProgress): void {
  lastProgress.set(progress.modelId, progress)
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('local-model:progress', progress)
    }
  }
}

// Download a specific whisper model from HuggingFace to a `.partial`
// file, then atomically rename when complete. Concurrent calls are
// rejected — the AbortController lock prevents two downloads from
// trampling each other's progress reporting.
//
// Progress is broadcast over IPC every ~250ms (throttled inside the
// write loop) so the renderer's progress bar updates smoothly without
// firing thousands of IPC messages on a fast connection.
export async function downloadWhisperModel(modelId: LocalModelId): Promise<void> {
  if (currentDownload) {
    throw new Error('A model download is already in progress.')
  }

  const info = LOCAL_MODELS[modelId]
  const abort = new AbortController()
  currentDownload = { abort, modelId }

  const dir = modelsDir()
  await fs.promises.mkdir(dir, { recursive: true })
  const finalPath = localModelPath(modelId)
  const partialPath = `${finalPath}.partial`

  // Resume: if there's a .partial from a prior aborted run, pick up
  // where we left off using a Range request. HuggingFace honors
  // Range; if it doesn't we just restart at 0.
  let resumeFrom = 0
  try {
    const stat = fs.statSync(partialPath)
    resumeFrom = stat.size
  } catch {
    // no partial — fresh start
  }

  broadcast({
    modelId,
    status: 'starting',
    receivedBytes: resumeFrom,
    totalBytes: info.bytes,
  })

  logInfo('Local model download starting', {
    modelId,
    url: info.url,
    target: finalPath,
    resumeFrom,
  })

  try {
    const headers: Record<string, string> = {
      'user-agent': `Yappr/${app.getVersion()}`,
    }
    if (resumeFrom > 0) headers.range = `bytes=${resumeFrom}-`

    const res = await fetch(info.url, {
      headers,
      signal: abort.signal,
    })
    if (!res.ok && res.status !== 206) {
      throw new Error(`HuggingFace returned ${res.status} ${res.statusText}`)
    }
    if (!res.body) {
      throw new Error('Empty response body')
    }

    // Resolve expected total from Content-Length on a fresh download
    // or Content-Range on a resumed one. Fall back to the hardcoded
    // estimate if neither is present (HF usually sets both).
    const contentRange = res.headers.get('content-range')
    let totalBytes = info.bytes
    if (contentRange) {
      const m = /\/(\d+)$/.exec(contentRange)
      if (m) totalBytes = Number(m[1])
    } else {
      const len = res.headers.get('content-length')
      if (len && resumeFrom === 0) totalBytes = Number(len)
    }

    const sink = fs.createWriteStream(partialPath, {
      flags: resumeFrom > 0 ? 'a' : 'w',
    })

    let received = resumeFrom
    let lastBroadcast = 0
    const readable = Readable.fromWeb(res.body as never)
    readable.on('data', (chunk: Buffer) => {
      received += chunk.length
      const now = Date.now()
      if (now - lastBroadcast > 250) {
        lastBroadcast = now
        broadcast({
          modelId,
          status: 'downloading',
          receivedBytes: received,
          totalBytes,
        })
      }
    })
    await pipeline(readable, sink)

    // Sanity check before rename — reject anything below 80% of the
    // expected size as a truncated download.
    const finalSize = fs.statSync(partialPath).size
    if (finalSize < info.bytes * 0.8) {
      throw new Error(`Downloaded file too small (${finalSize} bytes) — likely truncated`)
    }

    await fs.promises.rename(partialPath, finalPath)
    broadcast({
      modelId,
      status: 'done',
      receivedBytes: finalSize,
      totalBytes: finalSize,
    })
    logInfo('Local model download complete', {
      modelId,
      bytes: finalSize,
      path: finalPath,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logError('Local model download failed', { modelId, error: message })
    const prior = lastProgress.get(modelId)
    broadcast({
      modelId,
      status: 'error',
      receivedBytes: prior?.receivedBytes ?? 0,
      totalBytes: prior?.totalBytes ?? info.bytes,
      error: message,
    })
    throw err
  } finally {
    currentDownload = null
  }
}

export function cancelDownload(): void {
  if (currentDownload) {
    const { abort, modelId } = currentDownload
    abort.abort()
    currentDownload = null
    broadcast({
      modelId,
      status: 'idle',
      receivedBytes: 0,
      totalBytes: LOCAL_MODELS[modelId].bytes,
    })
  }
}

// Delete a specific model file and (best-effort) its .partial. Other
// downloaded tiers are left alone — users may keep e.g. small.en AND
// large-v3-turbo around to switch between them.
export async function uninstallWhisperModel(modelId: LocalModelId): Promise<void> {
  const target = localModelPath(modelId)
  try {
    await fs.promises.unlink(target)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
  try {
    await fs.promises.unlink(`${target}.partial`)
  } catch {
    // ignore — .partial may not exist
  }
  logInfo('Local model uninstalled', { modelId, path: target })
  broadcast({
    modelId,
    status: 'idle',
    receivedBytes: 0,
    totalBytes: LOCAL_MODELS[modelId].bytes,
  })
}
