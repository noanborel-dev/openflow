export type UserError = {
  code: 'NO_KEY' | 'NETWORK' | 'AUTH' | 'TRANSCRIBE_FAILED' | 'NO_SPEECH'
  userMessage: string
}

// Sentinel error thrown by the pipeline when Whisper returns an empty
// (or near-empty / hallucinated) transcript. Caught by the indicator
// flow so we surface a friendly message instead of pasting nothing.
export class NoSpeechError extends Error {
  constructor() {
    super('No speech detected')
    this.name = 'NoSpeechError'
  }
}

const NETWORK_HINTS = ['fetch failed', 'ENOTFOUND', 'ECONNREFUSED', 'getaddrinfo', 'ETIMEDOUT']
const AUTH_HINTS = ['401', 'Invalid API Key', 'invalid_api_key', 'Incorrect API key']

export function toUserError(err: unknown): UserError {
  if (err instanceof NoSpeechError) {
    return { code: 'NO_SPEECH', userMessage: "couldn't hear you — try again" }
  }
  const raw = err instanceof Error ? err.message : String(err)

  if (!raw || raw.toLowerCase().includes('no api key')) {
    return { code: 'NO_KEY', userMessage: 'Add your Groq key in Settings.' }
  }
  if (NETWORK_HINTS.some(h => raw.includes(h))) {
    return { code: 'NETWORK', userMessage: "Couldn't reach Groq. Check your connection." }
  }
  if (AUTH_HINTS.some(h => raw.includes(h))) {
    return { code: 'AUTH', userMessage: 'Groq key rejected. Update it in Settings.' }
  }
  return { code: 'TRANSCRIBE_FAILED', userMessage: 'Transcription failed — try again.' }
}
