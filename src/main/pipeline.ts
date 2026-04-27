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
import { NoSpeechError } from './errors'

// Whisper hallucinates these on silent / near-silent audio. If the
// transcript is exactly one of these (case-insensitive, trimmed of
// punctuation), treat it as no speech.
const HALLUCINATIONS = new Set([
  '',
  '.',
  '...',
  'thanks for watching',
  'thanks for watching!',
  'thank you',
  'thank you.',
  'thanks',
  'you',
  'bye',
  'bye.',
  'okay',
  'ok',
  'mm',
  'mhm',
  'uh',
  'um',
  '[blank_audio]',
  '[silence]',
  '[music]',
  '[no audio]',
])

function isLikelySilence(transcript: string): boolean {
  const cleaned = transcript.trim().toLowerCase().replace(/[.!?,]+$/g, '')
  if (cleaned.length === 0) return true
  if (HALLUCINATIONS.has(cleaned)) return true
  // Very short outputs (< 2 chars after trimming punctuation) are almost
  // always silence-induced. Real dictation is at least a word.
  if (cleaned.length < 2) return true
  return false
}

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
//
// NoSpeechError is treated as terminal — re-running the same audio
// always produces the same hallucination, so retry is wasted latency.
async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof NoSpeechError) throw err
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

// Heuristic: is the transcript clean enough to skip the LLM cleanup pass?
// Cleanup typically takes 300–500ms even on Llama 8B-instant, so dodging
// it for trivially-clean text is a big latency win. We're conservative:
// skip only when the text is short, has no filler-word markers, and no
// obvious self-correction language.
const FILLER_RE = /\b(um+|uh+|er+|hm+|like|you know|i mean|kind of|sort of)\b/i
const CORRECTION_RE = /\b(actually|wait|scratch that|nevermind|never mind|sorry,?\s+i mean|i mean,?)\b/i

function canSkipCleanup(transcript: string, category: 'messaging' | 'email' | 'code' | 'docs' | 'other'): boolean {
  // Code mode never skips — punctuation/formatting matters too much.
  if (category === 'code') return false
  // Long text often benefits from punctuation tightening; play safe.
  if (transcript.length > 80) return false
  if (FILLER_RE.test(transcript)) return false
  if (CORRECTION_RE.test(transcript)) return false
  return true
}

export async function runDictationPipeline(
  audioBuffer: Buffer,
  settings: Settings,
  onState: (state: 'processing' | 'done' | 'error') => void
): Promise<DictationResult & { pasteMethod: 'paste' | 'clipboard' }> {
  const start = Date.now()
  onState('processing')
  logInfo('Pipeline start', { audioBytes: audioBuffer.length, provider: settings.provider.provider })

  // Cheap synchronous read — cache populated when the hotkey fired.
  const focusedApp = getFocusedApp()
  logInfo('Focused app', { name: focusedApp.name, bundleId: focusedApp.bundleId })

  const { transcription, cleanup } = buildProviders(settings)

  const category = settings.devModeApps.includes(focusedApp.bundleId)
    ? ('code' as const)
    : focusedApp.category

  const dictionary = buildDictionary(settings)

  const tStart = Date.now()
  const transcript = (await withRetry('Transcription', () =>
    transcription.transcribe(audioBuffer, { dictionary }))).trim()
  logInfo('Transcribed', { ms: Date.now() - tStart, chars: transcript.length, preview: transcript.slice(0, 60) })

  // Bail out before cleanup + paste if Whisper returned nothing or a
  // known silence-hallucination. The indicator catches NoSpeechError
  // and shows a friendly "couldn't hear you" message.
  if (isLikelySilence(transcript)) {
    logInfo('No speech detected — skipping paste', { transcript })
    throw new NoSpeechError()
  }

  const rule = settings.perAppRules.find(r => r.bundleId === focusedApp.bundleId)
  const effectiveCategory = rule?.category ?? category

  // Fast path: short, clean text skips the LLM cleanup pass entirely.
  let cleaned = transcript
  if (canSkipCleanup(transcript, effectiveCategory)) {
    logInfo('Cleanup skipped (fast path)', { chars: transcript.length })
  } else {
    const systemPrompt = buildCleanupPrompt(effectiveCategory, focusedApp.name, rule?.customPrompt)
      .replace('{text}', transcript)
    const cStart = Date.now()
    cleaned = await withRetry('Cleanup', () =>
      cleanup.cleanup(transcript, {
        appName: focusedApp.name,
        appCategory: effectiveCategory,
        systemPrompt,
      }))
    logInfo('Cleaned', { ms: Date.now() - cStart, chars: cleaned.length })
  }

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
  const focusedApp = getFocusedApp()
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
