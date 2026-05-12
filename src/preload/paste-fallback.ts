import { contextBridge, ipcRenderer } from 'electron'

// Inline channel constants — importing from shared/types pulls in a chunk
// the preload sandbox can't resolve.
const PASTE_FALLBACK_SHOW = 'paste-fallback:show'
const PASTE_FALLBACK_RETRY = 'paste-fallback:retry'
const PASTE_FALLBACK_DISMISS = 'paste-fallback:dismiss'

interface PasteFallbackPayload {
  text: string
  hotkey: string
}

contextBridge.exposeInMainWorld('pasteFallback', {
  // Renderer subscribes to "show" messages from main; main pushes a fresh
  // payload (cleaned text + bound hotkey) every time paste falls back to
  // clipboard. Returns an unsubscribe.
  onShow: (cb: (payload: PasteFallbackPayload) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, payload: PasteFallbackPayload) => cb(payload)
    ipcRenderer.on(PASTE_FALLBACK_SHOW, handler)
    return () => ipcRenderer.removeListener(PASTE_FALLBACK_SHOW, handler)
  },
  retry: (): Promise<boolean> => ipcRenderer.invoke(PASTE_FALLBACK_RETRY),
  dismiss: (): void => { ipcRenderer.send(PASTE_FALLBACK_DISMISS) },
})
