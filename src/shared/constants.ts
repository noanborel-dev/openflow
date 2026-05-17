import type { AppCategory, Provider } from './types'

// Default hotkey is any Ctrl key (LEFT or RIGHT). Matcher in hotkeys.ts accepts both.
export const DEFAULT_HOTKEYS = {
  pushToTalk: 'CTRL',
}

// Thresholds for hold-to-talk + double-tap interaction.
//
// dblTapWindowMs (500ms): natural double-clicks frequently span
//   350-450ms; a snappier window made paste-last feel broken.
// holdThresholdMs (150ms): release before this counts as a tap;
//   release after it counts as a hold-release (stop recording).
// startDelayMs (180ms): we DEFER firing fireStart() by this much
//   after DOWN so single tap vs double tap can be disambiguated
//   BEFORE the indicator pill flashes "listening." A real hold
//   feels instant — the user's still pressing when 180ms passes
//   and recording lights up. A double tap (second DOWN within
//   180ms of the first DOWN) cancels the deferred start: the
//   pill never lights up at all, paste-last fires cleanly. A
//   quick tap (release within 180ms) also fires fireStart at
//   release time, immediately entering tap-toggle mode.
export const HOTKEY_TIMING = {
  holdThresholdMs: 150,
  dblTapWindowMs: 500,
  startDelayMs: 180,
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
  'com.exafunction.windsurf': 'code',
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
  'com.exafunction.windsurf',
  'com.microsoft.VSCode',
  'dev.zed.zed',
  'com.apple.dt.Xcode',
  'com.apple.Terminal',
  'com.googlecode.iterm2',
]

// Browser bundle IDs — when the focused app is one of these, we look at
// the window title to detect web apps (Gmail in Chrome, Slack in Arc,
// Notion in Safari) so they get routed to the right cleanup category.
export const BROWSER_BUNDLE_IDS = new Set<string>([
  'com.google.Chrome',
  'com.google.Chrome.canary',
  'com.apple.Safari',
  'com.apple.SafariTechnologyPreview',
  'com.microsoft.edgemac',
  'org.mozilla.firefox',
  'company.thebrowser.Browser',  // Arc
  'com.brave.Browser',
  'com.vivaldi.Vivaldi',
  'com.operasoftware.Opera',
])

// Window-title routing for browser-based web apps. Order matters —
// first match wins. Patterns are intentionally lenient because browser
// title formatting varies ("Gmail" alone, "Inbox – Gmail", "(3) Inbox -
// user@gmail.com - Gmail"). Keep tokens specific enough to avoid false
// positives (e.g. "GitHub" stays out of email even though some pages
// say "user@github.com").
export interface BrowserTitleRoute {
  pattern: RegExp
  category: AppCategory
  appName: string
}

export const BROWSER_TITLE_ROUTES: BrowserTitleRoute[] = [
  // Email clients
  { pattern: /\bGmail\b/, category: 'email', appName: 'Gmail' },
  { pattern: /\bOutlook\b/i, category: 'email', appName: 'Outlook' },
  { pattern: /\bFastmail\b/i, category: 'email', appName: 'Fastmail' },
  { pattern: /\bProton ?Mail\b/i, category: 'email', appName: 'ProtonMail' },
  { pattern: /\bHEY\.com\b/i, category: 'email', appName: 'HEY' },
  // Team chat
  { pattern: /\bSlack\b/, category: 'messaging', appName: 'Slack' },
  { pattern: /\bDiscord\b/, category: 'messaging', appName: 'Discord' },
  { pattern: /\b(Microsoft Teams|MS Teams)\b/i, category: 'messaging', appName: 'Microsoft Teams' },
  { pattern: /\bWhatsApp\b/, category: 'messaging', appName: 'WhatsApp' },
  { pattern: /\bMessenger\b/, category: 'messaging', appName: 'Messenger' },
  // Docs / project mgmt
  { pattern: /\bGoogle Docs\b/, category: 'docs', appName: 'Google Docs' },
  { pattern: /\bNotion\b/, category: 'docs', appName: 'Notion' },
  { pattern: /\bConfluence\b/i, category: 'docs', appName: 'Confluence' },
  { pattern: /\bLinear\b/, category: 'docs', appName: 'Linear' },
  { pattern: /\bAsana\b/i, category: 'docs', appName: 'Asana' },
  { pattern: /\bClickUp\b/i, category: 'docs', appName: 'ClickUp' },
  { pattern: /\bMonday\.com\b/i, category: 'docs', appName: 'Monday' },
  { pattern: /\bCoda\b/, category: 'docs', appName: 'Coda' },
  // AI chat surfaces — treated as 'code' for now since dictation there
  // is usually prompts/instructions that benefit from list formatting
  // and tech-term preservation. Revisit when we add an 'ai_prompt' category.
  { pattern: /\bClaude\b/, category: 'code', appName: 'Claude' },
  { pattern: /\bChatGPT\b/, category: 'code', appName: 'ChatGPT' },
  { pattern: /\bGemini\b/, category: 'code', appName: 'Gemini' },
  { pattern: /\bPerplexity\b/i, category: 'code', appName: 'Perplexity' },
]

// IDEs with @-mention chip support in their AI chat panes. Used to
// switch the cleanup prompt into IDE-aware formatting mode (variable
// backticks + file tagging).
export type IdeEditor = 'cursor' | 'windsurf' | 'vscode'

export const IDE_EDITORS: Record<string, IdeEditor> = {
  'com.todesktop.230313mzl4w4u92': 'cursor',
  'com.exafunction.windsurf': 'windsurf',
  'com.microsoft.VSCode': 'vscode',
}

export const MODELS: Record<Provider, { transcription: string; cleanup: string }> = {
  groq: {
    // Non-turbo large-v3 — slower than turbo by ~30% but meaningfully
    // more accurate on noisy / accented audio. We accept the latency
    // hit for fewer mistranscriptions.
    transcription: 'whisper-large-v3',
    // 8B-instant runs roughly 3× faster than 70B-versatile on Groq;
    // for "remove fillers + fix capitalization" tasks the quality
    // delta is negligible while the latency win is large.
    cleanup: 'llama-3.1-8b-instant',
  },
  local: {
    // whisper.cpp model filename (without path). The model lives in
    // userData/models/ and is downloaded on demand — see
    // src/main/local-models.ts. Cleanup is delegated to whichever cloud
    // key the user has configured; local LLM cleanup is out of scope.
    transcription: 'ggml-large-v3-turbo-q5_0.bin',
    cleanup: '',
  },
}

export const HISTORY_LIMIT = 10

// Curated list of brand names and technical terms that Whisper commonly
// mistranscribes (e.g. "cloud" → "Claude", "open AI" → "OpenAI"). Passed
// as the transcription `prompt` so Whisper biases toward these spellings.
// Keep this short — Whisper's prompt has a 224-token cap.
export const BUILTIN_DICTIONARY: string[] = [
  // AI labs / products. Multi-word phrases bias Whisper toward the bigram,
  // which helps it pick "Claude Code" instead of "cloud code" etc.
  'Claude', 'Claude Code', 'Claude Sonnet', 'Claude Opus', 'Claude Haiku',
  'Anthropic', 'OpenAI', 'ChatGPT', 'GPT-4', 'GPT-5', 'Sonnet', 'Opus', 'Haiku',
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
