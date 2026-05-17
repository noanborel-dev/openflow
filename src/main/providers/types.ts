import type { AppCategory } from '../../shared/types'

export interface TranscriptionProvider {
  name: string
  transcribe(
    audio: Buffer,
    options?: {
      language?: string
      dictionary?: string[]
      // Optional streaming callback fired with the partial transcript
      // as the provider decodes segments. Cloud providers may emit
      // this once at the end (no real streaming) or not at all;
      // callers must treat it as best-effort. The pipeline uses it
      // to update the indicator pill with running text on long local
      // dictations so the user sees words appearing before the final
      // result is ready.
      onPartial?: (text: string) => void
    }
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
