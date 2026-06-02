import ElectronStore from 'electron-store'
import type { DictationResult } from '../shared/types'

// Persistent history. The in-memory list in ipc.ts is kept at 10
// entries for quick paste-last access; this store keeps the last 50
// across app restarts so the Settings → Dashboard has recent activity
// to show. Capped at 50 deliberately — user can search their last 50
// dictations, anything older isn't useful for quick re-copy and would
// bloat the privacy surface (everything you've ever said sitting in
// userData/). 50 entries ≈ 15KB of JSON on disk.
const HISTORY_PERSIST_LIMIT = 50

interface HistoryStoreShape {
  history: DictationResult[]
}

const store = new ElectronStore<HistoryStoreShape>({
  name: 'yappr-history',
  defaults: { history: [] },
})

export function loadPersistedHistory(): DictationResult[] {
  return store.get('history', [])
}

export function persistHistoryEntry(entry: DictationResult): void {
  const current = store.get('history', [])
  current.unshift(entry)
  if (current.length > HISTORY_PERSIST_LIMIT) current.length = HISTORY_PERSIST_LIMIT
  store.set('history', current)
}

export function clearPersistedHistory(): void {
  store.set('history', [])
}
