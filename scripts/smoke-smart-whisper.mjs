// Bench smart-whisper vs the spawn-fresh whisper-cli approach.
//
// What we measure:
//   1. Cold start (model load) — happens once
//   2. Warm transcribe of a 3.5s clip — what every dictation looks like
//      after the first
//
// Compares against the spawn-fresh /tmp pipeline so we have a concrete
// number to point at when deciding whether to switch.
//
// Usage: node scripts/smoke-smart-whisper.mjs /tmp/openflow-smoke.webm

import { Whisper } from 'smart-whisper'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

const INPUT = process.argv[2] ?? '/tmp/openflow-smoke.webm'
const MODEL = path.join(
  os.homedir(),
  'Library/Application Support/openflow/models/ggml-large-v3-turbo-q5_0.bin'
)

function runProc(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args)
    let stdout = '', stderr = ''
    child.stdout.on('data', d => stdout += d.toString())
    child.stderr.on('data', d => stderr += d.toString())
    child.on('error', reject)
    child.on('close', code => resolve({ code, stdout, stderr }))
  })
}

// Convert input to 16kHz mono PCM, return Float32Array.
async function audioToFloat32(input) {
  const tmp = path.join(os.tmpdir(), `bench-${crypto.randomUUID()}.raw`)
  const ffmpegStatic = (await import('ffmpeg-static')).default
  const { code, stderr } = await runProc(ffmpegStatic, [
    '-y', '-i', input,
    '-ar', '16000', '-ac', '1',
    '-f', 'f32le',          // raw 32-bit float LE
    '-acodec', 'pcm_f32le',
    tmp,
  ])
  if (code !== 0) throw new Error(`ffmpeg failed: ${stderr.slice(-200)}`)
  const buf = fs.readFileSync(tmp)
  fs.unlinkSync(tmp)
  // Wrap the underlying ArrayBuffer; the slice keeps alignment safe.
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
}

console.log(`audio:  ${INPUT}`)
console.log(`model:  ${MODEL}`)
console.log()

const ffmpegStart = Date.now()
const pcm = await audioToFloat32(INPUT)
const ffmpegMs = Date.now() - ffmpegStart
console.log(`ffmpeg → Float32  ${ffmpegMs}ms  (${(pcm.length / 16000).toFixed(2)}s of audio)`)

const loadStart = Date.now()
const whisper = new Whisper(MODEL, { gpu: true })
const loadMs = Date.now() - loadStart
console.log(`model load        ${loadMs}ms  (one-time; subsequent dictations skip this)`)

// Warm transcribe — this is what every dictation looks like.
console.log()
console.log('--- warm transcribes (5x) ---')
for (let i = 0; i < 5; i++) {
  const t = Date.now()
  const task = await whisper.transcribe(pcm, { language: 'auto' })
  const result = await task.result
  const ms = Date.now() - t
  const text = result.map(s => s.text).join('').trim()
  console.log(`run ${i+1}:  ${ms}ms  →  "${text}"`)
}

await whisper.free()
