import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

// Where local model files live on disk. We use Electron's user-data dir
// so the models survive app updates and don't bloat the .app bundle.
export function modelsDir(): string {
  return path.join(app.getPath('userData'), 'models')
}

// Default Whisper model: large-v3-turbo q5 (~547MB). Best speed/quality
// trade-off for short dictation on Apple Silicon. WER within ~1% of the
// full-precision model in informal benchmarks.
export const DEFAULT_WHISPER_MODEL = 'ggml-large-v3-turbo-q5_0.bin'

export function whisperModelPath(): string {
  return path.join(modelsDir(), DEFAULT_WHISPER_MODEL)
}

export function whisperModelDownloaded(): boolean {
  try {
    const stat = fs.statSync(whisperModelPath())
    // Sanity: real model is 500+MB; partial downloads should not be
    // treated as ready.
    return stat.size > 100 * 1024 * 1024
  } catch {
    return false
  }
}
