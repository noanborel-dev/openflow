import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

// Where local model files live on disk. We use Electron's user-data dir
// so the models survive app updates and don't bloat the .app bundle.
export function modelsDir(): string {
  return path.join(app.getPath('userData'), 'models')
}

// Default Whisper model: large-v3-turbo q5_0 (~547MB). Best speed/quality
// trade-off for short dictation on Apple Silicon. WER within ~1% of the
// full-precision model in informal benchmarks.
export const DEFAULT_WHISPER_MODEL = 'ggml-large-v3-turbo-q5_0.bin'

// Source the model is fetched from on first run. HuggingFace mirrors the
// official ggerganov/whisper.cpp model collection.
export const DEFAULT_WHISPER_MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin'

// Approx size in bytes used for UI ("Download model (547MB)") and partial-
// file integrity checks. Exact size from HuggingFace at time of writing is
// 574 041 856 — keep this loose so a re-quantized upload doesn't break us.
export const DEFAULT_WHISPER_MODEL_BYTES = 574_041_856

export function whisperModelPath(): string {
  return path.join(modelsDir(), DEFAULT_WHISPER_MODEL)
}

export function whisperModelDownloaded(): boolean {
  try {
    const stat = fs.statSync(whisperModelPath())
    // Real model is 500+MB; partial downloads or stub files must not be
    // treated as ready.
    return stat.size > 100 * 1024 * 1024
  } catch {
    return false
  }
}
