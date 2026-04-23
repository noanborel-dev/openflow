import { GlobalKeyboardListener } from 'node-global-key-listener'
import type { IGlobalKeyEvent } from 'node-global-key-listener'

type HotkeyCallback = (event: 'down' | 'up') => void

interface Registration {
  key: string
  callback: HotkeyCallback
}

export class HotkeyManager {
  private listener = new GlobalKeyboardListener()
  private registrations: Registration[] = []
  private started = false

  register(key: string, callback: HotkeyCallback): void {
    this.registrations.push({ key, callback })
  }

  unregisterAll(): void {
    this.registrations = []
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.listener.addListener((e: IGlobalKeyEvent) => {
      for (const reg of this.registrations) {
        if (this.matchesKey(e, reg.key)) {
          reg.callback(e.state === 'DOWN' ? 'down' : 'up')
        }
      }
    })
  }

  stop(): void {
    this.listener.kill()
    this.started = false
  }

  private matchesKey(e: IGlobalKeyEvent, key: string): boolean {
    const parts = key.split('+').map(p => p.trim().toLowerCase())
    const trigger = parts[parts.length - 1]
    const evName = (e.name ?? '').toLowerCase()
    return evName.includes(trigger)
  }
}

export const hotkeyManager = new HotkeyManager()
