import { clipboard } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execFile)

const PASTE_APPLESCRIPT = `
tell application "System Events"
  keystroke "v" using command down
end tell
`

export async function pasteText(text: string): Promise<{ method: 'paste' | 'clipboard' }> {
  clipboard.writeText(text)

  if (process.platform === 'darwin') {
    try {
      await new Promise(r => setTimeout(r, 80))
      await exec('osascript', ['-e', PASTE_APPLESCRIPT])
      return { method: 'paste' }
    } catch {
      // Fall through to clipboard fallback
    }
  }

  return { method: 'clipboard' }
}
