import Anthropic from '@anthropic-ai/sdk'
import type { CleanupProvider } from './types'

// Anthropic has no transcription model.
// Callers must pair with Groq or OpenAI for transcription.

export function createAnthropicCleanupProvider(
  apiKey: string,
  model: string
): CleanupProvider {
  const client = new Anthropic({ apiKey })
  return {
    name: 'Anthropic',
    async cleanup(text, { systemPrompt }) {
      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }],
      })
      const block = response.content[0]
      return block.type === 'text' ? block.text.trim() : text
    },
  }
}

export async function testAnthropicKey(apiKey: string): Promise<void> {
  const client = new Anthropic({ apiKey })
  await client.models.list()
}
