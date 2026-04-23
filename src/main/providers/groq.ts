import Groq from 'groq-sdk'
import type { TranscriptionProvider, CleanupProvider } from './types'

function bufferToFile(audio: Buffer, filename = 'audio.webm'): File {
  const blob = new Blob([audio], { type: 'audio/webm' })
  // Node 20's buffer.File and DOM File have mismatched declarations; the
  // Groq SDK accepts either at runtime, so cast through unknown.
  return new File([blob], filename, { type: 'audio/webm' }) as unknown as File
}

export function createGroqTranscriptionProvider(
  apiKey: string,
  model: string
): TranscriptionProvider {
  const client = new Groq({ apiKey })
  return {
    name: 'Groq',
    async transcribe(audio, options = {}) {
      const file = bufferToFile(audio)
      const response = await client.audio.transcriptions.create({
        file,
        model,
        language: options.language ?? 'en',
      })
      return response.text
    },
  }
}

export function createGroqCleanupProvider(
  apiKey: string,
  model: string
): CleanupProvider {
  const client = new Groq({ apiKey })
  return {
    name: 'Groq',
    async cleanup(text, { systemPrompt }) {
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
  const client = new Groq({ apiKey })
  await client.models.list()
}
