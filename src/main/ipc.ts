import { ipcMain, systemPreferences, shell } from 'electron'
import { IPC } from '../shared/types'
import type { DictationResult } from '../shared/types'
import { getSettings, setSettings } from './store'
import { testGroqKey } from './providers/groq'
import { testOpenAIKey } from './providers/openai'
import { testAnthropicKey } from './providers/anthropic'
import { HISTORY_LIMIT } from '../shared/constants'

const history: DictationResult[] = []

export function addToHistory(result: DictationResult): void {
  history.unshift(result)
  if (history.length > HISTORY_LIMIT) history.splice(HISTORY_LIMIT)
}

export function getHistory(): DictationResult[] {
  return [...history]
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.SETTINGS_GET, () => getSettings())

  ipcMain.handle(IPC.SETTINGS_SET, (_e, partial) => {
    setSettings(partial)
  })

  ipcMain.handle(IPC.PROVIDER_TEST, async (_e, { provider, key }) => {
    try {
      if (provider === 'groq') await testGroqKey(key)
      else if (provider === 'openai') await testOpenAIKey(key)
      else if (provider === 'anthropic') await testAnthropicKey(key)
      return { ok: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { ok: false, error: message }
    }
  })

  ipcMain.handle(IPC.HISTORY_GET, () => getHistory())

  ipcMain.handle(IPC.MIC_PERMISSION, async () => {
    if (process.platform === 'darwin') {
      const status = await systemPreferences.askForMediaAccess('microphone')
      return status
    }
    return true
  })

  ipcMain.handle(IPC.ACCESSIBILITY_OPEN, () => {
    if (process.platform === 'darwin') {
      shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
      )
    }
  })
}
