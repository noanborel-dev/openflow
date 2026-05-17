// A/B: Groq whisper-large-v3 vs whisper-large-v3-turbo
//
// Same audio, same client, same params. Measures end-to-end
// latency from sending the request to receiving the final
// transcript. Logs wall-clock time + transcribed text for
// accuracy spot-check.
//
// Cost note: turbo is $0.04/hr, v3 is $0.111/hr. ~64% cheaper.
// If turbo's transcript is functionally identical we should
// switch by default.
//
// Usage:
//   GROQ_API_KEY=gsk_... node scripts/bench-groq-whisper.mjs <audio.webm>
//
// Tip: re-run a few times because Groq cold-start vs warm-pool
// can affect single-call measurements.

import Groq, { toFile } from 'groq-sdk'
import fs from 'node:fs'

const key = process.env.GROQ_API_KEY
if (!key) {
  console.error('Set GROQ_API_KEY')
  process.exit(1)
}

const audioPath = process.argv[2]
if (!audioPath) {
  console.error('Usage: node bench-groq-whisper.mjs <audio.webm>')
  process.exit(1)
}

const audio = fs.readFileSync(audioPath)
const client = new Groq({ apiKey: key })

const MODELS = ['whisper-large-v3-turbo', 'whisper-large-v3']
const RUNS = 3

for (const model of MODELS) {
  console.log(`\n=== ${model} ===`)
  const times = []
  let lastText = ''
  for (let i = 0; i < RUNS; i++) {
    const file = await toFile(audio, 'audio.webm', { type: 'audio/webm' })
    const t = Date.now()
    const result = await client.audio.transcriptions.create({
      file,
      model,
      response_format: 'verbose_json',
      language: 'en',
    })
    const ms = Date.now() - t
    times.push(ms)
    lastText = result.text
  }
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
  console.log(`  runs: ${times.join('ms, ')}ms  (avg ${avg}ms)`)
  console.log(`  text: "${lastText.trim()}"`)
}
