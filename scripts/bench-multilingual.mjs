// Compare English-only vs multilingual variants at small size.
// Same architecture, same speed expected — quality difference is
// what matters for the "do we need .en or can we use multilingual"
// decision.

import { initWhisper, toggleNativeLog } from '@fugood/whisper.node'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

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

async function audioToPcm16(input) {
  const tmp = path.join(os.tmpdir(), `bench-${crypto.randomUUID()}.raw`)
  const ffmpegStatic = (await import('ffmpeg-static')).default
  const { code, stderr } = await runProc(ffmpegStatic, [
    '-y', '-i', input,
    '-ar', '16000', '-ac', '1',
    '-f', 's16le', '-acodec', 'pcm_s16le', tmp,
  ])
  if (code !== 0) throw new Error(`ffmpeg failed: ${stderr.slice(-200)}`)
  const buf = fs.readFileSync(tmp)
  fs.unlinkSync(tmp)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

await toggleNativeLog(false)

const models = [
  { name: 'small.en-q5_1', path: '/tmp/whisper-models/small.en-q5_1.bin' },
  { name: 'small-q5_1 (multilingual)', path: '/tmp/whisper-models/small-q5_1.bin' },
]
const clips = [
  { name: 'brand-heavy English', path: '/tmp/test-brand2.webm' },
  { name: 'multilingual ES/FR/EN', path: '/tmp/test-multi.webm' },
]

for (const m of models) {
  console.log(`\n=== ${m.name} ===`)
  const ctx = await initWhisper({ filePath: m.path, useGpu: true, useFlashAttn: true })
  for (const clip of clips) {
    const pcm = await audioToPcm16(clip.path)
    // Use auto for multilingual model, en for .en model
    const language = m.name.endsWith('.en-q5_1') ? 'en' : 'auto'
    // Warm-up
    await ctx.transcribeData(pcm, { language, beamSize: 1, bestOf: 1, temperature: 0, maxThreads: 4 }).promise
    // Real run
    const t = Date.now()
    const r = await ctx.transcribeData(pcm, { language, beamSize: 1, bestOf: 1, temperature: 0, maxThreads: 4 }).promise
    const ms = Date.now() - t
    console.log(`  [${clip.name}] ${ms}ms (${(pcm.byteLength / 2 / 16000).toFixed(2)}s)`)
    console.log(`    → "${r.result.trim()}"`)
  }
  await ctx.release()
}
