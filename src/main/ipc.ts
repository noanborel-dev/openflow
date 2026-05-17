import { app, ipcMain, systemPreferences, shell } from 'electron'
import { IPC } from '../shared/types'
import type { DictationResult, LocalModelId } from '../shared/types'
import { localModelDownloaded, localModelPath } from './local-models'
import { prewarmWhisper } from './whisper-host'
import { prewarmModelId } from './providers/local'
import { getSettings, setSettings } from './store'
import { testGroqKey } from './providers/groq'
import { localWhisperReadiness, freeLocalWhisper } from './providers/local'
import {
  downloadWhisperModel,
  cancelDownload,
  uninstallWhisperModel,
  getLocalModelProgress,
} from './local-download'
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
    // If the user just switched to Local or changed model tier, kick
    // off a worker spawn + model load now so the next dictation hits
    // the warm path instead of paying the cold-start tax. Fire-and-
    // forget; failures fall back to the transcribe-time error.
    const next = getSettings()
    if (next.provider.provider === 'local') {
      const id = prewarmModelId()
      if (localModelDownloaded(id)) {
        prewarmWhisper(localModelPath(id))
      }
    }
  })

  ipcMain.handle(IPC.PROVIDER_TEST, async (_e, { provider, key }) => {
    try {
      if (provider === 'groq') await testGroqKey(key)
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
      // isTrustedAccessibilityClient(true) prompts macOS to add this process
      // to the Accessibility list automatically — no manual search needed.
      systemPreferences.isTrustedAccessibilityClient(true)
    }
  })

  // Status checks for the onboarding UI. Mic returns 'granted' | 'denied'
  // | 'not-determined' so we can decide whether to show "Allow" vs
  // "Open Settings". Accessibility just returns trusted-or-not — the
  // onboarding polls this every ~750ms to detect when the user actually
  // flips the toggle in System Settings.
  ipcMain.handle(IPC.MIC_PERMISSION_STATUS, () => {
    if (process.platform !== 'darwin') return 'granted'
    return systemPreferences.getMediaAccessStatus('microphone')
  })

  ipcMain.handle(IPC.ACCESSIBILITY_CHECK, () => {
    if (process.platform !== 'darwin') return true
    return systemPreferences.isTrustedAccessibilityClient(false)
  })

  // Launch at login. setLoginItemSettings is a no-op on Linux but works
  // on macOS + Windows. We expose both get + set so the UI can render
  // the current state without persisting it ourselves — the OS is the
  // source of truth.
  ipcMain.handle(IPC.LAUNCH_AT_LOGIN_GET, () => {
    return app.getLoginItemSettings().openAtLogin
  })
  ipcMain.handle(IPC.LAUNCH_AT_LOGIN_SET, (_e, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true })
  })

  // Local model management. Status returns the three-prong readiness
  // for the currently-selected model + last-known progress for every
  // model that's ever started downloading, so the Settings UI can
  // render all three cards with their actual state on mount.
  ipcMain.handle(IPC.LOCAL_MODEL_STATUS, () => ({
    readiness: localWhisperReadiness(),
    // getLocalModelProgress() with no arg returns the array of all
    // known per-model progress entries.
    progress: getLocalModelProgress(),
    downloaded: {
      'base': localModelDownloaded('base'),
      'small': localModelDownloaded('small'),
      'large-v3-turbo': localModelDownloaded('large-v3-turbo'),
    },
  }))

  ipcMain.handle(IPC.LOCAL_MODEL_DOWNLOAD, async (_e, modelId: LocalModelId) => {
    try {
      await downloadWhisperModel(modelId)
      return { ok: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { ok: false, error: message }
    }
  })

  ipcMain.handle(IPC.LOCAL_MODEL_CANCEL, () => {
    cancelDownload()
  })

  ipcMain.handle(IPC.LOCAL_MODEL_UNINSTALL, async (_e, modelId: LocalModelId) => {
    // Release the in-memory whisper instance before deleting the
    // model file — keeping the file open across unlink would orphan
    // RAM and (on Windows) fail the delete with EBUSY. The provider
    // will reload on next dictation.
    await freeLocalWhisper()
    await uninstallWhisperModel(modelId)
  })
}
