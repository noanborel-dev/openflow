import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import type { TranscriptionProvider } from './types'
import { NoSpeechError } from '../errors'
import { logInfo, logError } from '../log'
import { whisperModelDownloaded, whisperModelPath } from '../local-models'

// Same thresholds we use for Groq-side hallucination detection. whisper.cpp
// emits the same per-segment confidence signals when -ojf is passed.
const NO_SPEECH_PROB_THRESHOLD = 0.55
const AVG_LOGPROB_THRESHOLD = -1.2
const COMPRESSION_RATIO_THRESHOLD = 2.4

// Resolve the binaries. In dev these come from Homebrew; for packaged
// builds we'll later ship them as Resources and switch on app.isPackaged.
// Hardcoding /opt/homebrew is fine for now — Apple Silicon only.
const WHISPER_CLI = '/opt/homebrew/bin/whisper-cli'
const FFMPEG = '/opt/homebrew/bin/ffmpeg'

interface WhisperJsonSegment {
  text?: string
  no_speech_prob?: number
  avg_logprob?: number
  compression_ratio?: number
}
interface WhisperJsonOutput {
  transcription?: Array<{
    text?: string
    offsets?: { from: number; to: number }
    no_speech_prob?: number
    avg_logprob?: number
    compression_ratio?: number
  }>
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
// so ffmpeg does the convert step. -ar 16000 -ac 1 -c:a pcm_s16le.
async function webmToWav16k(audio: Buffer): Promise<string> {
  const tmp = path.join(os.tmpdir(), `openflow-${crypto.randomUUID()}`)
  const inPath = `${tmp}.webm`
  const outPath = `${tmp}.wav`
  await fs.writeFile(inPath, audio)
  const { code, stderr } = await runProcess(FFMPEG, [
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
      if (!whisperModelDownloaded()) {
        throw new Error(`Local whisper model not found at ${whisperModelPath()}`)
      }

      const wavPath = await webmToWav16k(audio)
      // whisper-cli writes its JSON output next to the input file using
      // `-of <basename>` (extension is appended automatically).
      const outBase = wavPath.replace(/\.wav$/, '')
      const dict = options.dictionary ?? []
      const prompt = dict.length > 0 ? dict.join(', ') : ''

      const args = [
        '-m', whisperModelPath(),
        '-f', wavPath,
        '-of', outBase,
        '-ojf',                  // JSON-full: includes confidence signals
        '-l', options.language ?? 'auto',
        '-t', '4',
        '--no-prints',           // suppress per-segment progress on stderr
        ...(prompt ? ['--prompt', prompt] : []),
      ]

      const tStart = Date.now()
      const { code, stderr } = await runProcess(WHISPER_CLI, args)
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
      const text = segs.map(s => s.text ?? '').join('').trim()

      // Same hallucination guard as the Groq provider — whisper.cpp emits
      // identical confidence signals when -ojf is set.
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

// Used by settings UI to decide whether the "Local" option is selectable.
export function localWhisperReady(): boolean {
  return whisperModelDownloaded()
}
