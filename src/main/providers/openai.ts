import OpenAI, { toFile } from 'openai'
import type { TranscriptionProvider, CleanupProvider } from './types'

let cachedClient: OpenAI | null = null
let cachedKey = ''
function getClient(apiKey: string): OpenAI {
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new OpenAI({ apiKey })
    cachedKey = apiKey
  }
  return cachedClient
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
