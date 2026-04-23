import type { AppCategory } from '../../shared/types'

export interface TranscriptionProvider {
  name: string
  transcribe(
    audio: Buffer,
    options?: { language?: string; dictionary?: string[] }
  ): Promise<string>
}

export interface CleanupProvider {
  name: string
  cleanup(
    text: string,
    context: {
      appName: string
      appCategory: AppCategory
      systemPrompt: string
    }
  ): Promise<string>
}
