import type { AppCategory, Provider } from './types'

// Default hotkey is any Ctrl key (LEFT or RIGHT). Matcher in hotkeys.ts accepts both.
export const DEFAULT_HOTKEYS = {
  pushToTalk: 'CTRL',
}

// Thresholds for hold-to-talk + double-tap-lock interaction.
export const HOTKEY_TIMING = {
  holdThresholdMs: 150,
  dblTapWindowMs: 350,
}

export const APP_CATEGORY_MAP: Record<string, AppCategory> = {
  'com.tinyspeck.slackmacgap': 'messaging',
  'com.discord': 'messaging',
  'com.apple.MobileSMS': 'messaging',
  'ru.keepcoder.Telegram': 'messaging',
  'com.apple.mail': 'email',
  'com.microsoft.Outlook': 'email',
  'com.readdle.smartemail': 'email',
  'com.todesktop.230313mzl4w4u92': 'code',
  'com.microsoft.VSCode': 'code',
  'dev.zed.zed': 'code',
  'com.apple.dt.Xcode': 'code',
  'com.apple.Terminal': 'code',
  'com.googlecode.iterm2': 'code',
  'notion.id': 'docs',
  'md.obsidian': 'docs',
  'com.microsoft.Word': 'docs',
  'com.apple.iWork.Pages': 'docs',
}

export const DEFAULT_DEV_MODE_APPS = [
  'com.todesktop.230313mzl4w4u92',
  'com.microsoft.VSCode',
  'dev.zed.zed',
  'com.apple.dt.Xcode',
  'com.apple.Terminal',
  'com.googlecode.iterm2',
]

export const MODELS: Record<Provider, { transcription: string; cleanup: string }> = {
  groq: {
    transcription: 'whisper-large-v3-turbo',
    // 8B-instant runs roughly 3× faster than 70B-versatile on Groq;
    // for "remove fillers + fix capitalization" tasks the quality
    // delta is negligible while the latency win is large.
    cleanup: 'llama-3.1-8b-instant',
  },
  openai: {
    transcription: 'whisper-1',
    cleanup: 'gpt-4o-mini',
  },
  anthropic: {
    // No Anthropic transcription model — callers use Groq for transcription
    transcription: 'whisper-large-v3-turbo',
    cleanup: 'claude-3-haiku-20240307',
  },
}

export const HISTORY_LIMIT = 10

// Curated list of brand names and technical terms that Whisper commonly
// mistranscribes (e.g. "cloud" → "Claude", "open AI" → "OpenAI"). Passed
// as the transcription `prompt` so Whisper biases toward these spellings.
// Keep this short — Whisper's prompt has a 224-token cap.
export const BUILTIN_DICTIONARY: string[] = [
  // AI labs / products
  'Claude', 'Anthropic', 'OpenAI', 'ChatGPT', 'GPT-4', 'GPT-5', 'Sonnet', 'Opus', 'Haiku',
  'Gemini', 'Llama', 'Mistral', 'DeepSeek', 'Grok', 'Perplexity', 'Cursor', 'Copilot',
  'Whisper', 'Groq', 'Hugging Face', 'LangChain',
  // Dev tools
  'TypeScript', 'JavaScript', 'Python', 'Rust', 'Go', 'Swift', 'Kotlin',
  'React', 'Vue', 'Svelte', 'Next.js', 'Vite', 'Tailwind', 'Prisma', 'tRPC',
  'Node.js', 'Deno', 'Bun', 'pnpm', 'Yarn', 'Vercel', 'Netlify', 'Cloudflare',
  'Supabase', 'Firebase', 'PostgreSQL', 'MongoDB', 'Redis', 'SQLite',
  'GitHub', 'GitLab', 'Bitbucket', 'Linear', 'Notion', 'Figma',
  'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'S3', 'EC2', 'Lambda',
  'VS Code', 'JetBrains', 'WebStorm', 'IntelliJ', 'Xcode', 'Zed',
  // Common acronyms Whisper confuses
  'API', 'SDK', 'CLI', 'CRUD', 'REST', 'GraphQL', 'JSON', 'YAML', 'OAuth', 'JWT',
  'SSH', 'HTTPS', 'WebSocket', 'tRPC', 'CORS', 'CDN', 'DNS',
  // Apple ecosystem
  'macOS', 'iOS', 'iPadOS', 'tvOS', 'watchOS', 'visionOS', 'SwiftUI', 'AppKit', 'UIKit',
  'TestFlight', 'Xcode', 'Apple Silicon', 'M1', 'M2', 'M3', 'M4',
]
