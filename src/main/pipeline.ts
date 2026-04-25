import { buildCleanupPrompt } from '../shared/prompts'
import { MODELS, BUILTIN_DICTIONARY } from '../shared/constants'
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
import { getFocusedApp } from './focused-app'
import { pasteText } from './paste'
import { logInfo, logError } from './log'

function buildProviders(
  settings: Settings
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

  // anthropic: use Groq for transcription, Anthropic for cleanup
  return {
    transcription: createGroqTranscriptionProvider(groqKey, MODELS.groq.transcription),
    cleanup: createAnthropicCleanupProvider(anthropicKey, cleanupModel),
  }
}

// Run the given async fn; if it rejects, retry once after a short delay.
// Used for transcription + cleanup since both are network calls that can
// transiently fail (cold-start timeouts, dropped connections).
async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    logError(`${label} failed (attempt 1) — retrying`, err)
    await new Promise(r => setTimeout(r, 250))
    try {
      return await fn()
    } catch (err2) {
      logError(`${label} failed (attempt 2) — giving up`, err2)
      throw err2
    }
  }
}

function buildDictionary(settings: Settings): string[] {
  const user = settings.userDictionary ?? []
  // Lowercased de-dup so the same term in different cases doesn't repeat.
  const seen = new Set<string>()
  const out: string[] = []
  for (const term of [...BUILTIN_DICTIONARY, ...user]) {
    const k = term.trim().toLowerCase()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(term.trim())
  }
  return out
}

export async function runDictationPipeline(
  audioBuffer: Buffer,
  settings: Settings,
  onState: (state: 'processing' | 'done' | 'error') => void
): Promise<DictationResult & { pasteMethod: 'paste' | 'clipboard' }> {
  const start = Date.now()
  onState('processing')
  logInfo('Pipeline start', { audioBytes: audioBuffer.length, provider: settings.provider.provider })

  const focusedApp = await getFocusedApp()
  logInfo('Focused app', { name: focusedApp.name, bundleId: focusedApp.bundleId })

  const { transcription, cleanup } = buildProviders(settings)

  const category = settings.devModeApps.includes(focusedApp.bundleId)
    ? ('code' as const)
    : focusedApp.category

  const dictionary = buildDictionary(settings)

  const tStart = Date.now()
  const transcript = await withRetry('Transcription', () =>
    transcription.transcribe(audioBuffer, { dictionary }))
  logInfo('Transcribed', { ms: Date.now() - tStart, chars: transcript.length })

  const rule = settings.perAppRules.find(r => r.bundleId === focusedApp.bundleId)
  const effectiveCategory = rule?.category ?? category
  const systemPrompt = buildCleanupPrompt(effectiveCategory, focusedApp.name, rule?.customPrompt)
    .replace('{text}', transcript)

  const cStart = Date.now()
  const cleaned = await withRetry('Cleanup', () =>
    cleanup.cleanup(transcript, {
      appName: focusedApp.name,
      appCategory: effectiveCategory,
      systemPrompt,
    }))
  logInfo('Cleaned', { ms: Date.now() - cStart, chars: cleaned.length })

  const { method: pasteMethod } = await pasteText(cleaned)
  logInfo('Pasted', { method: pasteMethod, totalMs: Date.now() - start })

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
  const dictionary = buildDictionary(settings)

  const command = await withRetry('Transcription', () =>
    transcription.transcribe(audioBuffer, { dictionary }))

  const systemPrompt = `You are a text editing assistant. The user has selected the following text and dictated an editing command.

Selected text:
${selectedText}

Editing command: ${command}

Apply the command to the selected text and return ONLY the modified text, nothing else.`

  const result = await withRetry('Cleanup', () =>
    cleanup.cleanup(command, {
      appName: focusedApp.name,
      appCategory: focusedApp.category,
      systemPrompt,
    }))

  return result
}
