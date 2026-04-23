import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'

contextBridge.exposeInMainWorld('indicator', {
  onStateChange: (cb: (state: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, state: string) => cb(state)
    ipcRenderer.on(IPC.STATE_CHANGE, handler)
    return () => ipcRenderer.removeListener(IPC.STATE_CHANGE, handler)
  },
  sendAudioChunk: (chunk: ArrayBuffer) =>
    ipcRenderer.send(IPC.AUDIO_CHUNK, chunk),
  sendAudioDone: () =>
    ipcRenderer.send(IPC.AUDIO_DONE),
})
