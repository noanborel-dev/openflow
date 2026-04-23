import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'

contextBridge.exposeInMainWorld('indicator', {
  onStateChange: (cb: (state: string) => void) => {
    ipcRenderer.on(IPC.STATE_CHANGE, (_e, state) => cb(state))
    return () => ipcRenderer.removeAllListeners(IPC.STATE_CHANGE)
  },
  sendAudioChunk: (chunk: ArrayBuffer) =>
    ipcRenderer.send(IPC.AUDIO_CHUNK, chunk),
  sendAudioDone: () =>
    ipcRenderer.send(IPC.AUDIO_DONE),
})
