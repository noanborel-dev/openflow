import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

// Resolve path to the bundled ffmpeg binary.
//
// In a packaged build, electron-builder writes it into Resources via
// the asarUnpack entry in electron-builder.yml:
//   Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg
//
// In dev (`electron-vite dev`) that path doesn't exist. We fall back
// to the ffmpeg-static npm package's dev-mode export, which points at
// the same binary inside node_modules/.
//
// Note: whisper-cli is no longer needed — we switched to the
// smart-whisper NAPI addon, which bundles libwhisper internally.

const isPackaged = app.isPackaged

function packagedFfmpeg(): string {
  return path.join(
    process.resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    'ffmpeg-static',
    process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  )
}

function devFfmpeg(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegPath = require('ffmpeg-static') as string | null
    if (ffmpegPath && fs.existsSync(ffmpegPath)) return ffmpegPath
  } catch {
    // fall through
  }
  return '/opt/homebrew/bin/ffmpeg'
}

export function ffmpegPath(): string {
  return isPackaged ? packagedFfmpeg() : devFfmpeg()
}

export function ffmpegAvailable(): boolean {
  try {
    return fs.existsSync(ffmpegPath())
  } catch {
    return false
  }
}
