import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import type { TranscriptionProvider } from './types'
import type { LocalModelId } from '../../shared/types'
import { NoSpeechError } from '../errors'
import { logInfo } from '../log'
import { localModelDownloaded, localModelPath, DEFAULT_LOCAL_MODEL } from '../local-models'
import { ffmpegPath, ffmpegAvailable } from '../local-binaries'
import { getSettings } from '../store'
import { getFocusedApp } from '../focused-app'
import { workerTranscribe, workerFree } from '../whisper-host'

// Whisper-cpp hallucinates these strings on silent / near-silent
// audio. Same heuristic the cloud pipeline uses (see pipeline.ts'
// HALLUCINATIONS set). Kept local because fugood's binding doesn't
// expose per-token confidence so we can't replicate the cloud
// provider's confidence-based guard.
const HALLUCINATION_STRINGS = new Set([
  '',
  '.',
  '...',
  'thanks for watching',
  'thanks for watching!',
  'thank you',
  'thank you.',
  'thanks',
  'you',
  'bye',
  'bye.',
  '[blank_audio]',
  '[silence]',
  '[music]',
  '[no audio]',
  '(silence)',
  '(soft music)',
])

export class LocalModelMissingError extends Error {
  constructor() {
    super(
      'Local Whisper model is not downloaded yet. Open Settings → AI Provider → Local and click "Download model".'
    )
    this.name = 'LocalModelMissingError'
  }
}

export class LocalBinaryMissingError extends Error {
  constructor(which: 'ffmpeg') {
    super(
      `ffmpeg is not installed. \`npm install\` should have pulled @ffmpeg-installer/ffmpeg; try removing node_modules and reinstalling.`
    )
    this.name = 'LocalBinaryMissingError'
    void which
  }
}

function selectedModelId(): LocalModelId {
  try {
    const settings = getSettings()
    const userPick = settings.provider.localModel ?? DEFAULT_LOCAL_MODEL
    // Auto-elevate to Accurate when the user is dictating into a
    // code-y context (IDE, terminal). Technical terms / brand names
    // / camelCase identifiers benefit disproportionately from the
    // large model's vocabulary breadth — small.en happily turns
    // "useEffect" into "use effect", "Claude Code" into "cloud
    // code", "TypeScript" into "type script". Auto-switching here
    // costs ~1s extra inference per code-context dictation but keeps
    // the lightning-fast Balanced/Fast path for the 90% of
    // dictations that are casual messaging or notes.
    //
    // Opt-out via settings.provider.localAutoAccurateInCode = false.
    // Only elevates UPWARD — if the user explicitly picked Accurate,
    // we don't downgrade them.
    if (settings.provider.localAutoAccurateInCode !== false && userPick !== 'large-v3-turbo') {
      try {
        const focused = getFocusedApp()
        const isCode = focused.category === 'code'
          || settings.devModeApps.includes(focused.bundleId)
        if (isCode && localModelDownloaded('large-v3-turbo')) {
          return 'large-v3-turbo'
        }
      } catch { /* fall through to user pick */ }
    }
    return userPick
  } catch {
    return DEFAULT_LOCAL_MODEL
  }
}

// Force-release the worker's WhisperContext. Called from the uninstall
// IPC handler before we delete the model file (keeping the file open
// across unlink would orphan RAM and on Windows would fail with EBUSY).
// The worker stays alive for the next dictation.
export async function freeLocalWhisper(): Promise<void> {
  await workerFree()
}

function runProcess(cmd: string, args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args)
    let stderr = ''
    child.stderr.on('data', (d) => { stderr += d.toString() })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? -1, stderr }))
  })
}

// Convert the renderer's WebM/Opus blob to a 16-bit signed PCM
// ArrayBuffer at 16kHz mono — the exact shape fugood's transcribeData
// expects. We write a tmp raw file because ffmpeg's stdout-piping can
// fragment on large clips (~5ms overhead, acceptable).
async function webmToPcm16(audio: Buffer): Promise<ArrayBuffer> {
  const tmp = path.join(os.tmpdir(), `openflow-${crypto.randomUUID()}`)
  const inPath = `${tmp}.webm`
  const outPath = `${tmp}.raw`
  await fs.writeFile(inPath, audio)
  const { code, stderr } = await runProcess(ffmpegPath(), [
    '-y',
    '-i', inPath,
    '-ar', '16000',
    '-ac', '1',
    '-f', 's16le',
    '-acodec', 'pcm_s16le',
    outPath,
  ])
  fs.unlink(inPath).catch(() => {})
  if (code !== 0) {
    fs.unlink(outPath).catch(() => {})
    throw new Error(`ffmpeg failed (${code}): ${stderr.slice(-300)}`)
  }
  const buf = await fs.readFile(outPath)
  fs.unlink(outPath).catch(() => {})
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

function isLikelyHallucination(text: string): boolean {
  const cleaned = text.trim().toLowerCase().replace(/[.!?,]+$/g, '')
  if (cleaned.length === 0) return true
  if (HALLUCINATION_STRINGS.has(cleaned)) return true
  if (cleaned.length < 2) return true
  return false
}

export function createLocalWhisperProvider(): TranscriptionProvider {
  return {
    name: 'Local',
    async transcribe(audio, options = {}) {
      if (!ffmpegAvailable()) throw new LocalBinaryMissingError('ffmpeg')
      const modelId = selectedModelId()
      if (!localModelDownloaded(modelId)) throw new LocalModelMissingError()

      const ffmpegStart = Date.now()
      const pcm = await webmToPcm16(audio)
      const ffmpegMs = Date.now() - ffmpegStart
      const seconds = pcm.byteLength / 2 / 16000

      const dict = options.dictionary ?? []
      const prompt = dict.length > 0 ? dict.join(', ') : undefined
      // All current local models are multilingual; auto-detect lets
      // users switch between languages without rebinding the setting.
      // The detection pass is fast on small/base (~10-20ms) and the
      // wins for bilingual / trilingual users are large.
      const language = options.language ?? 'auto'

      // Inference runs in the whisper utility process — see
      // src/main/whisper-host.ts and src/main/whisper-worker.ts.
      // Doing it there instead of in main avoids Chromium's macOS
      // QoS class downgrade (especially under LSUIElement) which
      // would otherwise halve the Metal command-queue throughput.
      const inferStart = Date.now()
      const result = await workerTranscribe(
        localModelPath(modelId),
        pcm,
        {
          // Greedy decoding (beam=1, best_of=1, temp=0) is faster AND
          // more deterministic than the default beam=5. Dictation
          // values determinism — same audio → same transcript —
          // and the accuracy delta on clean speech is negligible.
          beamSize: 1,
          bestOf: 1,
          temperature: 0,
          // M-series has ~6 performance cores; more threads pushes
          // work onto efficiency cores (3-4x slower per thread).
          // 4 threads ties 8 threads on M5 Pro standalone and leaves
          // headroom for the rest of the app.
          maxThreads: 4,
          language,
          // Dictionary becomes Whisper's initial prompt — biases
          // toward known spellings.
          ...(prompt ? { prompt } : {}),
        },
        // Forward fugood's per-segment callback through the worker IPC
        // to the pipeline. The caller drives the indicator pill with
        // these so the user sees words appearing as whisper produces
        // them — perceived latency on a 35s clip drops from ~1400ms to
        // ~200ms (time to first segment).
        options.onPartial
      )
      const inferMs = Date.now() - inferStart

      logInfo('Local whisper inference', {
        ffmpegMs,
        inferMs,
        workerMs: result.ms,
        seconds: Number(seconds.toFixed(2)),
      })

      const text = result.text.trim()
      if (isLikelyHallucination(text)) {
        logInfo('Local whisper hallucination rejected', { preview: text.slice(0, 60) })
        throw new NoSpeechError()
      }
      return text
    },
  }
}

// Surfaced to the renderer via IPC. Two prerequisites: the ffmpeg
// binary and the selected model file. The worker handles the NAPI
// addon load lazily — if that ever fails, the next transcribe call
// surfaces the worker error.
export interface LocalReadiness {
  ready: boolean
  whisperCli: boolean   // kept for IPC compat — always true now
  ffmpeg: boolean
  modelDownloaded: boolean
}

export function localWhisperReadiness(): LocalReadiness {
  const ffmpeg = ffmpegAvailable()
  const modelDownloaded = localModelDownloaded(selectedModelId())
  return {
    whisperCli: true,
    ffmpeg,
    modelDownloaded,
    ready: ffmpeg && modelDownloaded,
  }
}

export function localWhisperReady(): boolean {
  return localWhisperReadiness().ready
}
