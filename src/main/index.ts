import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  screen,
} from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { registerIpcHandlers, addToHistory, getHistory } from './ipc'
import { hotkeyManager } from './hotkeys'
import { getSettings, setSettings } from './store'
import { runDictationPipeline } from './pipeline'
import { pasteText } from './paste'
import { IPC } from '../shared/types'
import type { DictationResult } from '../shared/types'

let indicatorWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let onboardingWindow: BrowserWindow | null = null
let tray: Tray | null = null

const audioChunks: Buffer[] = []
let isRecording = false

function createIndicatorWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const savedPos = getSettings().indicatorPosition
  const x = savedPos?.x ?? Math.round(width / 2 - 140)
  const y = savedPos?.y ?? height - 100

  const win = new BrowserWindow({
    width: 280,
    height: 80,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/indicator.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setIgnoreMouseEvents(true, { forward: true })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/indicator/index.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/indicator/index.html'))
  }

  return win
}

function createSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return settingsWindow
  }

  const win = new BrowserWindow({
    width: 700,
    height: 560,
    show: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/settings/index.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/settings/index.html'))
  }

  win.once('ready-to-show', () => win.show())
  win.on('closed', () => { settingsWindow = null })
  settingsWindow = win
  return win
}

function createOnboardingWindow(): BrowserWindow {
  if (onboardingWindow && !onboardingWindow.isDestroyed()) {
    onboardingWindow.focus()
    return onboardingWindow
  }

  const win = new BrowserWindow({
    width: 580,
    height: 520,
    resizable: false,
    show: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/onboarding/index.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/onboarding/index.html'))
  }

  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    // Clear firstRun regardless of how the window is closed (button or traffic light)
    setSettings({ firstRun: false })
    onboardingWindow = null
  })
  onboardingWindow = win
  return win
}

function updateTrayMenu(): void {
  if (!tray) return

  const history = getHistory()
  const historyItems: Electron.MenuItemConstructorOptions[] = history.slice(0, 5).map(item => ({
    label: item.cleaned.length > 50
      ? item.cleaned.slice(0, 50) + '…'
      : item.cleaned,
    click: () => pasteText(item.cleaned),
  }))

  const menu = Menu.buildFromTemplate([
    { label: 'OpenFlow', enabled: false },
    { type: 'separator' },
    { label: 'Settings…', click: () => createSettingsWindow() },
    { type: 'separator' },
    ...(historyItems.length > 0
      ? [{ label: 'Recent Dictations', enabled: false } as Electron.MenuItemConstructorOptions, ...historyItems]
      : [{ label: 'No dictations yet', enabled: false } as Electron.MenuItemConstructorOptions]),
    { type: 'separator' },
    { label: 'Quit OpenFlow', role: 'quit' },
  ])

  tray.setContextMenu(menu)
}

function setupTray(): void {
  // Use a simple empty image as placeholder — replace assets/tray.png with a real icon
  const iconPath = join(__dirname, '../../assets/tray.png')
  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(iconPath)
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('OpenFlow')
  updateTrayMenu()
}

function broadcastState(state: string): void {
  indicatorWindow?.webContents.send(IPC.STATE_CHANGE, state)
}

function setupHotkeys(): void {
  const settings = getSettings()

  hotkeyManager.unregisterAll()

  // Push-to-talk: key DOWN starts recording; key UP tells renderer to stop.
  // Pipeline runs when AUDIO_DONE arrives (after final ondataavailable fires).
  hotkeyManager.register(settings.hotkeys.pushToTalk, (event) => {
    if (event === 'down') {
      if (isRecording) return  // re-entrancy guard: ignore repeat key-down events
      isRecording = true
      audioChunks.length = 0
      indicatorWindow?.setIgnoreMouseEvents(false)
      indicatorWindow?.show()
      broadcastState('recording')
    } else {
      if (!isRecording) return
      isRecording = false
      // Tell the renderer to stop MediaRecorder; pipeline fires on AUDIO_DONE below
      broadcastState('stopping')
    }
  })

  // Paste last dictation
  hotkeyManager.register(settings.hotkeys.pasteLast, (event) => {
    if (event === 'down') {
      const hist = getHistory()
      if (hist.length > 0) pasteText(hist[0].cleaned)
    }
  })

  hotkeyManager.start()
}

function setupAudioIpc(): void {
  ipcMain.on(IPC.AUDIO_CHUNK, (_e, chunk: ArrayBuffer) => {
    audioChunks.push(Buffer.from(chunk))
  })

  // AUDIO_DONE fires from the renderer after MediaRecorder.onstop —
  // meaning all ondataavailable chunks have already arrived. Safe to pipeline now.
  ipcMain.on(IPC.AUDIO_DONE, async () => {
    const audioBuffer = Buffer.concat(audioChunks)
    audioChunks.length = 0

    if (audioBuffer.length < 500) {
      broadcastState('idle')
      indicatorWindow?.setIgnoreMouseEvents(true, { forward: true })
      indicatorWindow?.hide()
      return
    }

    try {
      const result = await runDictationPipeline(
        audioBuffer,
        getSettings(),
        (s) => broadcastState(s)
      )

      addToHistory(result)
      updateTrayMenu()

      if (result.pasteMethod === 'clipboard') {
        broadcastState('clipboard')
      }

      setTimeout(() => {
        broadcastState('idle')
        indicatorWindow?.setIgnoreMouseEvents(true, { forward: true })
        indicatorWindow?.hide()
      }, 1500)
    } catch (err) {
      console.error('[OpenFlow] Pipeline error:', err)
      broadcastState('error')
      setTimeout(() => {
        broadcastState('idle')
        indicatorWindow?.setIgnoreMouseEvents(true, { forward: true })
        indicatorWindow?.hide()
      }, 2000)
    }
  })
}

function setupIpcListeners(): void {
  ipcMain.on(IPC.OPEN_SETTINGS, () => createSettingsWindow())
  ipcMain.on(IPC.OPEN_ONBOARDING, () => createOnboardingWindow())
}

app.whenReady().then(() => {
  // macOS: hide dock icon (runs as menubar/tray app)
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }

  registerIpcHandlers()
  setupAudioIpc()
  setupIpcListeners()

  indicatorWindow = createIndicatorWindow()
  setupTray()
  setupHotkeys()

  const settings = getSettings()
  if (settings.firstRun) {
    createOnboardingWindow()
  }
})

// Keep app alive when all windows are closed (runs in tray)
app.on('window-all-closed', () => {
  // Intentionally empty — app lives in tray
})
