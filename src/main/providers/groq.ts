import Groq, { toFile } from 'groq-sdk'
import type { TranscriptionProvider, CleanupProvider } from './types'

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
      const response = await client.audio.transcriptions.create({
        file,
        model,
        language: options.language ?? 'en',
        ...(prompt ? { prompt } : {}),
      })
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
