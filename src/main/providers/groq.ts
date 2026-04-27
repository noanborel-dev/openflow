import Groq, { toFile } from 'groq-sdk'
import type { TranscriptionProvider, CleanupProvider } from './types'
import { NoSpeechError } from '../errors'
import { logInfo } from '../log'

// Cache the Groq SDK instance so the underlying HTTP agent (and its
// keep-alive connection pool) is reused across pipeline runs. Rebuilding
// per-call paid TLS handshake on every dictation. Keyed by API key so
// rotating the key triggers a fresh client.
let cachedClient: Groq | null = null
let cachedKey = ''
function getClient(apiKey: string): Groq {
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new Groq({ apiKey })
    cachedKey = apiKey
  }
  return cachedClient
}

// Whisper exposes three per-segment confidence signals when called with
// response_format='verbose_json'. We use them to detect hallucinations
// (Whisper outputting multilingual word-salad on near-silent audio).
// We check the *max* no_speech_prob and *min* avg_logprob across
// segments rather than averages — averages wash out a clearly-silent
// segment in the middle of a longer clip, letting the hallucination
// pass.
const NO_SPEECH_PROB_THRESHOLD = 0.55
const AVG_LOGPROB_THRESHOLD = -1.2
const COMPRESSION_RATIO_THRESHOLD = 2.4

interface VerboseSegment {
  avg_logprob?: number
  compression_ratio?: number
  no_speech_prob?: number
  text?: string
}
interface VerboseTranscription {
  text: string
  language?: string
  duration?: number
  segments?: VerboseSegment[]
}

export function createGroqTranscriptionProvider(
  apiKey: string,
  model: string
): TranscriptionProvider {
  return {
    name: 'Groq',
    async transcribe(audio, options = {}) {
      const client = getClient(apiKey)
      // toFile is the SDK's supported helper for Node Buffers; wrapping in
      // DOM File/Blob produced malformed multipart bodies that Groq rejected.
      const file = await toFile(audio, 'audio.webm', { type: 'audio/webm' })
      const dict = options.dictionary ?? []
      // Whisper's prompt has a 224-token cap; comma-separated terms is the
      // canonical way to bias the model toward specific spellings.
      const prompt = dict.length > 0 ? dict.join(', ') : undefined
      // verbose_json gives us per-segment confidence so we can reject
      // hallucinations. Plain 'json' returns only text.
      const raw = await client.audio.transcriptions.create({
        file,
        model,
        response_format: 'verbose_json',
        // Only set language when explicitly requested. Whisper auto-detects
        // per clip otherwise — important for users who dictate in multiple
        // languages (forcing 'en' produced phonetic garbage on Spanish).
        ...(options.language ? { language: options.language } : {}),
        ...(prompt ? { prompt } : {}),
      })
      const response = raw as unknown as VerboseTranscription

      const segs = response.segments ?? []
      if (segs.length > 0) {
        const maxNoSpeech = segs.reduce(
          (m, x) => Math.max(m, x.no_speech_prob ?? 0),
          0
        )
        const minLogprob = segs.reduce(
          (m, x) => Math.min(m, x.avg_logprob ?? 0),
          0
        )
        const maxCompression = segs.reduce(
          (m, x) => Math.max(m, x.compression_ratio ?? 0),
          0
        )

        const looksLikeHallucination =
          maxNoSpeech > NO_SPEECH_PROB_THRESHOLD ||
          minLogprob < AVG_LOGPROB_THRESHOLD ||
          maxCompression > COMPRESSION_RATIO_THRESHOLD

        if (looksLikeHallucination) {
          logInfo('Whisper hallucination rejected', {
            maxNoSpeech: Number(maxNoSpeech.toFixed(3)),
            minLogprob: Number(minLogprob.toFixed(3)),
            maxCompression: Number(maxCompression.toFixed(3)),
            language: response.language,
            preview: response.text.slice(0, 60),
          })
          throw new NoSpeechError()
        }
      }

      return response.text
    },
  }
}

export function createGroqCleanupProvider(
  apiKey: string,
  model: string
): CleanupProvider {
  return {
    name: 'Groq',
    async cleanup(text, { systemPrompt }) {
      const client = getClient(apiKey)
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      })
      return response.choices[0]?.message?.content?.trim() ?? text
    },
  }
}

export async function testGroqKey(apiKey: string): Promise<void> {
  const client = getClient(apiKey)
  await client.models.list()
}
