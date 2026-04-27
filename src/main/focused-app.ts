import { execFile } from 'child_process'
import { promisify } from 'util'
import { APP_CATEGORY_MAP } from '../shared/constants'
import type { AppCategory } from '../shared/types'

const exec = promisify(execFile)

export interface FocusedApp {
  bundleId: string
  name: string
  category: AppCategory
}

// Module-level cache populated by captureFocusedApp(). The full
// pipeline reads this synchronously, avoiding the ~500ms osascript
// round-trip on the hot path.
let cached: FocusedApp = { bundleId: 'unknown', name: 'Unknown', category: 'other' }

const APPLESCRIPT = `
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set bundleId to bundle identifier of frontApp
  set appName to name of frontApp
  return bundleId & "|" & appName
end tell
`

// Async-fetch the frontmost app and stash it in the module cache. Call
// this when the user presses the hotkey; by the time recording ends and
// the pipeline runs, the cache is warm. Falls back to whatever was
// cached previously on error.
export async function captureFocusedApp(): Promise<void> {
  if (process.platform !== 'darwin') return
  try {
    const { stdout } = await exec('osascript', ['-e', APPLESCRIPT])
    const [bundleId, name] = stdout.trim().split('|')
    cached = {
      bundleId,
      name,
      category: APP_CATEGORY_MAP[bundleId] ?? 'other',
    }
  } catch {
    // Keep stale cache rather than reset to 'unknown'.
  }
}

// Synchronous read of the cached frontmost app. Cheap.
export function getFocusedApp(): FocusedApp {
  return cached
}
