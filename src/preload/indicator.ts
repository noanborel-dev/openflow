import { contextBridge, ipcRenderer } from 'electron'

// Channel names inlined here intentionally — importing from shared/types would
// cause Rollup to emit a shared chunk that Electron's preload sandbox cannot resolve.
const STATE_CHANGE = 'state-change'
const AUDIO_CHUNK = 'audio-chunk'
const AUDIO_DONE = 'audio-done'
const SETTINGS_GET = 'settings:get'
const INDICATOR_TOGGLE_RECORD = 'indicator:toggle-record'
const INDICATOR_PASTE_LAST = 'indicator:paste-last'
const INDICATOR_POLISH_SELECTION = 'indicator:polish-selection'
const INDICATOR_SET_INTERACTIVE = 'indicator:set-interactive'

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
  // Idle-pill click menu actions.
  toggleRecord: () => ipcRenderer.send(INDICATOR_TOGGLE_RECORD),
  pasteLast: () => ipcRenderer.send(INDICATOR_PASTE_LAST),
  polishSelection: () => ipcRenderer.send(INDICATOR_POLISH_SELECTION),
  // Tell main to flip setIgnoreMouseEvents so the indicator window can
  // receive real clicks while the cursor is over the idle pill / menu.
  setInteractive: (interactive: boolean) =>
    ipcRenderer.send(INDICATOR_SET_INTERACTIVE, interactive),
})
