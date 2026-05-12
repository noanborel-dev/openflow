import type { TranscriptionProvider } from './types'
import { whisperModelDownloaded, whisperModelPath } from '../local-models'

// Phase 1 skeleton. Phase 3 fills in the real ffmpeg + whisper-cli flow.
// We still surface a useful error when called early so a misconfigured
// run fails loudly instead of silently producing empty transcripts.
export class LocalModelMissingError extends Error {
  constructor() {
    super(
      'Local Whisper model is not downloaded yet. Open Settings → AI Provider → Local and click "Download model".'
    )
    this.name = 'LocalModelMissingError'
  }
}

export function createLocalWhisperProvider(): TranscriptionProvider {
  return {
    name: 'Local',
    async transcribe() {
      if (!whisperModelDownloaded()) throw new LocalModelMissingError()
      throw new Error(
        `Local Whisper transcription is not yet implemented (model present at ${whisperModelPath()}). Switch to Groq/OpenAI/Anthropic in Settings.`
      )
    },
  }
}

// Surfaced to the renderer via IPC so the Local provider card can render
// "✓ Ready" vs the download flow without re-implementing the check.
export function localWhisperReady(): boolean {
  return whisperModelDownloaded()
}
