import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import type { TranscriptionProvider } from './types'
import { NoSpeechError } from '../errors'
import { logInfo, logError } from '../log'
import { whisperModelDownloaded, whisperModelPath } from '../local-models'
import {
  whisperCliPath,
  whisperCliAvailable,
  ffmpegPath,
  ffmpegAvailable,
} from '../local-binaries'

// Same per-segment confidence thresholds we apply to cloud Whisper.
// whisper.cpp's `-ojf` output exposes the same `no_speech_prob`,
// `avg_logprob`, and `compression_ratio` signals. We check the *max*
// no_speech_prob and *min* avg_logprob across segments rather than
// averages — averages wash out a clearly-silent segment in the middle
// of a longer clip and let hallucinations pass.
const NO_SPEECH_PROB_THRESHOLD = 0.55
const AVG_LOGPROB_THRESHOLD = -1.2
const COMPRESSION_RATIO_THRESHOLD = 2.4

export class LocalModelMissingError extends Error {
  constructor() {
    super(
      'Local Whisper model is not downloaded yet. Open Settings → AI Provider → Local and click "Download model".'
    )
    this.name = 'LocalModelMissingError'
  }
}

export class LocalBinaryMissingError extends Error {
  constructor(which: 'whisper-cli' | 'ffmpeg') {
    super(
      which === 'whisper-cli'
        ? 'whisper-cli is not installed. In dev, `brew install whisper-cpp`. In a packaged build, this indicates a broken install — re-download the .app.'
        : 'ffmpeg is not installed. `npm install` should have pulled ffmpeg-static; try removing node_modules and reinstalling.'
    )
    this.name = 'LocalBinaryMissingError'
  }
}

interface WhisperJsonSegment {
  text?: string
  no_speech_prob?: number
  avg_logprob?: number
  compression_ratio?: number
  offsets?: { from: number; to: number }
}
interface WhisperJsonOutput {
  transcription?: WhisperJsonSegment[]
  result?: { language?: string }
}

function runProcess(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args)
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => { stdout += d.toString() })
    child.stderr.on('data', (d) => { stderr += d.toString() })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }))
  })
}

// whisper.cpp wants 16kHz mono PCM16 WAV. The renderer hands us WebM/Opus,
// so ffmpeg does the convert step (-ar 16000 -ac 1 -c:a pcm_s16le).
async function webmToWav16k(audio: Buffer): Promise<string> {
  const tmp = path.join(os.tmpdir(), `openflow-${crypto.randomUUID()}`)
  const inPath = `${tmp}.webm`
  const outPath = `${tmp}.wav`
  await fs.writeFile(inPath, audio)
  const { code, stderr } = await runProcess(ffmpegPath(), [
    '-y',
    '-i', inPath,
    '-ar', '16000',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    outPath,
  ])
  // Best-effort cleanup of the input — output gets cleaned by caller.
  fs.unlink(inPath).catch(() => {})
  if (code !== 0) {
    throw new Error(`ffmpeg failed (${code}): ${stderr.slice(-300)}`)
  }
  return outPath
}

export function createLocalWhisperProvider(): TranscriptionProvider {
  return {
    name: 'Local',
    async transcribe(audio, options = {}) {
      if (!whisperCliAvailable()) throw new LocalBinaryMissingError('whisper-cli')
      if (!ffmpegAvailable()) throw new LocalBinaryMissingError('ffmpeg')
      if (!whisperModelDownloaded()) throw new LocalModelMissingError()

      const wavPath = await webmToWav16k(audio)
      const outBase = wavPath.replace(/\.wav$/, '')
      const dict = options.dictionary ?? []
      // whisper.cpp's `--prompt` shares the same 224-token cap as the
      // cloud API; comma-separated terms bias toward specific spellings.
      const prompt = dict.length > 0 ? dict.join(', ') : ''

      const args = [
        '-m', whisperModelPath(),
        '-f', wavPath,
        '-of', outBase,
        '-ojf',                  // JSON-full: per-segment confidence
        '-l', options.language ?? 'auto',
        // -t 4 = 4 threads. M-series cores are plenty fast on a 30s
        // clip even single-threaded; 4 leaves headroom for the rest of
        // the system and avoids pinning all P-cores during dictation.
        '-t', '4',
        '--no-prints',           // suppress per-segment progress on stderr
        ...(prompt ? ['--prompt', prompt] : []),
      ]

      const tStart = Date.now()
      const { code, stderr } = await runProcess(whisperCliPath(), args)
      logInfo('whisper-cli ran', { ms: Date.now() - tStart, code })

      // Always clean up the WAV; JSON gets cleaned after parse.
      fs.unlink(wavPath).catch(() => {})

      if (code !== 0) {
        const tail = stderr.slice(-300)
        logError('whisper-cli failed', { code, stderr: tail })
        throw new Error(`whisper-cli failed (${code}): ${tail}`)
      }

      const jsonPath = `${outBase}.json`
      const raw = await fs.readFile(jsonPath, 'utf8')
      fs.unlink(jsonPath).catch(() => {})
      const parsed = JSON.parse(raw) as WhisperJsonOutput

      const segs = parsed.transcription ?? []
      const text = segs.map((s) => s.text ?? '').join('').trim()

      // Same hallucination guard as the Groq provider — whisper.cpp's
      // -ojf output exposes the same per-segment signals.
      if (segs.length > 0) {
        const maxNoSpeech = segs.reduce((m, x) => Math.max(m, x.no_speech_prob ?? 0), 0)
        const minLogprob = segs.reduce((m, x) => Math.min(m, x.avg_logprob ?? 0), 0)
        const maxCompression = segs.reduce((m, x) => Math.max(m, x.compression_ratio ?? 0), 0)

        const looksLikeHallucination =
          maxNoSpeech > NO_SPEECH_PROB_THRESHOLD ||
          minLogprob < AVG_LOGPROB_THRESHOLD ||
          maxCompression > COMPRESSION_RATIO_THRESHOLD

        if (looksLikeHallucination) {
          logInfo('Local whisper hallucination rejected', {
            maxNoSpeech: Number(maxNoSpeech.toFixed(3)),
            minLogprob: Number(minLogprob.toFixed(3)),
            maxCompression: Number(maxCompression.toFixed(3)),
            language: parsed.result?.language,
            preview: text.slice(0, 60),
          })
          throw new NoSpeechError()
        }
      }

      return text
    },
  }
}

// Surfaced to the renderer via IPC so the Local provider card can render
// "✓ Ready" vs the download flow without re-implementing the check.
// Three independent prerequisites: the whisper-cli binary, the ffmpeg
// binary, and the model file. All three must be present.
export interface LocalReadiness {
  ready: boolean
  whisperCli: boolean
  ffmpeg: boolean
  modelDownloaded: boolean
}

export function localWhisperReadiness(): LocalReadiness {
  const whisperCli = whisperCliAvailable()
  const ffmpeg = ffmpegAvailable()
  const modelDownloaded = whisperModelDownloaded()
  return {
    whisperCli,
    ffmpeg,
    modelDownloaded,
    ready: whisperCli && ffmpeg && modelDownloaded,
  }
}

export function localWhisperReady(): boolean {
  return localWhisperReadiness().ready
}

// Dev-mode smoke test. Runs `whisper-cli --version` to confirm the
// resolved path actually launches. Used by the smoke-test IPC and as a
// startup sanity check when the user has Local selected. Returns the
// version string on success; throws on failure.
export async function whisperCliSmokeTest(): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(whisperCliPath(), ['--help'])
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => { out += d.toString() })
    child.stderr.on('data', (d) => { err += d.toString() })
    child.on('error', reject)
    child.on('close', (code) => {
      // whisper-cli prints help to stderr on most versions and exits 1.
      // We treat *any* startup as success — what we're checking is that
      // the binary is on disk, executable, and links correctly.
      const text = (out + err).slice(0, 400)
      if (text.toLowerCase().includes('usage') || text.toLowerCase().includes('whisper')) {
        resolve(text.split('\n')[0]?.trim() || `exit ${code}`)
      } else {
        reject(new Error(`whisper-cli launch failed (code ${code}): ${text || 'no output'}`))
      }
    })
  })
}
