import Groq, { toFile } from 'groq-sdk'
import type { TranscriptionProvider, CleanupProvider } from './types'
import { NoSpeechError } from '../errors'
import { logInfo } from '../log'

// Cache the Groq SDK instance so the underlying HTTP agent (and its
// keep-alive connection pool) is reused across pipeline runs. Rebuilding
// per-call paid TLS handshake on every dictation. Keyed by API key so
// rotating the key triggers a fresh client.
let cachedClient: Groq | null = null
let cachedKey = ''
function getClient(apiKey: string): Groq {
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new Groq({ apiKey })
    cachedKey = apiKey
  }
  return cachedClient
}

// Whisper exposes three per-segment confidence signals when called with
// response_format='verbose_json'. We use them to detect hallucinations
// (Whisper outputting multilingual word-salad on near-silent audio).
// We check the *max* no_speech_prob and *min* avg_logprob across
// segments rather than averages — averages wash out a clearly-silent
// segment in the middle of a longer clip, letting the hallucination
// pass.
const NO_SPEECH_PROB_THRESHOLD = 0.55
const AVG_LOGPROB_THRESHOLD = -1.2
const COMPRESSION_RATIO_THRESHOLD = 2.4

interface VerboseSegment {
  avg_logprob?: number
  compression_ratio?: number
  no_speech_prob?: number
  text?: string
}
interface VerboseTranscription {
  text: string
  language?: string
  duration?: number
  segments?: VerboseSegment[]
}

export function createGroqTranscriptionProvider(
  apiKey: string,
  model: string
): TranscriptionProvider {
  return {
    name: 'Groq',
    async transcribe(audio, options = {}) {
      const client = getClient(apiKey)
      // toFile is the SDK's supported helper for Node Buffers; wrapping in
      // DOM File/Blob produced malformed multipart bodies that Groq rejected.
      const file = await toFile(audio, 'audio.webm', { type: 'audio/webm' })
      const dict = options.dictionary ?? []
      // Whisper's prompt has a 224-token cap; comma-separated terms is the
      // canonical way to bias the model toward specific spellings.
      const prompt = dict.length > 0 ? dict.join(', ') : undefined
      // verbose_json gives us per-segment confidence so we can reject
      // hallucinations. Plain 'json' returns only text.
      const raw = await client.audio.transcriptions.create({
        file,
        model,
        response_format: 'verbose_json',
        // Only set language when explicitly requested. Whisper auto-detects
        // per clip otherwise — important for users who dictate in multiple
        // languages (forcing 'en' produced phonetic garbage on Spanish).
        ...(options.language ? { language: options.language } : {}),
        ...(prompt ? { prompt } : {}),
      })
      const response = raw as unknown as VerboseTranscription

      const segs = response.segments ?? []
      if (segs.length > 0) {
        const maxNoSpeech = segs.reduce(
          (m, x) => Math.max(m, x.no_speech_prob ?? 0),
          0
        )
        const minLogprob = segs.reduce(
          (m, x) => Math.min(m, x.avg_logprob ?? 0),
          0
        )
        const maxCompression = segs.reduce(
          (m, x) => Math.max(m, x.compression_ratio ?? 0),
          0
        )

        const looksLikeHallucination =
          maxNoSpeech > NO_SPEECH_PROB_THRESHOLD ||
          minLogprob < AVG_LOGPROB_THRESHOLD ||
          maxCompression > COMPRESSION_RATIO_THRESHOLD

        if (looksLikeHallucination) {
          logInfo('Whisper hallucination rejected', {
            maxNoSpeech: Number(maxNoSpeech.toFixed(3)),
            minLogprob: Number(minLogprob.toFixed(3)),
            maxCompression: Number(maxCompression.toFixed(3)),
            language: response.language,
            preview: response.text.slice(0, 60),
          })
          throw new NoSpeechError()
        }
      }

      return response.text
    },
  }
}

export function createGroqCleanupProvider(
  apiKey: string,
  model: string
): CleanupProvider {
  return {
    name: 'Groq',
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

export async function testGroqKey(apiKey: string): Promise<void> {
  const client = getClient(apiKey)
  await client.models.list()
}

// Focused emoji-judge. Single laser-clear question: "should this
// casual message get an emoji, and which one?" Runs in PARALLEL
// with the main cleanup pass so the only added wall-clock cost is
// max(cleanupMs, judgeMs) - cleanupMs (typically ~0-50ms since the
// judge is much shorter than cleanup).
//
// Why separate from cleanup:
//   - llama-8b on a single mixed prompt ("clean up the text AND
//     decide on emoji") interprets the long "skip if X" emoji
//     guidance as "default-skip" — emojis fired ~5% of the time
//     in practice even on clearly-emoji-able messages.
//   - A focused prompt that ONLY asks the emoji question fires
//     emojis ~60% of the time on the right messages, ~0% on the
//     wrong ones. Smaller model, smaller prompt, sharper signal.
//
// Returns either an empty string (no emoji) or a single emoji
// character. Caller appends it to the cleaned text.
const EMOJI_JUDGE_SYSTEM = `You are an emoji judge for a casual messaging dictation app (iMessage, WhatsApp, Slack DMs). The user dictated a short message. Decide whether ONE emoji at the end would make the message feel more natural and human, like how friends actually text.

OUTPUT FORMAT: respond with EXACTLY one emoji character, OR the literal string "NONE". Nothing else. No punctuation, no explanation, no quotes.

WHEN TO ADD ONE (be GENEROUS — texting between friends usually has emoji):
- Food, drink, meals: 🍜 🍕 🍣 🍔 🌮 🍺 ☕ 🥗 🍰 🍦 🥐 🍳
- Plans / time / activities: 🎬 (movie) 🏃 (run) 🏋️ (gym) ⚽ 🎾 🏀 🎤 (event) 🛫 (trip) 🚗 (drive) 🏖️ (beach) 🌅 (early) 🌙 (night)
- Feelings / reactions: 😅 (awkward) 😂 (funny) ❤️ (love/care) 😍 (excited about something) 🥲 (sweet-sad) 😴 (tired) 🤔 (thinking) 😬 (yikes) 🙏 (thanks/please) 🥹 (touched)
- Celebrations / milestones: 🎉 🥳 🎂 🎁 🏆 ✨ (only for actual achievements, never filler)
- Apologies / care: 😔 💔 🫂
- Work / status: 💻 📝 🚀 (launch) 🔥 (urgent or impressive)
- Weather / vibes: ☀️ 🌧️ ❄️ 🌸

WHEN TO RESPOND "NONE":
- Pure transactional ("did you send the invoice", "what time")
- Requests / questions with no emotional weight ("can you check this", "do you have the link")
- One-word acknowledgments ("ok", "sure", "got it", "yeah")
- Technical / code-y content
- Already has an emoji in the message

EXAMPLES:
"let's grab ramen at 5" → 🍜
"happy birthday!!" → 🎉
"going for a run" → 🏃
"on my way" → 🚗
"i'm so sorry about that" → 😔
"got the job!!" → 🎉
"want to grab coffee tomorrow" → ☕
"running late, be there in 10" → 🏃
"long day, going to bed" → 😴
"thanks so much for your help" → 🙏
"that movie was wild" → 🎬
"can you send me the doc" → NONE
"what time is the meeting" → NONE
"ok sounds good" → NONE
"sure" → NONE
"i'll think about it" → NONE
"need to finish the report tonight" → 📝
"so excited for the trip!!" → 🛫
"feeling under the weather today" → 🤒

Remember: ONLY the emoji character or "NONE". No other output.`

// Regex to extract a single emoji-class codepoint from the model's
// response. We don't trust the model to output exactly one character —
// llama-8b sometimes prepends a "Sure: " or adds a period. Strip
// anything that isn't an emoji.
const EMOJI_PATTERN = /[\p{Extended_Pictographic}‍️]+/u

export async function judgeEmoji(
  apiKey: string,
  model: string,
  text: string,
): Promise<string> {
  // Bail out early for obviously-not-emoji messages. Avoids a network
  // call on every "ok" / "sure" / "yes".
  const trimmed = text.trim()
  if (trimmed.length < 6) return ''
  // If the message already contains an emoji, don't double-up.
  if (EMOJI_PATTERN.test(trimmed)) return ''

  const client = getClient(apiKey)
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: EMOJI_JUDGE_SYSTEM },
        { role: 'user', content: trimmed },
      ],
      // Low temperature for deterministic judgment, not creative
      // variety. Same message → same emoji choice across dictations.
      temperature: 0.2,
      // 4 tokens is enough for either an emoji (1-2 tokens) or "NONE"
      // (1 token). Capping prevents the model from rambling.
      max_tokens: 8,
    })
    const raw = response.choices[0]?.message?.content?.trim() ?? ''
    if (!raw || raw.toUpperCase().startsWith('NONE')) return ''
    const match = raw.match(EMOJI_PATTERN)
    return match ? match[0] : ''
  } catch {
    // Emoji is a nice-to-have; if the judge fails, return no emoji
    // rather than dropping the whole dictation.
    return ''
  }
}
