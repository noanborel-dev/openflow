import { clipboard } from 'electron'
import { spawn, execFile, type ChildProcess } from 'child_process'
import { promisify } from 'util'
import { logInfo } from './log'
import { getFocusedApp } from './focused-app'

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
// against these used to be the most common reason a dictation
// "succeeded" but nothing visible appeared.
const NON_PASTEABLE_ROLES = new Set([
  'AXButton', 'AXLink', 'AXMenuItem', 'AXMenuBar', 'AXMenu', 'AXMenuButton',
  'AXImage', 'AXIcon', 'AXStaticText',
  'AXOutline', 'AXTable', 'AXRow', 'AXCell', 'AXColumn',
  'AXBrowser', 'AXList', 'AXTabGroup', 'AXTab',
  'AXSlider', 'AXProgressIndicator',
  'AXCheckBox', 'AXRadioButton', 'AXPopUpButton',
  'AXDisclosureTriangle',
])

// Live AX-role probe — fired at paste time (or by the pipeline,
// concurrently with cleanup, so the wait overlaps with LLM latency
// and adds no hot-path time). Returns the role of whatever has
// keyboard focus AT THE MOMENT THE PROMISE IS CREATED, which is the
// only reading that makes sense — the user might have moved between
// apps while dictating.
const FOCUSED_ROLE_SCRIPT = `
tell application "System Events"
  try
    set frontApp to first application process whose frontmost is true
    try
      set focusedEl to value of attribute "AXFocusedUIElement" of frontApp
      return value of attribute "AXRole" of focusedEl
    on error
      return "no-focus"
    end try
  on error
    return "script-error"
  end try
end tell
`

export async function probeFocusedAXRole(): Promise<string> {
  if (process.platform !== 'darwin') return 'script-error'
  try {
    const { stdout } = await exec('osascript', ['-e', FOCUSED_ROLE_SCRIPT])
    return stdout.trim() || 'script-error'
  } catch {
    return 'script-error'
  }
}

// Apps where AXGroup / AXScrollArea / generic roles mean "no text
// destination". For these we require an EXPLICIT text-input role
// before allowing paste; everything else routes to the fallback.
//
// Finder is the canonical case: it returns AXGroup when a window is
// focused but no text field is being edited. Paste would fire into
// the file list and do nothing visible. Add more bundle IDs here as
// we discover other "non-text-app" cases.
const STRICT_PASTE_APPS = new Set<string>([
  'com.apple.finder',
])

const EXPLICIT_TEXT_ROLES = new Set([
  'AXTextField', 'AXTextArea', 'AXComboBox', 'AXSearchField',
])

function canPasteIntoRole(role: string, bundleId: string): boolean {
  // No focused element at all — Desktop, Finder, app without focus →
  // there is nowhere to paste, route to the fallback popup.
  if (role === 'no-focus' || role === '') return false
  // Script error → AX permission probably denied. We've already given
  // up trying to be clever; let the actual paste attempt happen and
  // surface whatever error it produces.
  if (role === 'script-error') return true
  if (NON_PASTEABLE_ROLES.has(role)) return false
  // Strict apps: require an explicit text-input role. Catches Finder
  // (and similar) where AXGroup focus means "no text field anywhere".
  if (STRICT_PASTE_APPS.has(bundleId)) {
    return EXPLICIT_TEXT_ROLES.has(role)
  }
  // Permissive default — most apps with AXGroup/AXScrollArea focus
  // (Slack, Discord, Notion, Chrome) really DO have a focused
  // contenteditable underneath.
  return true
}

export async function pasteText(
  text: string,
  // The pipeline kicks off the AX-role probe concurrently with the
  // cleanup LLM so the result is ready when paste runs — no extra
  // hot-path osascript. Callers that don't have one (paste-last from
  // history, etc.) get a fresh probe fired here.
  rolePromise?: Promise<string>,
): Promise<{ method: 'paste' | 'clipboard' }> {
  clipboard.writeText(text)

  if (process.platform !== 'darwin') {
    return { method: 'clipboard' }
  }

  const role = await (rolePromise ?? probeFocusedAXRole())
  const { bundleId } = getFocusedApp()
  const canPaste = canPasteIntoRole(role, bundleId)
  logInfo('Paste pre-check', { bundleId, focusedAXRole: role, canPaste })
  if (!canPaste) {
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
