import { app } from 'electron'
import { appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'

// Persistent log in userData so users (and we) can inspect failures after
// the fact without keeping a terminal open. Kept append-only and small.
const LOG_PATH = (() => {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  return join(dir, 'openflow.log')
})()

function fmt(level: string, msg: string, data?: unknown): string {
  const stamp = new Date().toISOString()
  const extra = data ? ` ${safeStringify(data)}` : ''
  return `${stamp} [${level}] ${msg}${extra}\n`
}

function safeStringify(v: unknown): string {
  if (v instanceof Error) {
    return JSON.stringify({ message: v.message, stack: v.stack })
  }
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

export function logInfo(msg: string, data?: unknown): void {
  const line = fmt('INFO', msg, data)
  process.stdout.write(line)
  try { appendFileSync(LOG_PATH, line) } catch { /* best-effort */ }
}

export function logError(msg: string, err: unknown): void {
  const line = fmt('ERROR', msg, err)
  process.stderr.write(line)
  try { appendFileSync(LOG_PATH, line) } catch { /* best-effort */ }
}

export function getLogPath(): string {
  return LOG_PATH
}
