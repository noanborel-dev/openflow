import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { initWhisper, toggleNativeLog } from '@fugood/whisper.node'
import type { WhisperContext, TranscribeResult } from '@fugood/whisper.node'
import type { TranscriptionProvider } from './types'
import { NoSpeechError } from '../errors'
import { logInfo, logError } from '../log'
import { whisperModelDownloaded, whisperModelPath } from '../local-models'
import { ffmpegPath, ffmpegAvailable } from '../local-binaries'

// Whisper-cpp hallucinates these strings on silent / near-silent
// audio. Same heuristic the cloud pipeline uses (see pipeline.ts'
// HALLUCINATIONS set) — kept local because the fugood binding doesn't
// expose per-token confidence so we can't replicate the confidence-
// based guard used by the Groq provider. Pipeline.ts' isLikelySilence
// also catches these; this is a belt-and-braces check for the cases
// where the cloud pipeline's check isn't applied.
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

// Disable the native log spam from whisper.cpp. We still emit our own
// structured `logInfo` lines for the timing data we care about. This
// has to fire once globally, not per-context — the toggle is global
// across all WhisperContext / WhisperVadContext instances. Fire-and-
// forget: toggleNativeLog is async (it loads the platform-specific
// module) but we don't care about awaiting it; the very first
// transcribe will trigger module load anyway.
void toggleNativeLog(false).catch(() => { /* ignore */ })

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

// Persistent WhisperContext — the whole point of the @fugood/whisper.node
// switch over smart-whisper. fugood uses whisper_full() not
// whisper_full_with_state(), so the Metal compute buffers (~1GB worth)
// and shader pipelines are allocated once at context init and reused
// across every transcribe call. smart-whisper allocated a fresh
// whisper_state per call, which made every dictation eat ~600ms of
// pure Metal re-init.
let whisperContext: WhisperContext | null = null
let whisperContextPath: string | null = null
let loadingPromise: Promise<WhisperContext> | null = null

async function getContext(): Promise<WhisperContext> {
  const modelPath = whisperModelPath()
  if (whisperContext && whisperContextPath === modelPath) return whisperContext
  if (loadingPromise) return loadingPromise

  // Path changed (download to a new filename, model swap) — release
  // the prior context first to avoid double-allocating ~1GB of GPU
  // buffers during the swap.
  if (whisperContext) {
    try { await whisperContext.release() } catch { /* best-effort */ }
    whisperContext = null
    whisperContextPath = null
  }

  const start = Date.now()
  loadingPromise = initWhisper({
    filePath: modelPath,
    useGpu: true,
  }).then((ctx) => {
    whisperContext = ctx
    whisperContextPath = modelPath
    logInfo('Local whisper context ready', { ms: Date.now() - start, path: modelPath })
    loadingPromise = null
    return ctx
  }).catch((err) => {
    loadingPromise = null
    throw err
  })
  return loadingPromise
}

// Force-release the loaded context. Called from the uninstall IPC
// handler before we delete the model file so the file isn't held open
// across the unlink (Windows EBUSY, mac orphaned-RAM).
export async function freeLocalWhisper(): Promise<void> {
  if (whisperContext) {
    try { await whisperContext.release() } catch (err) {
      logError('Local whisper release failed', { error: String(err) })
    }
    whisperContext = null
    whisperContextPath = null
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

// Convert the renderer's WebM/Opus blob to a 16-bit signed PCM
// ArrayBuffer at 16kHz mono — the exact shape fugood's transcribeData
// expects. Writes a temp raw file because ffmpeg's stdout-piping can
// fragment on large clips; the file write costs ~5ms.
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
  // Single-character output (after punctuation trim) is almost
  // certainly silence-induced.
  if (cleaned.length < 2) return true
  return false
}

export function createLocalWhisperProvider(): TranscriptionProvider {
  return {
    name: 'Local',
    async transcribe(audio, options = {}) {
      if (!ffmpegAvailable()) throw new LocalBinaryMissingError('ffmpeg')
      if (!whisperModelDownloaded()) throw new LocalModelMissingError()

      const ffmpegStart = Date.now()
      const pcm = await webmToPcm16(audio)
      const ffmpegMs = Date.now() - ffmpegStart
      const seconds = pcm.byteLength / 2 / 16000

      const ctx = await getContext()
      const dict = options.dictionary ?? []
      const prompt = dict.length > 0 ? dict.join(', ') : undefined

      const inferStart = Date.now()
      const { promise } = ctx.transcribeData(pcm, {
        // Greedy decoding (beam=1, best_of=1, temp=0) is faster AND
        // more deterministic than the default beam=5. Dictation values
        // determinism (same audio → same transcript) and the accuracy
        // delta on clean speech is negligible.
        beamSize: 1,
        bestOf: 1,
        temperature: 0,
        maxThreads: 8,
        // Auto-detect when no explicit language. Critical for users
        // who dictate in multiple languages — forcing 'en' produces
        // phonetic garbage on Spanish / French.
        ...(options.language ? { language: options.language } : { language: 'auto' }),
        // The dictionary becomes Whisper's initial prompt — biases
        // toward known spellings (Claude vs cloud, etc.). Same role
        // as the cloud Groq provider's `prompt` parameter.
        ...(prompt ? { prompt } : {}),
      })
      const result: TranscribeResult = await promise
      const inferMs = Date.now() - inferStart

      logInfo('Local whisper inference', {
        ffmpegMs,
        inferMs,
        seconds: Number(seconds.toFixed(2)),
      })

      const text = result.result.trim()
      if (isLikelyHallucination(text)) {
        logInfo('Local whisper hallucination rejected', { preview: text.slice(0, 60) })
        throw new NoSpeechError()
      }
      return text
    },
  }
}

// Surfaced to the renderer via IPC. Two prerequisites since the
// switch to @fugood/whisper.node: the ffmpeg binary and the model
// file. The native addon itself loads at import time and would have
// crashed the main process by now if it weren't working.
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
