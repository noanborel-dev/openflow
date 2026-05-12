import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

// On-disk model storage. We use Electron's user-data dir so models
// survive app updates and don't bloat the .app bundle.
export function modelsDir(): string {
  return path.join(app.getPath('userData'), 'models')
}

// Available local Whisper model tiers. The default is `small.en` — it
// hits ~120ms warm on M-series for a 3s clip via whisper.cpp+Metal,
// which is the speed Willow Voice / Wispr Flow market as their cloud
// pitch. English accuracy is near-identical to large-v3-turbo for
// conversational dictation (the WER gap is in noisy / accented /
// non-English audio, which dictation rarely is).
//
// Users who want multilingual or maximum accuracy can pick `large` in
// Settings. Users on slow connections or older Macs can pick `base`
// for sub-100ms with a small accuracy tradeoff.
//
// The .en variants are English-only and noticeably faster than the
// multilingual variants of the same size. Whisper's multilingual
// detection pass adds ~30-50ms per call.
export type LocalModelId = 'base.en' | 'small.en' | 'large-v3-turbo'

export const DEFAULT_LOCAL_MODEL: LocalModelId = 'small.en'

interface LocalModelInfo {
  id: LocalModelId
  filename: string
  url: string
  bytes: number          // approximate, used for download progress %
  sizeLabel: string      // shown in Settings, e.g. "181 MB"
  speedLabel: string     // shown in Settings, e.g. "~120ms"
  description: string    // one-line UX copy
}

export const LOCAL_MODELS: Record<LocalModelId, LocalModelInfo> = {
  'base.en': {
    id: 'base.en',
    filename: 'ggml-base.en-q5_1.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin',
    bytes: 59_721_011,
    sizeLabel: '57 MB',
    speedLabel: '~80 ms',
    description: 'Tiny + ultra-fast. English only. Some mistakes on names and acronyms.',
  },
  'small.en': {
    id: 'small.en',
    filename: 'ggml-small.en-q5_1.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q5_1.bin',
    bytes: 190_098_681,
    sizeLabel: '181 MB',
    speedLabel: '~200 ms',
    description: 'Recommended. Sub-300ms warm. English only. Near-perfect for dictation.',
  },
  'large-v3-turbo': {
    id: 'large-v3-turbo',
    filename: 'ggml-large-v3-turbo-q5_0.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin',
    bytes: 574_041_856,
    sizeLabel: '547 MB',
    speedLabel: '~900 ms',
    description: 'Highest accuracy. Multilingual. Slower — best for non-English or noisy audio.',
  },
}

export function localModelInfo(id: LocalModelId): LocalModelInfo {
  return LOCAL_MODELS[id]
}

export function localModelPath(id: LocalModelId): string {
  return path.join(modelsDir(), LOCAL_MODELS[id].filename)
}

export function localModelDownloaded(id: LocalModelId): boolean {
  try {
    const stat = fs.statSync(localModelPath(id))
    const expected = LOCAL_MODELS[id].bytes
    // Allow ±10% slack — quantization updates can shift the exact
    // byte count slightly. Reject anything under 80% of expected (a
    // partial / truncated download).
    return stat.size > expected * 0.8
  } catch {
    return false
  }
}

// Legacy helpers — kept for compat with any callers that haven't been
// updated to the id-aware versions. Default to the active "selected"
// model; the caller can pass an explicit id if they need a specific
// one.
export const DEFAULT_WHISPER_MODEL = LOCAL_MODELS[DEFAULT_LOCAL_MODEL].filename
export const DEFAULT_WHISPER_MODEL_URL = LOCAL_MODELS[DEFAULT_LOCAL_MODEL].url
export const DEFAULT_WHISPER_MODEL_BYTES = LOCAL_MODELS[DEFAULT_LOCAL_MODEL].bytes

export function whisperModelPath(id: LocalModelId = DEFAULT_LOCAL_MODEL): string {
  return localModelPath(id)
}

export function whisperModelDownloaded(id: LocalModelId = DEFAULT_LOCAL_MODEL): boolean {
  return localModelDownloaded(id)
}
