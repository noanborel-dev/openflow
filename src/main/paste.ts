import { clipboard } from 'electron'
import { spawn, execFile, type ChildProcess } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execFile)

// Persistent osascript helper — keeps a long-lived process alive that
// reads scripts from stdin. The classic per-paste `exec('osascript', ...)`
// spends ~120ms forking + compiling AppleScript on every dictation;
// reusing one process drops paste latency to roughly the cost of writing
// a few bytes to a pipe (~5–10ms).
//
// We use fire-and-forget semantics: once stdin.write returns, AppleScript
// is queued for execution and `keystroke ... using command down` is
// synchronous from there. We do NOT try to parse osascript's stdout for
// a "done" signal — that turned out to be unreliable in piped mode.
//
// On any failure (helper crashed, stdin closed, write error) we fall back
// to a one-shot exec which is the previous, slower-but-reliable path.
let helper: ChildProcess | null = null

const PASTE_LINE = 'tell application "System Events" to keystroke "v" using command down\n'

function startHelper(): void {
  try {
    const child = spawn('osascript', ['-i'], { stdio: ['pipe', 'pipe', 'pipe'] })
    child.on('exit', () => { if (helper === child) helper = null })
    child.on('error', () => { if (helper === child) helper = null })
    // Drain stdout/stderr so the OS pipe buffers don't fill and stall
    // the child process. We don't care about the contents.
    child.stdout?.on('data', () => { /* drain */ })
    child.stderr?.on('data', () => { /* drain */ })
    helper = child
  } catch {
    helper = null
  }
}

function pasteViaHelper(): boolean {
  const h = helper
  if (!h || !h.stdin || h.stdin.destroyed || !h.stdin.writable) return false
  try {
    return h.stdin.write(PASTE_LINE)
  } catch {
    return false
  }
}

// AX roles where firing ⌘V is meaningless — the focused element is a
// button, image, list row, etc. that can't accept text. Hitting paste
// against these is the most common reason a dictation "succeeds" but
// nothing visible appears: keystroke "v" fires fine, the OS just has
// nowhere to put it.
//
// Permissive on purpose — when we're not sure (empty string, unknown
// role, Electron/web app that reports AXGroup), we still attempt paste.
// Only block when we're confident there's no text destination.
const NON_PASTEABLE_ROLES = new Set([
  'AXButton', 'AXLink', 'AXMenuItem', 'AXMenuBar', 'AXMenu', 'AXMenuButton',
  'AXImage', 'AXIcon', 'AXStaticText',
  'AXOutline', 'AXTable', 'AXRow', 'AXCell', 'AXColumn',
  'AXBrowser', 'AXList', 'AXTabGroup', 'AXTab',
  'AXSlider', 'AXProgressIndicator',
  'AXCheckBox', 'AXRadioButton', 'AXPopUpButton',
  'AXDisclosureTriangle',
])

// Ask System Events for the AX role of whatever currently has keyboard
// focus inside the frontmost app. Returns 'unknown' on any error (no
// focused element, AX permission denied, AppleScript barfed) — callers
// treat unknown as "go ahead and try paste".
const FOCUSED_ROLE_SCRIPT = `
tell application "System Events"
  try
    set frontApp to first application process whose frontmost is true
    set focusedEl to value of attribute "AXFocusedUIElement" of frontApp
    return value of attribute "AXRole" of focusedEl
  on error
    return "unknown"
  end try
end tell
`

async function getFocusedAXRole(): Promise<string> {
  try {
    const { stdout } = await exec('osascript', ['-e', FOCUSED_ROLE_SCRIPT])
    return stdout.trim() || 'unknown'
  } catch {
    return 'unknown'
  }
}

function canPasteIntoRole(role: string): boolean {
  if (!role || role === 'unknown') return true
  return !NON_PASTEABLE_ROLES.has(role)
}

export async function pasteText(text: string): Promise<{ method: 'paste' | 'clipboard' }> {
  clipboard.writeText(text)

  if (process.platform !== 'darwin') {
    return { method: 'clipboard' }
  }

  // Pre-check: if the focused element clearly isn't a text destination
  // (button, list row, image, etc.), don't fire keystroke "v" into the
  // void. Returning 'clipboard' here is what triggers the paste-fallback
  // popup downstream so the user sees their text + a retry button.
  const role = await getFocusedAXRole()
  if (!canPasteIntoRole(role)) {
    return { method: 'clipboard' }
  }

  // Lazily start the helper on first paste, then reuse it forever.
  if (!helper) startHelper()

  if (pasteViaHelper()) {
    return { method: 'paste' }
  }

  // Fallback: one-shot exec. Slower but reliable.
  try {
    await exec('osascript', ['-e', 'tell application "System Events" to keystroke "v" using command down'])
    return { method: 'paste' }
  } catch {
    return { method: 'clipboard' }
  }
}

// Spawn the helper proactively at app startup so the first paste doesn't
// pay the spawn cost. No-op on non-darwin or if already started.
export function prewarmPasteHelper(): void {
  if (process.platform !== 'darwin') return
  if (!helper) startHelper()
}

export function shutdownPasteHelper(): void {
  if (helper) {
    try { helper.kill() } catch { /* ignore */ }
    helper = null
  }
}
