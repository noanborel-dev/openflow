import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  screen,
  shell,
} from 'electron'
import { join } from 'path'
import { registerIpcHandlers, addToHistory, getHistory } from './ipc'
import { registerHotkey, registerPasteLastHotkey, unregisterAll } from './hotkeys'
import { getSettings, setSettings } from './store'
import { runDictationPipeline } from './pipeline'
import { pasteText } from './paste'
import { toUserError } from './errors'
import { logError, logInfo, getLogPath } from './log'
import { IPC } from '../shared/types'

let indicatorWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let onboardingWindow: BrowserWindow | null = null
let tray: Tray | null = null

const audioChunks: Buffer[] = []
// Session ID bumped on every new recording start. Async hide/cleanup
// callbacks check this against the ID they captured; if it has changed,
// a newer session is in progress and the callback skips its hide.
let sessionId = 0

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

// Move the indicator to the display the cursor is currently on, centered
// near the bottom. Called each time recording starts so the pill follows
// the user across monitors/spaces.
function positionIndicatorOnActiveDisplay(): void {
  if (!indicatorWindow) return
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { x: dx, y: dy, width, height } = display.workArea
  const [winW, winH] = indicatorWindow.getSize()
  const x = Math.round(dx + width / 2 - winW / 2)
  const y = Math.round(dy + height - winH - 24)
  indicatorWindow.setBounds({ x, y, width: winW, height: winH })
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
      sessionId++
      audioChunks.length = 0
      positionIndicatorOnActiveDisplay()
      indicatorWindow?.setIgnoreMouseEvents(true, { forward: true })
      indicatorWindow?.showInactive()
      broadcastState('recording')
    },
    onStop: () => {
      // Renderer transitions recording → stopping → (flush) → sends AUDIO_DONE
      broadcastState('stopping')
    },
  })

  if (settings.hotkeys.pasteLast) {
    registerPasteLastHotkey(settings.hotkeys.pasteLast, () => {
      const last = getHistory()[0]
      if (!last) {
        logInfo('Paste-last pressed with empty history')
        return
      }
      pasteText(last.cleaned).catch(err => logError('Paste-last failed', err))
    })
  }
}

function setupAudioIpc(): void {
  ipcMain.on(IPC.AUDIO_CHUNK, (_e, chunk: ArrayBuffer) => {
    audioChunks.push(Buffer.from(chunk))
  })

  ipcMain.on(IPC.AUDIO_DONE, async () => {
    const mySession = sessionId
    const audioBuffer = Buffer.concat(audioChunks)
    audioChunks.length = 0

    // Skip all further work if a newer recording has begun since this
    // AUDIO_DONE was queued — otherwise we'd hide the active indicator.
    const stillLatest = () => mySession === sessionId

    if (audioBuffer.length < 500) {
      if (stillLatest()) {
        broadcastState('idle')
        indicatorWindow?.setIgnoreMouseEvents(true, { forward: true })
        indicatorWindow?.hide()
      }
      return
    }

    try {
      const result = await runDictationPipeline(
        audioBuffer,
        getSettings(),
        (s) => { if (stillLatest()) broadcastState(s) }
      )

      addToHistory(result)
      updateTrayMenu()

      if (stillLatest()) {
        const isClipboard = result.pasteMethod === 'clipboard'
        broadcastState(isClipboard ? 'clipboard' : 'done')
        // Clipboard fallback (Accessibility denied or paste failed) needs
        // longer so the user has time to read "press ⌘V to paste" and act.
        const dismissAfter = isClipboard ? 6000 : 1500
        setTimeout(() => {
          if (stillLatest()) {
            broadcastState('idle')
            indicatorWindow?.setIgnoreMouseEvents(true, { forward: true })
            indicatorWindow?.hide()
          }
        }, dismissAfter)
      }
    } catch (err) {
      const { userMessage } = toUserError(err)
      logError('Pipeline error', err)
      if (stillLatest()) {
        broadcastState(`error:${userMessage}`)
        setTimeout(() => {
          if (stillLatest()) {
            broadcastState('idle')
            indicatorWindow?.setIgnoreMouseEvents(true, { forward: true })
            indicatorWindow?.hide()
          }
        }, 4000)
      }
    }
  })
}

function setupIpcListeners(): void {
  ipcMain.on(IPC.OPEN_SETTINGS, () => createSettingsWindow())
  ipcMain.on(IPC.OPEN_ONBOARDING, () => createOnboardingWindow())
  ipcMain.on(IPC.HOTKEYS_RELOAD, () => setupHotkeys())
  ipcMain.handle(IPC.REVEAL_LOG, () => {
    shell.showItemInFolder(getLogPath())
  })
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
