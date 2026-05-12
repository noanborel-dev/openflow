// Quick smoke test for the local Whisper provider.
//
// We can't import the TS provider directly without spinning up
// electron-vite; instead this script mirrors the same pipeline (ffmpeg
// → 16kHz wav → whisper-cli -ojf → parse JSON) using the same paths
// the resolver would pick in dev. If THIS works, the provider works.
//
// Usage:
//   node scripts/smoke-local-transcribe.mjs /tmp/openflow-smoke.webm
//
// Exits 0 on success, prints the transcript to stdout.

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

const WHISPER_CLI = '/opt/homebrew/bin/whisper-cli'
const FFMPEG = process.argv.includes('--ffmpeg-static')
  ? (await import('ffmpeg-static')).default
  : '/opt/homebrew/bin/ffmpeg'
const MODEL = path.join(
  os.homedir(),
  'Library/Application Support/openflow/models/ggml-large-v3-turbo-q5_0.bin'
)

const input = process.argv[2]
if (!input) {
  console.error('usage: smoke-local-transcribe.mjs <audio.webm>')
  process.exit(2)
}

function runProc(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args)
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', d => stdout += d.toString())
    child.stderr.on('data', d => stderr += d.toString())
    child.on('error', reject)
    child.on('close', code => resolve({ code, stdout, stderr }))
  })
}

const tmp = path.join(os.tmpdir(), `openflow-smoke-${crypto.randomUUID()}`)
const wavPath = `${tmp}.wav`

console.log(`ffmpeg: ${FFMPEG}`)
console.log(`whisper-cli: ${WHISPER_CLI}`)
console.log(`model: ${MODEL}`)

const ff = await runProc(FFMPEG, ['-y', '-i', input, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wavPath])
if (ff.code !== 0) {
  console.error('ffmpeg failed:', ff.stderr.slice(-400))
  process.exit(1)
}
console.log('✓ ffmpeg → 16kHz wav')

const outBase = wavPath.replace(/\.wav$/, '')
const wp = await runProc(WHISPER_CLI, [
  '-m', MODEL,
  '-f', wavPath,
  '-of', outBase,
  '-ojf',
  '-l', 'auto',
  '-t', '4',
  '--no-prints',
])
if (wp.code !== 0) {
  console.error('whisper-cli failed:', wp.stderr.slice(-400))
  process.exit(1)
}

const json = JSON.parse(await fs.readFile(`${outBase}.json`, 'utf8'))
const segs = json.transcription ?? []
const text = segs.map(s => s.text ?? '').join('').trim()

console.log('✓ whisper-cli produced JSON')
console.log('---')
console.log(text)
console.log('---')
console.log(`segments: ${segs.length}`)
console.log(`language: ${json.result?.language ?? 'unknown'}`)

await fs.unlink(wavPath).catch(() => {})
await fs.unlink(`${outBase}.json`).catch(() => {})
