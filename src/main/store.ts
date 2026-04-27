import ElectronStore from 'electron-store'
import type { Settings } from '../shared/types'
import { DEFAULT_HOTKEYS, DEFAULT_DEV_MODE_APPS, MODELS } from '../shared/constants'

const defaults: Settings = {
  firstRun: true,
  provider: {
    provider: 'groq',
    groqKey: '',
    openaiKey: '',
    anthropicKey: '',
    transcriptionModel: MODELS.groq.transcription,
    cleanupModel: MODELS.groq.cleanup,
  },
  hotkeys: DEFAULT_HOTKEYS,
  perAppRules: [],
  devModeApps: DEFAULT_DEV_MODE_APPS,
  indicatorPosition: null,
  userDictionary: [],
}

export const store = new ElectronStore<Settings>({ defaults, name: 'openflow-settings' })

// Old default cleanup models that we now want to migrate off of for
// latency reasons. Any user whose persisted setting is in this list
// gets force-upgraded to the current MODELS.<provider>.cleanup default.
const STALE_CLEANUP_MODELS: Record<string, string> = {
  'llama-3.3-70b-versatile': MODELS.groq.cleanup,
}

export function getSettings(): Settings {
  // Backfill missing fields for users upgrading from older versions whose
  // persisted store predates these defaults.
  const raw = store.store as Settings
  const merged: Settings = {
    ...defaults,
    ...raw,
    hotkeys: { ...defaults.hotkeys, ...raw.hotkeys },
    provider: { ...defaults.provider, ...raw.provider },
  }

  // Migrate stale cleanup model. Persist the new value so the next
  // read sees it without re-running this branch.
  const persisted = merged.provider.cleanupModel
  const replacement = STALE_CLEANUP_MODELS[persisted]
  if (replacement) {
    merged.provider.cleanupModel = replacement
    store.set('provider', merged.provider)
  }

  return merged
}

export function setSettings(partial: Partial<Settings>): void {
  for (const [key, value] of Object.entries(partial)) {
    store.set(key, value)
  }
}
