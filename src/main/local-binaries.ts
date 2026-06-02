import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

// Resolve path to the bundled ffmpeg binary.
//
// We use @ffmpeg-installer/ffmpeg, which ships a per-platform ffmpeg
// binary built against LGPL-2.1 only (compatible with closed-source
// redistribution; see THIRD_PARTY_LICENSES.md). In a packaged build,
// electron-builder unpacks it via the asarUnpack entry in
// electron-builder.yml. The package layout is:
//   node_modules/@ffmpeg-installer/<platform-arch>/ffmpeg(.exe)
// with the active-platform export resolved through the parent
// @ffmpeg-installer/ffmpeg package, which exposes `.path`.

const isPackaged = app.isPackaged

function packagedFfmpeg(): string {
  // After electron-builder unpacks node_modules into
  // app.asar.unpacked, the @ffmpeg-installer parent package's
  // resolution of `.path` still works because the per-platform
  // sub-package is also unpacked alongside it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const installer = require('@ffmpeg-installer/ffmpeg') as { path: string }
  // In packaged builds the resolved path may live under
  // node_modules/ but inside app.asar; remap to the unpacked
  // equivalent so the binary is actually present on disk.
  return installer.path.replace(
    `${path.sep}app.asar${path.sep}`,
    `${path.sep}app.asar.unpacked${path.sep}`
  )
}

function devFfmpeg(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const installer = require('@ffmpeg-installer/ffmpeg') as { path: string }
    if (installer.path && fs.existsSync(installer.path)) return installer.path
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
