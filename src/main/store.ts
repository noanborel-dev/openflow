import ElectronStore from 'electron-store'
import type { Settings } from '../shared/types'
import { DEFAULT_HOTKEYS, DEFAULT_DEV_MODE_APPS } from '../shared/constants'

const defaults: Settings = {
  firstRun: true,
  provider: {
    provider: 'groq',
    groqKey: '',
    openaiKey: '',
    anthropicKey: '',
    transcriptionModel: 'whisper-large-v3-turbo',
    cleanupModel: 'llama-3.3-70b-versatile',
  },
  hotkeys: DEFAULT_HOTKEYS,
  perAppRules: [],
  devModeApps: DEFAULT_DEV_MODE_APPS,
  indicatorPosition: null,
}

export const store = new ElectronStore<Settings>({ defaults, name: 'openflow-settings' })

export function getSettings(): Settings {
  return store.store as Settings
}

export function setSettings(partial: Partial<Settings>): void {
  for (const [key, value] of Object.entries(partial)) {
    store.set(key, value)
  }
}
