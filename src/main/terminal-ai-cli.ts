import { execFile } from 'child_process'
import { basename } from 'path'
import { logError } from './log'

export const TERMINAL_BUNDLE_IDS: ReadonlySet<string> = new Set<string>([
  'com.apple.Terminal',          // Apple Terminal
  'com.googlecode.iterm2',       // iTerm2
  'app.warp.dev',                // Warp
  'com.github.wez.wezterm',      // WezTerm
  'org.alacritty',               // Alacritty
  'net.kovidgoyal.kitty',        // Kitty
  'co.zeit.hyper',               // Hyper
  'org.tabby',                   // Tabby
  'com.mitchellh.ghostty',       // Ghostty
])

// macOS `ps` truncates `comm` to ~16 chars and may show the full path.
// We match against the basename only. Keep this list focused on CLIs
// that are interactive AI prompt surfaces — false-positive routing to
// ai_prompt is acceptable but should be rare.
const AI_CLI_BINARIES: ReadonlySet<string> = new Set<string>([
  'claude',          // Claude Code CLI
  'claude-code',     // alias
  'cursor-agent',    // Cursor terminal agent
  'aider',           // aider.chat
  'gh',              // gh copilot
  'copilot',         // gh-copilot standalone
  'cody',            // Sourcegraph Cody
  'gemini',          // Google gemini CLI
  'codex',           // openai codex CLI
  'goose',           // goose AI
])

// AppleScript "tell application ... to unix id" needs the app's display
// name, not the bundle ID. Map known terminals to their AppleScript name.
const TERMINAL_APPLESCRIPT_NAMES: Record<string, string> = {
  'com.apple.Terminal': 'Terminal',
  'com.googlecode.iterm2': 'iTerm',
  'app.warp.dev': 'Warp',
  'com.github.wez.wezterm': 'WezTerm',
  'org.alacritty': 'Alacritty',
  'net.kovidgoyal.kitty': 'kitty',
  'co.zeit.hyper': 'Hyper',
  'org.tabby': 'Tabby',
  'com.mitchellh.ghostty': 'Ghostty',
}

const PROBE_TIMEOUT_MS = 100

function execWithTimeout(file: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(file, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err)
      else resolve(stdout)
    })
    // execFile's own timeout sends SIGTERM; add a hard kill safety net.
    const t = setTimeout(() => {
      try { child.kill('SIGKILL') } catch { /* already exited */ }
      reject(new Error('probe timeout'))
    }, timeoutMs + 20)
    child.on('exit', () => clearTimeout(t))
  })
}

async function getTerminalPids(bundleId: string): Promise<number[]> {
  const appName = TERMINAL_APPLESCRIPT_NAMES[bundleId]
  if (!appName) return []
  // `pgrep -x` matches the exact process name (truncated to 15 chars by
  // the kernel, but pgrep handles that). Faster and side-effect-free
  // compared to osascript (~1s cold).
  try {
    const out = await execWithTimeout('/usr/bin/pgrep', ['-x', appName.slice(0, 15)], PROBE_TIMEOUT_MS)
    return out.split('\n').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n) && n > 0)
  } catch {
    return []
  }
}

export async function focusedTerminalRunningAiCli(bundleId: string): Promise<{
  isAiCli: boolean
  cli?: string
}> {
  if (!TERMINAL_BUNDLE_IDS.has(bundleId)) return { isAiCli: false }

  try {
    const result = await Promise.race([
      detectAiCli(bundleId),
      new Promise<{ isAiCli: false }>((resolve) => {
        setTimeout(() => resolve({ isAiCli: false }), PROBE_TIMEOUT_MS + 30)
      }),
    ])
    return result
  } catch (err) {
    logError('terminal-ai-cli probe failed', err)
    return { isAiCli: false }
  }
}

async function detectAiCli(bundleId: string): Promise<{ isAiCli: boolean, cli?: string }> {
  const terminalPids = await getTerminalPids(bundleId)
  if (terminalPids.length === 0) return { isAiCli: false }

  let psOut: string
  try {
    psOut = await execWithTimeout('/bin/ps', ['-axo', 'pid=,ppid=,comm='], PROBE_TIMEOUT_MS)
  } catch {
    return { isAiCli: false }
  }

  // Parse `ps` output into a child-of map: ppid -> pid[], plus a pid -> comm map.
  const childrenOf = new Map<number, number[]>()
  const commOf = new Map<number, string>()
  for (const line of psOut.split('\n')) {
    const trimmed = line.trimStart()
    if (!trimmed) continue
    const firstSpace = trimmed.indexOf(' ')
    if (firstSpace < 0) continue
    const pid = parseInt(trimmed.slice(0, firstSpace), 10)
    const rest = trimmed.slice(firstSpace + 1).trimStart()
    const secondSpace = rest.indexOf(' ')
    if (secondSpace < 0) continue
    const ppid = parseInt(rest.slice(0, secondSpace), 10)
    const comm = rest.slice(secondSpace + 1).trim()
    if (!Number.isFinite(pid) || !Number.isFinite(ppid)) continue
    commOf.set(pid, comm)
    const list = childrenOf.get(ppid)
    if (list) list.push(pid)
    else childrenOf.set(ppid, [pid])
  }

  // BFS descendants of every terminal pid. Match basename(comm) against
  // the AI-CLI set. `ps comm` may include a full path on macOS for some
  // shells; basename handles both forms.
  const visited = new Set<number>()
  const queue: number[] = [...terminalPids]
  while (queue.length > 0) {
    const pid = queue.shift()!
    if (visited.has(pid)) continue
    visited.add(pid)
    const comm = commOf.get(pid)
    if (comm) {
      const name = basename(comm)
      if (AI_CLI_BINARIES.has(name)) return { isAiCli: true, cli: name }
    }
    const kids = childrenOf.get(pid)
    if (kids) queue.push(...kids)
  }
  return { isAiCli: false }
}
