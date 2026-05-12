import { execFile } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execFile)

// Module-level cache populated by captureFocusedContext() at hotkey
// press time. AUDIO_DONE + the paste pre-check read these synchronously,
// so by the time we're ready to paste there's no osascript on the hot
// path — the call already finished while the user was still speaking.
let cachedSelection: string = ''
let cachedAXRole: string = 'script-error'

// Single osascript that captures both the AX role of the focused
// element AND any selected text inside it. Querying both attributes
// off the same focused element in one round-trip is ~2× faster than
// two separate osascript spawns.
//
// Returns "<role>\x1F<selection>" using ASCII Unit Separator (0x1F)
// because it can't appear in normal text. Role is "no-focus" when
// the frontmost app has no focused element, "script-error" when the
// AppleScript itself fails (e.g. AX permission denied).
const CONTEXT_SCRIPT = `
tell application "System Events"
  try
    set frontApp to first application process whose frontmost is true
    try
      set focusedEl to value of attribute "AXFocusedUIElement" of frontApp
      set roleStr to value of attribute "AXRole" of focusedEl
      try
        set selText to value of attribute "AXSelectedText" of focusedEl
      on error
        set selText to ""
      end try
      return roleStr & character id 31 & selText
    on error
      return "no-focus" & character id 31 & ""
    end try
  on error
    return "script-error" & character id 31 & ""
  end try
end tell
`

export async function captureFocusedContext(): Promise<void> {
  // Reset eagerly so a stale value from the previous session can never
  // leak into the next pipeline if this osascript fails or is slow.
  cachedSelection = ''
  cachedAXRole = 'script-error'
  if (process.platform !== 'darwin') return
  try {
    const { stdout } = await exec('osascript', ['-e', CONTEXT_SCRIPT])
    const [role, ...rest] = stdout.split('\x1F')
    cachedAXRole = role.trim() || 'script-error'
    cachedSelection = rest.join('\x1F').trim()
  } catch {
    /* keep defaults */
  }
}

export function getSelectedText(): string {
  return cachedSelection
}

export function getFocusedAXRoleCached(): string {
  return cachedAXRole
}

export function clearSelectedText(): void {
  cachedSelection = ''
}
