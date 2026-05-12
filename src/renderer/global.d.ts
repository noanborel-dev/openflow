import type { Settings } from '../shared/types'

export interface LocalModelReadiness {
  ready: boolean
  whisperCli: boolean
  ffmpeg: boolean
  modelDownloaded: boolean
}

export interface LocalModelProgress {
  status: 'starting' | 'downloading' | 'done' | 'error' | 'idle'
  receivedBytes: number
  totalBytes: number
  error?: string
}

declare global {
  interface Window {
    openflow: {
      getSettings: () => Promise<Settings>
      setSettings: (p: Partial<Settings>) => Promise<void>
      testProvider: (provider: string, key: string) => Promise<{ ok: boolean; error?: string }>
      getHistory: () => Promise<unknown>
      requestMicPermission: () => Promise<boolean>
      getMicPermissionStatus: () => Promise<'granted' | 'denied' | 'restricted' | 'not-determined' | 'unknown'>
      openAccessibilitySettings: () => Promise<void>
      isAccessibilityTrusted: () => Promise<boolean>
      revealLog: () => Promise<void>
      reloadHotkeys: () => void
      openOnboarding: () => void
      getLaunchAtLogin: () => Promise<boolean>
      setLaunchAtLogin: (enabled: boolean) => Promise<void>
      onStateChange: (cb: (state: string) => void) => () => void
      getLocalModelStatus: () => Promise<{ readiness: LocalModelReadiness; progress: LocalModelProgress }>
      downloadLocalModel: () => Promise<{ ok: boolean; error?: string }>
      cancelLocalModel: () => Promise<void>
      uninstallLocalModel: () => Promise<void>
      onLocalModelProgress: (cb: (progress: LocalModelProgress) => void) => () => void
    }
  }
}

export {}
