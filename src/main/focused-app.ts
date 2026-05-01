import { execFile } from 'child_process'
import { promisify } from 'util'
import { APP_CATEGORY_MAP, BROWSER_BUNDLE_IDS, BROWSER_TITLE_ROUTES } from '../shared/constants'
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

// Fetch bundle ID, app name, AND the front window title — the title
// is what lets us tell Gmail-in-Chrome from Slack-in-Chrome. The title
// fetch is wrapped in try/end so apps that block window-name access
// don't fail the whole call.
const APPLESCRIPT = `
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set bundleId to bundle identifier of frontApp
  set appName to name of frontApp
  set windowTitle to ""
  try
    set windowTitle to name of front window of frontApp
  end try
  return bundleId & "|" & appName & "|" & windowTitle
end tell
`

// Apply browser-title routing: if the focused app is a browser, look
// at the window title to detect Gmail / Slack / Notion / etc. and
// override the category accordingly. Returns the original values when
// not a browser or no title pattern matched.
function resolveCategory(
  bundleId: string,
  appName: string,
  windowTitle: string
): { name: string; category: AppCategory } {
  if (BROWSER_BUNDLE_IDS.has(bundleId) && windowTitle) {
    for (const route of BROWSER_TITLE_ROUTES) {
      if (route.pattern.test(windowTitle)) {
        return { name: route.appName, category: route.category }
      }
    }
  }
  return { name: appName, category: APP_CATEGORY_MAP[bundleId] ?? 'other' }
}

// Async-fetch the frontmost app and stash it in the module cache. Call
// this when the user presses the hotkey; by the time recording ends and
// the pipeline runs, the cache is warm. Falls back to whatever was
// cached previously on error.
export async function captureFocusedApp(): Promise<void> {
  if (process.platform !== 'darwin') return
  try {
    const { stdout } = await exec('osascript', ['-e', APPLESCRIPT])
    const [bundleId, appName, windowTitle] = stdout.trim().split('|')
    const resolved = resolveCategory(bundleId, appName, windowTitle ?? '')
    cached = {
      bundleId,
      name: resolved.name,
      category: resolved.category,
    }
  } catch {
    // Keep stale cache rather than reset to 'unknown'.
  }
}

// Synchronous read of the cached frontmost app. Cheap.
export function getFocusedApp(): FocusedApp {
  return cached
}
