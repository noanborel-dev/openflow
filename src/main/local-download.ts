import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import {
  DEFAULT_WHISPER_MODEL,
  DEFAULT_WHISPER_MODEL_URL,
  DEFAULT_WHISPER_MODEL_BYTES,
  modelsDir,
  whisperModelPath,
} from './local-models'
import { logInfo, logError } from './log'

// Model download progress event payload broadcast to all renderer
// windows over the LOCAL_MODEL_PROGRESS channel.
export interface ModelDownloadProgress {
  status: 'starting' | 'downloading' | 'done' | 'error' | 'idle'
  receivedBytes: number
  totalBytes: number
  error?: string
}

let currentDownload: AbortController | null = null
let lastProgress: ModelDownloadProgress = {
  status: 'idle',
  receivedBytes: 0,
  totalBytes: DEFAULT_WHISPER_MODEL_BYTES,
}

export function getLocalModelProgress(): ModelDownloadProgress {
  return lastProgress
}

function broadcast(progress: ModelDownloadProgress): void {
  lastProgress = progress
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('local-model:progress', progress)
    }
  }
}

// Download the default Whisper model from HuggingFace to a `.partial`
// file, then atomically rename when complete. Concurrent calls are
// rejected — the AbortController in `currentDownload` is the lock.
//
// Progress is broadcast over IPC every ~250ms (throttled inside the
// write loop) so the renderer's progress bar can update without firing
// thousands of IPC messages on a fast connection.
export async function downloadWhisperModel(): Promise<void> {
  if (currentDownload) {
    throw new Error('A model download is already in progress.')
  }

  const abort = new AbortController()
  currentDownload = abort

  const dir = modelsDir()
  await fs.promises.mkdir(dir, { recursive: true })
  const finalPath = whisperModelPath()
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
    status: 'starting',
    receivedBytes: resumeFrom,
    totalBytes: DEFAULT_WHISPER_MODEL_BYTES,
  })

  logInfo('Local model download starting', {
    url: DEFAULT_WHISPER_MODEL_URL,
    target: finalPath,
    resumeFrom,
  })

  try {
    const headers: Record<string, string> = {
      'user-agent': `OpenFlow/${app.getVersion()}`,
    }
    if (resumeFrom > 0) headers.range = `bytes=${resumeFrom}-`

    const res = await fetch(DEFAULT_WHISPER_MODEL_URL, {
      headers,
      signal: abort.signal,
    })
    if (!res.ok && res.status !== 206) {
      throw new Error(`HuggingFace returned ${res.status} ${res.statusText}`)
    }
    if (!res.body) {
      throw new Error('Empty response body')
    }

    // Resolve the expected total from Content-Length on a fresh download
    // or Content-Range on a resumed one. Fall back to the hardcoded
    // estimate if neither is present (HF usually sets both).
    const contentRange = res.headers.get('content-range')
    let totalBytes = DEFAULT_WHISPER_MODEL_BYTES
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
          status: 'downloading',
          receivedBytes: received,
          totalBytes,
        })
      }
    })
    await pipeline(readable, sink)

    // Sanity check before rename — if the server hung up early or we
    // somehow ended up with a stub file, surface that as an error
    // rather than silently flipping the state to "ready".
    const finalSize = fs.statSync(partialPath).size
    if (finalSize < 100 * 1024 * 1024) {
      throw new Error(`Downloaded file too small (${finalSize} bytes) — likely truncated`)
    }

    await fs.promises.rename(partialPath, finalPath)
    broadcast({
      status: 'done',
      receivedBytes: finalSize,
      totalBytes: finalSize,
    })
    logInfo('Local model download complete', {
      bytes: finalSize,
      path: finalPath,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logError('Local model download failed', { error: message })
    broadcast({
      status: 'error',
      receivedBytes: lastProgress.receivedBytes,
      totalBytes: lastProgress.totalBytes,
      error: message,
    })
    throw err
  } finally {
    currentDownload = null
  }
}

export function cancelDownload(): void {
  if (currentDownload) {
    currentDownload.abort()
    currentDownload = null
    broadcast({
      status: 'idle',
      receivedBytes: 0,
      totalBytes: DEFAULT_WHISPER_MODEL_BYTES,
    })
  }
}

// Delete the model file and (best-effort) any .partial. Called from
// the "Uninstall model" button in Settings.
export async function uninstallWhisperModel(): Promise<void> {
  const target = whisperModelPath()
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
  logInfo('Local model uninstalled', { path: target })
  broadcast({
    status: 'idle',
    receivedBytes: 0,
    totalBytes: DEFAULT_WHISPER_MODEL_BYTES,
  })
}

// Surfaced to renderer's BrandLogo / "✓ Ready" badge.
export const MODEL_FILENAME = DEFAULT_WHISPER_MODEL
export const MODEL_DIR = modelsDir
export function modelFilePath(): string {
  return whisperModelPath()
}
