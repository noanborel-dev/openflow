import { execFile, exec as execCb } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, access } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { TranscriptionProvider } from './types'

const exec = promisify(execFile)
const execShell = promisify(execCb)

// Python script that uses openai-whisper (downloads model from Azure CDN, not HuggingFace)
const WHISPER_PY = `
import sys, json
import whisper

model = whisper.load_model("base")
result = model.transcribe(sys.argv[1])
print(result["text"].strip())
`

function getFfmpegPath(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const p = require('ffmpeg-static') as string | null
  if (!p) throw new Error('ffmpeg-static not found')
  return p
}

async function isPythonWhisperInstalled(): Promise<boolean> {
  try {
    await execShell('python3 -c "import whisper"')
    return true
  } catch {
    return false
  }
}

async function installWhisper(onProgress?: (pct: number) => void): Promise<void> {
  onProgress?.(0)
  console.log('[OpenFlow] Installing openai-whisper (one-time setup)…')
  await execShell('pip3 install -q openai-whisper')
  onProgress?.(100)
  console.log('[OpenFlow] openai-whisper installed.')
}

async function convertToWav(webmBuffer: Buffer, wavPath: string): Promise<void> {
  const webmPath = wavPath.replace('.wav', '.webm')
  await writeFile(webmPath, webmBuffer)
  try {
    await exec(getFfmpegPath(), [
      '-y', '-i', webmPath,
      '-ar', '16000', '-ac', '1', '-f', 'wav', wavPath,
    ])
  } finally {
    await unlink(webmPath).catch(() => {})
  }
}

let setupPromise: Promise<void> | null = null

async function ensureWhisper(onProgress?: (pct: number) => void): Promise<void> {
  if (await isPythonWhisperInstalled()) return
  await installWhisper(onProgress)
}

export function createLocalWhisperProvider(
  onDownloadProgress?: (pct: number) => void
): TranscriptionProvider {
  // Kick off setup in background
  if (!setupPromise) {
    setupPromise = ensureWhisper(onDownloadProgress).catch(e => {
      console.error('[OpenFlow] Whisper setup error:', e)
      setupPromise = null
    })
  }

  return {
    name: 'Local (Whisper)',
    async transcribe(audio) {
      const id = Date.now()
      const wavPath = join(tmpdir(), `openflow-${id}.wav`)
      const pyPath = join(tmpdir(), `openflow-whisper-${id}.py`)

      try {
        // Ensure setup is complete (will wait if still installing)
        await ensureWhisper(onDownloadProgress)

        await convertToWav(audio, wavPath)
        await writeFile(pyPath, WHISPER_PY)

        const { stdout } = await execShell(`python3 "${pyPath}" "${wavPath}"`)
        return stdout.trim()
      } finally {
        await unlink(wavPath).catch(() => {})
        await unlink(pyPath).catch(() => {})
      }
    },
  }
}

export function resetLocalWhisperPipeline(): void {
  setupPromise = null
}
