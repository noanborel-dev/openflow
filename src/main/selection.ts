import { execFile } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execFile)

// Module-level cache populated by captureSelectedText() at hotkey press
// time. AUDIO_DONE reads it synchronously to decide whether the user is
// dictating-into-a-field (normal mode) or editing-a-selection
// (command mode).
let cached: string = ''

// AXSelectedText returns whatever text is currently selected inside the
// frontmost app's focused UI element. Empty string when nothing is
// selected, when the focused element doesn't expose the attribute, or
// when AX permission has been denied — all of which are correctly
// interpreted as "not command mode" downstream.
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
  // Reset eagerly so a stale value from the previous session can never
  // trigger command mode if this osascript call fails or is slow.
  cached = ''
  if (process.platform !== 'darwin') return
  try {
    const { stdout } = await exec('osascript', ['-e', SELECTED_TEXT_SCRIPT])
    cached = stdout.trim()
  } catch {
    cached = ''
  }
}

// Synchronous read of the captured selection. Cheap.
export function getSelectedText(): string {
  return cached
}

// Clear the cache after the pipeline has consumed it, so a subsequent
// dictation without a selection definitively reads empty.
export function clearSelectedText(): void {
  cached = ''
}
