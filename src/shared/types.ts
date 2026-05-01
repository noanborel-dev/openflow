export type AppCategory = 'messaging' | 'email' | 'code' | 'docs' | 'other'

export type DictationState = 'idle' | 'recording' | 'processing' | 'done' | 'error'

export type Provider = 'groq' | 'openai' | 'anthropic'

export interface ProviderSettings {
  provider: Provider
  groqKey: string
  openaiKey: string
  anthropicKey: string
  transcriptionModel: string
  cleanupModel: string
}

export interface HotkeySettings {
  pushToTalk: string   // single-key name matching node-global-key-listener (e.g. "CTRL").
                       // Behaviors on this one key:
                       //   tap        => toggle recording on (next tap stops)
                       //   hold       => record while held; release stops
                       //   double-tap => paste last transcription
}

export interface PerAppRule {
  bundleId: string     // e.g. "com.tinyspeck.slackmacgap"
  appName: string
  category: AppCategory
  customPrompt?: string
}

// Cleanup strictness chosen during onboarding. Acts as a global default
// that per-app biases (email +, iMessage -) shift up or down at prompt
// build time. 1 = light (only fillers stripped), 2 = balanced (filler +
// polish), 3 = strict (full restructure).
export type Strictness = 1 | 2 | 3

export interface Settings {
  firstRun: boolean
  provider: ProviderSettings
  hotkeys: HotkeySettings
  perAppRules: PerAppRule[]
  devModeApps: string[]   // bundle IDs that force dev/code mode
  indicatorPosition: { x: number; y: number } | null
  userDictionary: string[]   // user-added terms biased into Whisper transcription
  strictness: Strictness
  voiceEnrolled: boolean   // whether the user has completed voice enrollment
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
  REVEAL_LOG: 'reveal:log',
} as const
