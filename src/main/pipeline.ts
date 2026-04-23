import { buildCleanupPrompt } from '../shared/prompts'
import { MODELS } from '../shared/constants'
import type { DictationResult, Settings } from '../shared/types'
import type { TranscriptionProvider, CleanupProvider } from './providers/types'
import {
  createGroqTranscriptionProvider,
  createGroqCleanupProvider,
} from './providers/groq'
import {
  createOpenAITranscriptionProvider,
  createOpenAICleanupProvider,
} from './providers/openai'
import { createAnthropicCleanupProvider } from './providers/anthropic'
import { createLocalWhisperProvider } from './providers/local-whisper'
import { getFocusedApp } from './focused-app'
import { pasteText } from './paste'

// Null cleanup provider — used for local mode which skips LLM cleanup
const noopCleanup: CleanupProvider = {
  name: 'None',
  async cleanup(text) { return text },
}

function buildProviders(
  settings: Settings,
  onDownloadProgress?: (pct: number) => void
): { transcription: TranscriptionProvider; cleanup: CleanupProvider } {
  const { provider, groqKey, openaiKey, anthropicKey, transcriptionModel, cleanupModel } =
    settings.provider

  if (provider === 'groq') {
    return {
      transcription: createGroqTranscriptionProvider(groqKey, transcriptionModel),
      cleanup: createGroqCleanupProvider(groqKey, cleanupModel),
    }
  }

  if (provider === 'openai') {
    return {
      transcription: createOpenAITranscriptionProvider(openaiKey, transcriptionModel),
      cleanup: createOpenAICleanupProvider(openaiKey, cleanupModel),
    }
  }

  if (provider === 'local') {
    return {
      transcription: createLocalWhisperProvider(
        transcriptionModel || MODELS.local.transcription,
        onDownloadProgress
      ),
      cleanup: noopCleanup,
    }
  }

  // anthropic: use Groq for transcription
  return {
    transcription: createGroqTranscriptionProvider(groqKey, MODELS.groq.transcription),
    cleanup: createAnthropicCleanupProvider(anthropicKey, cleanupModel),
  }
}

export async function runDictationPipeline(
  audioBuffer: Buffer,
  settings: Settings,
  onState: (state: 'processing' | 'done' | 'error') => void,
  onDownloadProgress?: (pct: number) => void
): Promise<DictationResult & { pasteMethod: 'paste' | 'clipboard' }> {
  onState('processing')

  const focusedApp = await getFocusedApp()
  const { transcription, cleanup } = buildProviders(settings, onDownloadProgress)

  // Force 'code' category for dev-mode apps
  const category = settings.devModeApps.includes(focusedApp.bundleId)
    ? ('code' as const)
    : focusedApp.category

  // 1. Transcribe
  const transcript = await transcription.transcribe(audioBuffer, { dictionary: [] })

  // 2. For local mode, skip cleanup — paste raw transcript
  let cleaned = transcript
  if (settings.provider.provider !== 'local') {
    const rule = settings.perAppRules.find(r => r.bundleId === focusedApp.bundleId)
    const effectiveCategory = rule?.category ?? category
    const systemPrompt = buildCleanupPrompt(effectiveCategory, focusedApp.name, rule?.customPrompt)
      .replace('{text}', transcript)

    cleaned = await cleanup.cleanup(transcript, {
      appName: focusedApp.name,
      appCategory: effectiveCategory,
      systemPrompt,
    })
  }

  const effectiveCategory = settings.perAppRules.find(r => r.bundleId === focusedApp.bundleId)?.category ?? category

  // 3. Paste
  const { method: pasteMethod } = await pasteText(cleaned)

  onState('done')

  return {
    id: crypto.randomUUID(),
    transcript,
    cleaned,
    appName: focusedApp.name,
    appCategory: effectiveCategory,
    timestamp: Date.now(),
    pasteMethod,
  }
}

export async function runCommandPipeline(
  audioBuffer: Buffer,
  selectedText: string,
  settings: Settings
): Promise<string> {
  const { transcription, cleanup } = buildProviders(settings)
  const focusedApp = await getFocusedApp()

  // Transcribe the spoken command
  const command = await transcription.transcribe(audioBuffer, { dictionary: [] })

  const systemPrompt = `You are a text editing assistant. The user has selected the following text and dictated an editing command.

Selected text:
${selectedText}

Editing command: ${command}

Apply the command to the selected text and return ONLY the modified text, nothing else.`

  const result = await cleanup.cleanup(command, {
    appName: focusedApp.name,
    appCategory: focusedApp.category,
    systemPrompt,
  })

  return result
}
