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

export async function pasteText(text: string): Promise<{ method: 'paste' | 'clipboard' }> {
  clipboard.writeText(text)

  if (process.platform !== 'darwin') {
    return { method: 'clipboard' }
  }

  // Lazily start the helper on first paste, then reuse it forever.
  if (!helper) startHelper()

  // No clipboard-propagation sleep here. clipboard.writeText is synchronous
  // and macOS NSPasteboard is updated before the call returns; the legacy
  // 30ms padding was conservative and unnecessary on modern macOS. If we
  // ever see paste-the-old-clipboard regressions, reintroduce a small (<10ms)
  // sleep here.

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
