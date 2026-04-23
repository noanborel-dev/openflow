import type { AppCategory, Provider } from './types'

export const DEFAULT_HOTKEYS = {
  pushToTalk: 'Right Alt',
  commandMode: 'Command+Shift+Space',
  pasteLast: 'Command+Shift+V',
}

// Bundle ID → category (macOS)
export const APP_CATEGORY_MAP: Record<string, AppCategory> = {
  'com.tinyspeck.slackmacgap': 'messaging',
  'com.discord': 'messaging',
  'com.apple.MobileSMS': 'messaging',
  'ru.keepcoder.Telegram': 'messaging',
  'com.apple.mail': 'email',
  'com.microsoft.Outlook': 'email',
  'com.readdle.smartemail': 'email',
  'com.todesktop.230313mzl4w4u92': 'code', // Cursor
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
  'com.todesktop.230313mzl4w4u92', // Cursor
  'com.microsoft.VSCode',
  'dev.zed.zed',
  'com.apple.dt.Xcode',
  'com.apple.Terminal',
  'com.googlecode.iterm2',
]

export const MODELS: Record<Provider, { transcription: string; cleanup: string }> = {
  groq: {
    transcription: 'whisper-large-v3-turbo',
    cleanup: 'llama-3.3-70b-versatile',
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
