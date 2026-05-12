import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { Whisper } from 'smart-whisper'
import type { TranscriptionProvider } from './types'
import { NoSpeechError } from '../errors'
import { logInfo, logError } from '../log'
import { whisperModelDownloaded, whisperModelPath } from '../local-models'
import { ffmpegPath, ffmpegAvailable } from '../local-binaries'

// We classify a clip as a likely silence-hallucination using the avg
// token probability that smart-whisper returns in `format: 'detail'`.
// Whisper outputs confident-looking tokens on real speech (>0.65 avg);
// on near-silent audio it spits low-confidence multilingual word-salad
// (<0.50). The 0.55 threshold is conservative — empty/single-segment
// runs are also caught by the isLikelySilence pass in pipeline.ts.
const MIN_CONFIDENCE = 0.55

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
      `ffmpeg is not installed. \`npm install\` should have pulled ffmpeg-static; try removing node_modules and reinstalling.`
    )
    this.name = 'LocalBinaryMissingError'
    void which
  }
}

// Persistent Whisper instance. Loaded lazily on the first dictation so
// app startup stays fast for users who don't pick Local; held in memory
// thereafter so every subsequent dictation skips the ~700ms model-load
// cost. Freed when the user uninstalls the model or switches providers
// AND the app is idle (we don't free aggressively — RAM is cheap, the
// alternative is 700ms penalty on every cold dictation after idle).
let whisperInstance: Whisper | null = null
let whisperInstancePath: string | null = null

async function getWhisper(): Promise<Whisper> {
  const modelPath = whisperModelPath()
  if (whisperInstance && whisperInstancePath === modelPath) return whisperInstance
  // Path changed (re-download to a different filename, or first load).
  // Free old instance before creating a new one to avoid double-load
  // RAM spike.
  if (whisperInstance) {
    try {
      await whisperInstance.free()
    } catch {
      // ignore — best-effort cleanup
    }
    whisperInstance = null
  }
  const start = Date.now()
  whisperInstance = new Whisper(modelPath, { gpu: true })
  whisperInstancePath = modelPath
  logInfo('Local whisper model loaded', { ms: Date.now() - start, path: modelPath })
  return whisperInstance
}

// Force-free the model. Called from the IPC uninstall handler so the
// file isn't held open while we try to delete it.
export async function freeLocalWhisper(): Promise<void> {
  if (whisperInstance) {
    try {
      await whisperInstance.free()
    } catch (err) {
      logError('Local whisper free failed', { error: String(err) })
    }
    whisperInstance = null
    whisperInstancePath = null
  }
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

// Convert the renderer's WebM/Opus buffer to 16kHz mono Float32 PCM
// in-memory. ffmpeg writes raw f32le samples to a tmp file; we mmap-
// read them into a Float32Array. Skips the WAV header / decoder
// roundtrip that the old whisper-cli pipeline forced.
async function webmToFloat32(audio: Buffer): Promise<Float32Array> {
  const tmp = path.join(os.tmpdir(), `openflow-${crypto.randomUUID()}`)
  const inPath = `${tmp}.webm`
  const outPath = `${tmp}.raw`
  await fs.writeFile(inPath, audio)
  const { code, stderr } = await runProcess(ffmpegPath(), [
    '-y',
    '-i', inPath,
    '-ar', '16000',
    '-ac', '1',
    '-f', 'f32le',
    '-acodec', 'pcm_f32le',
    outPath,
  ])
  fs.unlink(inPath).catch(() => {})
  if (code !== 0) {
    fs.unlink(outPath).catch(() => {})
    throw new Error(`ffmpeg failed (${code}): ${stderr.slice(-300)}`)
  }
  const buf = await fs.readFile(outPath)
  fs.unlink(outPath).catch(() => {})
  // Wrap the underlying ArrayBuffer; the byteOffset/byteLength keep
  // alignment safe across Node Buffer pool reuse.
  return new Float32Array(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  )
}

// Whisper's encoder cost scales with audio_ctx (max 1500 for 30s
// model context). For shorter clips we can cap audio_ctx and shave the
// encoder pass — a 3s clip with audio_ctx=256 runs ~150ms vs ~600ms at
// the default 1500. We round up to a multiple of 64 for graph-cache
// stability (mismatched ctx forces whisper.cpp to reserve new compute
// buffers, which costs ~100ms) and add a 1s safety margin so the
// transcript doesn't get truncated near the end of the clip.
//
// Empirical mapping from the audio_ctx sweep:
//   ctx=256  → safe up to ~4s of audio
//   ctx=512  → safe up to ~9s
//   ctx=768  → unreliable (hallucinated repetitions) — skip
//   ctx=1024 → safe up to ~19s
//   ctx=1500 → full 30s
//
// We bucket into known-good values rather than picking arbitrary numbers
// to avoid the audio_ctx=768 bug zone.
function audioCtxFor(seconds: number): number {
  if (seconds <= 4) return 256
  if (seconds <= 9) return 512
  if (seconds <= 18) return 1024
  return 1500
}

export function createLocalWhisperProvider(): TranscriptionProvider {
  return {
    name: 'Local',
    async transcribe(audio, options = {}) {
      if (!ffmpegAvailable()) throw new LocalBinaryMissingError('ffmpeg')
      if (!whisperModelDownloaded()) throw new LocalModelMissingError()

      const ffmpegStart = Date.now()
      const pcm = await webmToFloat32(audio)
      const ffmpegMs = Date.now() - ffmpegStart
      const seconds = pcm.length / 16000
      const audioCtx = audioCtxFor(seconds)

      const whisper = await getWhisper()
      const dict = options.dictionary ?? []
      const prompt = dict.length > 0 ? dict.join(', ') : undefined

      const inferStart = Date.now()
      const task = await whisper.transcribe(pcm, {
        // Single-segment for short dictations — skips the segmentation
        // pass and shaves ~30ms. Long clips still produce reasonable
        // output; whisper.cpp falls back to internal chunking when the
        // audio overruns audio_ctx.
        single_segment: true,
        // Greedy decoding (beam=1, best_of=1, temp=0) is faster AND
        // more deterministic than the default beam=5 — dictation
        // benefits from determinism (same audio → same transcript)
        // and the accuracy delta on clean speech is negligible.
        beam_size: 1,
        best_of: 1,
        temperature: 0,
        n_threads: 8,
        audio_ctx: audioCtx,
        // Default 'simple' format drops per-token confidence. 'detail'
        // gives us the `confidence` field we use for the hallucination
        // check below.
        format: 'detail',
        // Use the dictionary as Whisper's `initial_prompt` to bias the
        // transcript toward known spellings — same role as the Groq
        // provider's `prompt` parameter.
        ...(prompt ? { initial_prompt: prompt } : {}),
        // Auto-detect language by passing 'auto' — important so users
        // who dictate in multiple languages aren't forced into one.
        // (Cloud Groq does the same.)
        ...(options.language ? { language: options.language } : { language: 'auto' }),
      })
      const segs = await task.result
      const inferMs = Date.now() - inferStart

      logInfo('Local whisper inference', {
        ffmpegMs,
        inferMs,
        seconds: Number(seconds.toFixed(2)),
        audioCtx,
      })

      // segs is the detail format — each entry has .text and .confidence.
      // smart-whisper returns a single segment for single_segment: true.
      type DetailSeg = { text?: string; confidence?: number; lang?: string }
      const detailSegs = segs as unknown as DetailSeg[]
      const text = detailSegs.map((s) => s.text ?? '').join('').trim()

      if (detailSegs.length > 0) {
        // Min confidence across segments — even one low-confidence
        // segment is a hallucination signal.
        const minConfidence = detailSegs.reduce(
          (m, x) => Math.min(m, x.confidence ?? 1),
          1
        )
        if (minConfidence < MIN_CONFIDENCE) {
          logInfo('Local whisper hallucination rejected', {
            minConfidence: Number(minConfidence.toFixed(3)),
            language: detailSegs[0]?.lang,
            preview: text.slice(0, 60),
          })
          throw new NoSpeechError()
        }
      }

      return text
    },
  }
}

// Surfaced to the renderer via IPC. Three independent prerequisites:
// the ffmpeg binary, the model file, and (transitively) the smart-
// whisper NAPI addon, which we assume loaded successfully — if it
// didn't, the import at top would have thrown and the app wouldn't
// have started. So we don't have a runtime "binding loaded" check.
export interface LocalReadiness {
  ready: boolean
  whisperCli: boolean   // kept for IPC compat — always true now
  ffmpeg: boolean
  modelDownloaded: boolean
}

export function localWhisperReadiness(): LocalReadiness {
  const ffmpeg = ffmpegAvailable()
  const modelDownloaded = whisperModelDownloaded()
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
