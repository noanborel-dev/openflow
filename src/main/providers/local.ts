import { spawn } from 'node:child_process'
import type { TranscriptionProvider } from './types'
import { whisperModelDownloaded, whisperModelPath } from '../local-models'
import { whisperCliPath, whisperCliAvailable, ffmpegAvailable } from '../local-binaries'

// Phase 1 skeleton. Phase 3 fills in the real ffmpeg + whisper-cli flow.
// We still surface a useful error when called early so a misconfigured
// run fails loudly instead of silently producing empty transcripts.
export class LocalModelMissingError extends Error {
  constructor() {
    super(
      'Local Whisper model is not downloaded yet. Open Settings → AI Provider → Local and click "Download model".'
    )
    this.name = 'LocalModelMissingError'
  }
}

export function createLocalWhisperProvider(): TranscriptionProvider {
  return {
    name: 'Local',
    async transcribe() {
      if (!whisperModelDownloaded()) throw new LocalModelMissingError()
      throw new Error(
        `Local Whisper transcription is not yet implemented (model present at ${whisperModelPath()}). Switch to Groq/OpenAI/Anthropic in Settings.`
      )
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
