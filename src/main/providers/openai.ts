import OpenAI, { toFile } from 'openai'
import type { TranscriptionProvider, CleanupProvider } from './types'
import { NoSpeechError } from '../errors'
import { logInfo } from '../log'

let cachedClient: OpenAI | null = null
let cachedKey = ''
function getClient(apiKey: string): OpenAI {
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new OpenAI({ apiKey })
    cachedKey = apiKey
  }
  return cachedClient
}

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

export function createOpenAITranscriptionProvider(
  apiKey: string,
  model: string
): TranscriptionProvider {
  return {
    name: 'OpenAI',
    async transcribe(audio, options = {}) {
      const client = getClient(apiKey)
      const file = await toFile(audio, 'audio.webm', { type: 'audio/webm' })
      const dict = options.dictionary ?? []
      const prompt = dict.length > 0 ? dict.join(', ') : undefined
      const raw = await client.audio.transcriptions.create({
        file,
        model,
        response_format: 'verbose_json',
        // Greedy decoding — deterministic, fewer creative hallucinations
        // on borderline clips. See providers/groq.ts for rationale.
        temperature: 0,
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
        if (
          maxNoSpeech > NO_SPEECH_PROB_THRESHOLD ||
          minLogprob < AVG_LOGPROB_THRESHOLD ||
          maxCompression > COMPRESSION_RATIO_THRESHOLD
        ) {
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

export function createOpenAICleanupProvider(
  apiKey: string,
  model: string
): CleanupProvider {
  return {
    name: 'OpenAI',
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

export async function testOpenAIKey(apiKey: string): Promise<void> {
  const client = getClient(apiKey)
  await client.models.list()
}
