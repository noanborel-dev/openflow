import { globalShortcut } from 'electron'

type ToggleCallback = () => void

let currentShortcut: string | null = null
let toggleCallback: ToggleCallback | null = null

export function registerHotkey(accelerator: string, onToggle: ToggleCallback): void {
  unregisterHotkey()
  currentShortcut = accelerator
  toggleCallback = onToggle
  try {
    const ok = globalShortcut.register(accelerator, () => {
      toggleCallback?.()
    })
    if (!ok) console.error('[OpenFlow] Failed to register hotkey:', accelerator)
    else console.log('[OpenFlow] Hotkey registered:', accelerator)
  } catch (e) {
    console.error('[OpenFlow] Error registering hotkey:', e)
  }
}

export function unregisterHotkey(): void {
  if (currentShortcut) {
    globalShortcut.unregister(currentShortcut)
    currentShortcut = null
  }
}

export function unregisterAll(): void {
  globalShortcut.unregisterAll()
  currentShortcut = null
}