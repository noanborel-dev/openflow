import { execFile } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execFile)

// Selection captured at hotkey-press time. This stays press-time on
// purpose: the user's *intent* (which text they want to rewrite) is
// fixed when they press the key. Focus could move during dictation,
// but the selection they meant to edit is the one that was active
// when they hit the hotkey.
//
// AX-role check for the paste destination is a separate concern —
// that one MUST run at release/paste time (see paste.ts) because the
// destination can change while the user is talking.
let cachedSelection: string = ''

const SELECTED_TEXT_SCRIPT = `
tell application "System Events"
  try
    set frontApp to first application process whose frontmost is true
    set focusedEl to value of attribute "AXFocusedUIElement" of frontApp
    return value of attribute "AXSelectedText" of focusedEl
  on error
    return ""
  end try
end tell
`

export async function captureSelectedText(): Promise<void> {
  cachedSelection = ''
  if (process.platform !== 'darwin') return
  try {
    const { stdout } = await exec('osascript', ['-e', SELECTED_TEXT_SCRIPT])
    cachedSelection = stdout.trim()
  } catch {
    /* keep default */
  }
}

export function getSelectedText(): string {
  return cachedSelection
}

export function clearSelectedText(): void {
  cachedSelection = ''
}
