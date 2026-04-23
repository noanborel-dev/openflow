export type AppCategory = 'messaging' | 'email' | 'code' | 'docs' | 'other'

export type DictationState = 'idle' | 'recording' | 'processing' | 'done' | 'error'

export type Provider = 'groq' | 'openai' | 'anthropic' | 'local'

export interface ProviderSettings {
  provider: Provider
  groqKey: string
  openaiKey: string
  anthropicKey: string
  transcriptionModel: string
  cleanupModel: string
}

export interface HotkeySettings {
  pushToTalk: string   // e.g. "Right Alt"
  commandMode: string  // e.g. "Command+Shift+Space"
  pasteLast: string    // e.g. "Command+Shift+V"
}

export interface PerAppRule {
  bundleId: string     // e.g. "com.tinyspeck.slackmacgap"
  appName: string
  category: AppCategory
  customPrompt?: string
}

export interface Settings {
  firstRun: boolean
  provider: ProviderSettings
  hotkeys: HotkeySettings
  perAppRules: PerAppRule[]
  devModeApps: string[]   // bundle IDs that force dev/code mode
  indicatorPosition: { x: number; y: number } | null
}

export interface DictationResult {
  id: string
  transcript: string
  cleaned: string
  appName: string
  appCategory: AppCategory
  timestamp: number
}

// IPC channel names — kept in shared so renderer and main stay in sync
export const IPC = {
  STATE_CHANGE: 'state-change',
  AUDIO_CHUNK: 'audio-chunk',
  AUDIO_DONE: 'audio-done',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  PROVIDER_TEST: 'provider:test',
  HISTORY_GET: 'history:get',
  PASTE_LAST: 'paste:last',
  OPEN_SETTINGS: 'open-settings',
  OPEN_ONBOARDING: 'open-onboarding',
  MIC_PERMISSION: 'mic:permission',
  ACCESSIBILITY_OPEN: 'accessibility:open',
  HOTKEYS_RELOAD: 'hotkeys:reload',
} as const
