import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'
import type { Settings } from '../shared/types'

contextBridge.exposeInMainWorld('openflow', {
  getSettings: (): Promise<Settings> =>
    ipcRenderer.invoke(IPC.SETTINGS_GET),
  setSettings: (partial: Partial<Settings>): Promise<void> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET, partial),
  testProvider: (
    provider: string,
    key: string
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.PROVIDER_TEST, { provider, key }),
  getHistory: () => ipcRenderer.invoke(IPC.HISTORY_GET),
  requestMicPermission: () => ipcRenderer.invoke(IPC.MIC_PERMISSION),
  openAccessibilitySettings: () => ipcRenderer.invoke(IPC.ACCESSIBILITY_OPEN),
  revealLog: () => ipcRenderer.invoke(IPC.REVEAL_LOG),
  reloadHotkeys: () => ipcRenderer.send(IPC.HOTKEYS_RELOAD),
  onStateChange: (cb: (state: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, state: string) => cb(state)
    ipcRenderer.on(IPC.STATE_CHANGE, handler)
    return () => ipcRenderer.removeListener(IPC.STATE_CHANGE, handler)
  },
})
