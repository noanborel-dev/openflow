import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { TranscriptionProvider } from './types'

const exec = promisify(execFile)

// Lazily loaded to avoid slowing down app startup
let pipelineInstance: unknown = null

async function getWhisperPipeline(
  model: string,
  onProgress?: (pct: number) => void
): Promise<(input: string, opts: object) => Promise<{ text: string }>> {
  if (pipelineInstance) return pipelineInstance as ReturnType<typeof getWhisperPipeline> extends Promise<infer T> ? T : never

  // Dynamic import so the large package doesn't load at startup
  const { pipeline, env } = await import('@xenova/transformers')

  // Store models in app userData instead of ~/.cache/huggingface
  // env.cacheDir is set by the caller (main/index.ts) before first use

  pipelineInstance = await pipeline(
    'automatic-speech-recognition',
    model,
    {
      quantized: true,
      progress_callback: (p: { status: string; progress?: number }) => {
        if (p.status === 'downloading' && onProgress && p.progress != null) {
          onProgress(p.progress)
        }
      },
    }
  )

  return pipelineInstance as ReturnType<typeof getWhisperPipeline> extends Promise<infer T> ? T : never
}

function getFfmpegPath(): string {
  // ffmpeg-static returns the path to the bundled ffmpeg binary
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ffmpegStatic = require('ffmpeg-static') as string | null
  if (!ffmpegStatic) throw new Error('ffmpeg-static binary not found')
  return ffmpegStatic
}

async function convertToWav(webmBuffer: Buffer, wavPath: string): Promise<void> {
  const webmPath = wavPath.replace('.wav', '.webm')
  await writeFile(webmPath, webmBuffer)
  try {
    await exec(getFfmpegPath(), [
      '-y',                // overwrite output
      '-i', webmPath,      // input file
      '-ar', '16000',      // resample to 16kHz
      '-ac', '1',          // mono
      '-f', 'wav',         // WAV output
      wavPath,
    ])
  } finally {
    await unlink(webmPath).catch(() => {})
  }
}

export function createLocalWhisperProvider(
  model: string,
  onProgress?: (pct: number) => void
): TranscriptionProvider {
  return {
    name: 'Local (Whisper)',
    async transcribe(audio) {
      const id = Date.now()
      const wavPath = join(tmpdir(), `openflow-${id}.wav`)

      try {
        await convertToWav(audio, wavPath)
        const pipe = await getWhisperPipeline(model, onProgress)
        const result = await (pipe as (input: string, opts: object) => Promise<{ text: string }>)(
          wavPath,
          { language: 'english', task: 'transcribe' }
        )
        return result.text.trim()
      } finally {
        await unlink(wavPath).catch(() => {})
      }
    },
  }
}

/** Reset the cached pipeline (e.g., when model changes) */
export function resetLocalWhisperPipeline(): void {
  pipelineInstance = null
}
