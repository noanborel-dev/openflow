import { describe, it, expect } from 'vitest'
import { parsePsArgs, matchAiCli, findAiCliInTree } from './proc-tree'

// Build a `ps -axo pid=,ppid=,args=` style line (leading-padded pid).
function row(pid: number, ppid: number, args: string): string {
  return `${String(pid).padStart(6)} ${String(ppid).padStart(6)} ${args}`
}

describe('matchAiCli (argv-based)', () => {
  it('matches a direct claude invocation', () => {
    expect(matchAiCli('claude')).toBe('claude')
    expect(matchAiCli('/opt/homebrew/bin/claude --resume')).toBe('claude')
  })

  it('normalizes claude-code → claude', () => {
    expect(matchAiCli('claude-code')).toBe('claude')
  })

  it('matches an npx/node wrapper whose argv references the CLI (FN npx)', () => {
    expect(matchAiCli('node /Users/x/proj/node_modules/.bin/claude')).toBe('claude')
    expect(matchAiCli('npx -y @anthropic-ai/claude-code')).toBe('claude')
  })

  it('matches a bunx/bun wrapper referencing cursor-agent (FN bunx)', () => {
    expect(matchAiCli('bun /Users/x/.bun/bin/cursor-agent')).toBe('cursor-agent')
  })

  it('matches gh ONLY when qualified by copilot (FP4)', () => {
    expect(matchAiCli('gh copilot suggest "undo last commit"')).toBe('gh copilot')
    expect(matchAiCli('gh pr create --fill')).toBeNull()
  })

  it('matches q ONLY when qualified by chat (Amazon Q)', () => {
    expect(matchAiCli('q chat')).toBe('q chat')
    expect(matchAiCli('/opt/homebrew/bin/q chat --no-interactive')).toBe('q chat')
    expect(matchAiCli('q --version')).toBeNull()
    expect(matchAiCli('q')).toBeNull()
  })

  it('matches the 2026 native AI CLIs (codex, gemini, copilot, opencode, amp)', () => {
    expect(matchAiCli('codex')).toBe('codex')
    expect(matchAiCli('/Users/x/.local/bin/gemini --yolo')).toBe('gemini')
    expect(matchAiCli('copilot')).toBe('copilot')
    expect(matchAiCli('opencode run "fix the build"')).toBe('opencode')
    expect(matchAiCli('amp')).toBe('amp')
  })

  it('matches AI CLIs launched through python/uv/pipx wrappers (FN)', () => {
    expect(matchAiCli('python -m aider')).toBe('aider')
    expect(matchAiCli('python3 -m aider --model gpt-5')).toBe('aider')
    expect(matchAiCli('uvx aider')).toBe('aider')
    expect(matchAiCli('uv run aider')).toBe('aider')
    expect(matchAiCli('pipx run aider')).toBe('aider')
  })

  it('does NOT match bare goose (DB-migration tool collision, documented FN)', () => {
    expect(matchAiCli('goose -dir=db up')).toBeNull()
    expect(matchAiCli('goose up')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(matchAiCli('clAUDE')).toBe('claude')
  })

  it('returns null for an ordinary shell / editor process', () => {
    expect(matchAiCli('-zsh')).toBeNull()
    expect(matchAiCli('/Applications/Visual Studio Code.app/Contents/MacOS/Electron')).toBeNull()
  })
})

describe('parsePsArgs', () => {
  it('parses pid, ppid, and the full args column with embedded spaces', () => {
    const out = [
      row(23257, 1, '/Applications/Code.app/Contents/MacOS/Code'),
      row(23300, 23257, '/bin/zsh -il'),
    ].join('\n')
    const rows = parsePsArgs(out)
    expect(rows).toEqual([
      { pid: 23257, ppid: 1, args: '/Applications/Code.app/Contents/MacOS/Code' },
      { pid: 23300, ppid: 23257, args: '/bin/zsh -il' },
    ])
  })

  it('skips blank and malformed lines', () => {
    expect(parsePsArgs('\n  \ngarbage\n').length).toBe(0)
  })
})

describe('findAiCliInTree', () => {
  it('finds an AI CLI in the editor process subtree', () => {
    const rows = parsePsArgs([
      row(23257, 1, 'Code'),
      row(23258, 23257, 'Code Helper (Renderer)'),
      row(23300, 23258, '/bin/zsh -il'),
      row(23350, 23300, 'claude'),
    ].join('\n'))
    expect(findAiCliInTree(rows, [23257])).toEqual({ isAiCli: true, cli: 'claude' })
  })

  it('finds an npx-wrapped CLI in the subtree', () => {
    const rows = parsePsArgs([
      row(23257, 1, 'Code'),
      row(23300, 23257, '/bin/zsh'),
      row(23350, 23300, 'node /Users/x/proj/node_modules/.bin/claude'),
    ].join('\n'))
    expect(findAiCliInTree(rows, [23257]).isAiCli).toBe(true)
  })

  it('does NOT match a claude that is not a descendant of the editor (no-FP)', () => {
    const rows = parsePsArgs([
      row(23257, 1, 'Code'),
      row(23300, 23257, '/bin/zsh'),
      row(99000, 1, 'claude'), // standalone, parented to launchd
    ].join('\n'))
    expect(findAiCliInTree(rows, [23257])).toEqual({ isAiCli: false })
  })

  it('tmux fallback: finds claude under the tmux server when a client is in the subtree', () => {
    const rows = parsePsArgs([
      row(23257, 1, 'Code'),
      row(23300, 23257, '/bin/zsh'),
      row(23400, 23300, 'tmux attach -t main'), // client in editor subtree
      row(24000, 1, 'tmux'),                     // server, reparented to launchd
      row(24050, 24000, 'claude'),               // claude lives under the server
    ].join('\n'))
    expect(findAiCliInTree(rows, [23257])).toEqual({ isAiCli: true, cli: 'claude' })
  })

  it('no tmux client in subtree → no fallback bridging', () => {
    const rows = parsePsArgs([
      row(23257, 1, 'Code'),
      row(23300, 23257, '/bin/zsh'),
      row(24000, 1, 'tmux'),
      row(24050, 24000, 'claude'),
    ].join('\n'))
    expect(findAiCliInTree(rows, [23257])).toEqual({ isAiCli: false })
  })

  it('returns false for empty roots', () => {
    const rows = parsePsArgs(row(23350, 23300, 'claude'))
    expect(findAiCliInTree(rows, [])).toEqual({ isAiCli: false })
  })
})
