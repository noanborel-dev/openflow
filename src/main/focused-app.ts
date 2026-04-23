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

const APPLESCRIPT = `
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set bundleId to bundle identifier of frontApp
  set appName to name of frontApp
  return bundleId & "|" & appName
end tell
`

export async function getFocusedApp(): Promise<FocusedApp> {
  if (process.platform !== 'darwin') {
    return { bundleId: 'unknown', name: 'Unknown', category: 'other' }
  }
  try {
    const { stdout } = await exec('osascript', ['-e', APPLESCRIPT])
    const [bundleId, name] = stdout.trim().split('|')
    const category = APP_CATEGORY_MAP[bundleId] ?? 'other'
    return { bundleId, name, category }
  } catch {
    return { bundleId: 'unknown', name: 'Unknown', category: 'other' }
  }
}
