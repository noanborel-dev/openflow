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

// Cleanup strictness per app category. 1 = light (only fillers stripped),
// 2 = balanced (filler + polish), 3 = strict (full restructure into clean
// prose). Asked per-use-case in onboarding because users want different
// polish for chat vs email vs docs — a single global default would push
// everyone to L3 even when they want their iMessages to stay loose.
// 'code' is intentionally not user-adjustable; it's always faithful so
// dictating commands / identifiers can't have words dropped.
export type Strictness = 1 | 2 | 3

// Three contextual buckets the user configures during onboarding. The
// runtime maps focused apps into these buckets: iMessage / WhatsApp →
// personal; Slack / Discord / Gmail / Outlook → work; Notion / Docs /
// Cursor / Claude / ChatGPT → writing. 'code' (Terminal, IDE editor
// view) bypasses strictness entirely — code is always faithful.
export interface CategoryStrictness {
  personal: Strictness   // casual chat with friends/family
  work: Strictness       // colleagues — chat AND email
  writing: Strictness    // longform docs + AI prompts
}

export interface Settings {
  firstRun: boolean
  provider: ProviderSettings
  hotkeys: HotkeySettings
  perAppRules: PerAppRule[]
  devModeApps: string[]   // bundle IDs that force dev/code mode
  indicatorPosition: { x: number; y: number } | null
  userDictionary: string[]   // user-added terms biased into Whisper transcription
  strictness: CategoryStrictness
  voiceEnrolled: boolean   // whether the user has completed voice enrollment
  inputDeviceId: string | null   // mic deviceId picked by the user; null = system default
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
  MIC_PERMISSION_STATUS: 'mic:permission:status',
  ACCESSIBILITY_OPEN: 'accessibility:open',
  ACCESSIBILITY_CHECK: 'accessibility:check',
  HOTKEYS_RELOAD: 'hotkeys:reload',
  REVEAL_LOG: 'reveal:log',
  LAUNCH_AT_LOGIN_GET: 'app:launch-at-login:get',
  LAUNCH_AT_LOGIN_SET: 'app:launch-at-login:set',
} as const
