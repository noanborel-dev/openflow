import { contextBridge, ipcRenderer } from 'electron'

// Channel names inlined here intentionally — importing from shared/types would
// cause Rollup to emit a shared chunk that Electron's preload sandbox cannot resolve.
const STATE_CHANGE = 'state-change'
const AUDIO_CHUNK = 'audio-chunk'
const AUDIO_DONE = 'audio-done'
const SETTINGS_GET = 'settings:get'

contextBridge.exposeInMainWorld('indicator', {
  onStateChange: (cb: (state: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, state: string) => cb(state)
    ipcRenderer.on(STATE_CHANGE, handler)
    return () => ipcRenderer.removeListener(STATE_CHANGE, handler)
  },
  sendAudioChunk: (chunk: ArrayBuffer) =>
    ipcRenderer.send(AUDIO_CHUNK, chunk),
  sendAudioDone: () =>
    ipcRenderer.send(AUDIO_DONE),
  // Minimal settings access for the indicator. We just need the
  // selected mic deviceId — exposing the full settings object would
  // require pulling in the Settings type and bloating this preload.
  getInputDeviceId: async (): Promise<string | null> => {
    const settings = await ipcRenderer.invoke(SETTINGS_GET)
    return settings?.inputDeviceId ?? null
  },
})
