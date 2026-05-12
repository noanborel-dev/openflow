import ElectronStore from 'electron-store'
import type { Settings, Strictness } from '../shared/types'
import { DEFAULT_HOTKEYS, DEFAULT_DEV_MODE_APPS, MODELS } from '../shared/constants'
import { DEFAULT_LOCAL_MODEL } from './local-models'

const defaults: Settings = {
  firstRun: true,
  provider: {
    provider: 'groq',
    groqKey: '',
    openaiKey: '',
    anthropicKey: '',
    transcriptionModel: MODELS.groq.transcription,
    cleanupModel: MODELS.groq.cleanup,
    localModel: DEFAULT_LOCAL_MODEL,
  },
  hotkeys: DEFAULT_HOTKEYS,
  perAppRules: [],
  devModeApps: DEFAULT_DEV_MODE_APPS,
  indicatorPosition: null,
  userDictionary: [],
  // Defaults reflect what most users actually want: personal stays
  // loose, work gets polished, writing leans balanced.
  strictness: {
    personal: 1,
    work: 3,
    writing: 2,
  },
  inputDeviceId: null,
  audioCues: true,
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
  // Strictness has gone through two prior shapes: a flat number, then
  // a 4-bucket object (messaging/email/docs/other). Migrate both into
  // the current 3-bucket shape (personal/work/writing).
  const persistedStrictness = (raw as unknown as { strictness?: unknown }).strictness
  const strictness: Settings['strictness'] = (() => {
    if (typeof persistedStrictness === 'number') {
      // Flat number: apply to all buckets.
      const lvl = persistedStrictness as Strictness
      return { personal: lvl, work: lvl, writing: lvl }
    }
    if (persistedStrictness && typeof persistedStrictness === 'object') {
      const p = persistedStrictness as Record<string, Strictness | undefined>
      // If the new keys exist, take them. Otherwise map old buckets:
      //   messaging → personal; email → work; docs → writing.
      return {
        personal: p.personal ?? p.messaging ?? defaults.strictness.personal,
        work: p.work ?? p.email ?? defaults.strictness.work,
        writing: p.writing ?? p.docs ?? defaults.strictness.writing,
      }
    }
    return defaults.strictness
  })()

  const merged: Settings = {
    ...defaults,
    ...raw,
    hotkeys: { ...defaults.hotkeys, ...raw.hotkeys },
    provider: { ...defaults.provider, ...raw.provider },
    strictness,
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
