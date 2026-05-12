import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

// Resolve paths to the bundled whisper-cli + ffmpeg binaries.
//
// In a packaged build, electron-builder writes both into Contents/Resources
// via the extraResources / asarUnpack settings in electron-builder.yml:
//   - whisper-cli      → Resources/bin/whisper-cli
//   - ffmpeg-static    → Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg
//
// In dev (`electron-vite dev`) those bundled paths don't exist. We fall
// back to whichever copies the developer has on their machine — Homebrew
// for whisper-cli (`brew install whisper-cpp`) and the ffmpeg-static
// package's dev-mode export for ffmpeg. This lets `npm run dev` exercise
// the full local-transcription flow without rebuilding the .app.
//
// The "is it ready" check returns false in dev when whisper-cli is
// missing — surfaces the same "install whisper-cli or switch provider"
// path users would hit in the wild.

const isPackaged = app.isPackaged

function packagedWhisperCli(): string {
  return path.join(process.resourcesPath, 'bin', process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli')
}

function devWhisperCli(): string {
  // Apple Silicon Homebrew path. Intel-Mac Homebrew installs at
  // /usr/local/bin/whisper-cli — try that as a fallback.
  const candidates = ['/opt/homebrew/bin/whisper-cli', '/usr/local/bin/whisper-cli']
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return candidates[0]
}

export function whisperCliPath(): string {
  return isPackaged ? packagedWhisperCli() : devWhisperCli()
}

function packagedFfmpeg(): string {
  // app.asar.unpacked mirrors the node_modules/ tree for paths in
  // electron-builder.yml's asarUnpack list.
  return path.join(
    process.resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    'ffmpeg-static',
    process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  )
}

function devFfmpeg(): string {
  // ffmpeg-static exports a string path to its bundled binary. The
  // require() form avoids pulling the package into the renderer bundle.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegPath = require('ffmpeg-static') as string | null
    if (ffmpegPath && fs.existsSync(ffmpegPath)) return ffmpegPath
  } catch {
    // fall through
  }
  // Last-ditch Homebrew fallback for developers who somehow have
  // ffmpeg-static missing from node_modules.
  return '/opt/homebrew/bin/ffmpeg'
}

export function ffmpegPath(): string {
  return isPackaged ? packagedFfmpeg() : devFfmpeg()
}

export function whisperCliAvailable(): boolean {
  try {
    return fs.existsSync(whisperCliPath())
  } catch {
    return false
  }
}

export function ffmpegAvailable(): boolean {
  try {
    return fs.existsSync(ffmpegPath())
  } catch {
    return false
  }
}
