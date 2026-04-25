import type { Settings } from '../shared/types'

declare global {
  interface Window {
    openflow: {
      getSettings: () => Promise<Settings>
      setSettings: (p: Partial<Settings>) => Promise<void>
      testProvider: (provider: string, key: string) => Promise<{ ok: boolean; error?: string }>
      getHistory: () => Promise<unknown>
      requestMicPermission: () => Promise<boolean>
      openAccessibilitySettings: () => Promise<void>
      revealLog: () => Promise<void>
      reloadHotkeys: () => void
      onStateChange: (cb: (state: string) => void) => () => void
    }
  }
}

export {}
