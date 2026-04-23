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
import { registerIpcHandlers, addToHistory, getHistory } from './ipc'
import { registerHotkey, unregisterAll } from './hotkeys'
import { getSettings, setSettings } from './store'
import { runDictationPipeline } from './pipeline'
import { pasteText } from './paste'
import { toUserError } from './errors'
import { IPC } from '../shared/types'

let indicatorWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let onboardingWindow: BrowserWindow | null = null
let tray: Tray | null = null

const audioChunks: Buffer[] = []

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

  if (process.env['ELECTRON_RENDERER_URL']) {
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
    width: 720,
    height: 560,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#FAFAF5',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
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
    width: 560,
    height: 540,
    resizable: false,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#FAFAF5',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/onboarding/index.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/onboarding/index.html'))
  }

  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
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
    label: item.cleaned.length > 50 ? item.cleaned.slice(0, 50) + '…' : item.cleaned,
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
  const iconPath = join(__dirname, '../../assets/tray.png')
  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(iconPath)
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('OpenFlow')
  tray.on('click', () => createSettingsWindow())
  updateTrayMenu()
}

function broadcastState(state: string): void {
  indicatorWindow?.webContents.send(IPC.STATE_CHANGE, state)
}

function setupHotkeys(): void {
  const settings = getSettings()
  unregisterAll()

  registerHotkey(settings.hotkeys.pushToTalk, {
    onStart: () => {
      audioChunks.length = 0
      indicatorWindow?.setIgnoreMouseEvents(true, { forward: true })
      indicatorWindow?.showInactive()
      broadcastState('recording')
    },
    onStop: () => {
      // Renderer transitions recording → stopping → (flush) → sends AUDIO_DONE
      broadcastState('stopping')
    },
  })
}

function setupAudioIpc(): void {
  ipcMain.on(IPC.AUDIO_CHUNK, (_e, chunk: ArrayBuffer) => {
    audioChunks.push(Buffer.from(chunk))
  })

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

      broadcastState(result.pasteMethod === 'clipboard' ? 'clipboard' : 'done')

      setTimeout(() => {
        broadcastState('idle')
        indicatorWindow?.setIgnoreMouseEvents(true, { forward: true })
        indicatorWindow?.hide()
      }, 1500)
    } catch (err) {
      const { userMessage } = toUserError(err)
      console.error('[OpenFlow] Pipeline error:', err)
      broadcastState(`error:${userMessage}`)
      setTimeout(() => {
        broadcastState('idle')
        indicatorWindow?.setIgnoreMouseEvents(true, { forward: true })
        indicatorWindow?.hide()
      }, 4000)
    }
  })
}

function setupIpcListeners(): void {
  ipcMain.on(IPC.OPEN_SETTINGS, () => createSettingsWindow())
  ipcMain.on(IPC.OPEN_ONBOARDING, () => createOnboardingWindow())
  ipcMain.on(IPC.HOTKEYS_RELOAD, () => setupHotkeys())
}

app.whenReady().then(() => {
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

app.on('window-all-closed', () => {
  // Intentionally empty — app lives in tray
})
