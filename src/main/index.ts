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
import { registerHotkey, unregisterAll } from './hotkeys'
import { getSettings, setSettings } from './store'
import { runDictationPipeline } from './pipeline'
import { captureFocusedApp } from './focused-app'
import { pasteText, prewarmPasteHelper, shutdownPasteHelper } from './paste'
import { toUserError } from './errors'
import { logError, logInfo, getLogPath } from './log'
import { IPC } from '../shared/types'

let indicatorWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let onboardingWindow: BrowserWindow | null = null
let pasteFallbackWindow: BrowserWindow | null = null
let tray: Tray | null = null

// When paste falls back to clipboard, remember the cleaned text so the
// fallback window's Insert button can retry the same paste. Cleared on
// dismiss + on every successful paste.
let lastUnpastedText: string | null = null

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
    // hasShadow: false eliminates the macOS native rectangular window
    // shadow that traces the BrowserWindow bounds and produces a faint
    // outline around the rounded pill. Our pill renders its own
    // drop-shadow that follows its actual shape.
    hasShadow: false,
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

  // Show the indicator on every macOS Space — including fullscreen apps.
  // Without this the window is pinned to the Space it was created on, so
  // swiping to another desktop loses sight of it. setAlwaysOnTop with the
  // 'screen-saver' level pierces fullscreen-app layering as well.
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  if (process.platform === 'darwin') {
    win.setAlwaysOnTop(true, 'screen-saver')
  }

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

  // Re-assert visibility-on-all-spaces every show. macOS occasionally
  // loses the collectionBehavior flag after a window has been hidden,
  // moved, or after Spaces are added/removed — without re-asserting,
  // the pill ends up pinned to the Space it was last shown on.
  // setAlwaysOnTop with the 'screen-saver' level pierces fullscreen-app
  // layering as well.
  indicatorWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  if (process.platform === 'darwin') {
    indicatorWindow.setAlwaysOnTop(true, 'screen-saver')
  }
}

function createSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return settingsWindow
  }

  const win = new BrowserWindow({
    // Sized to fit the redesigned hero cards comfortably without
    // forcing scroll on the most common tabs (Provider, Polish, About).
    width: 980,
    height: 740,
    minWidth: 820,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    // Inset the traffic lights so they sit centered in our 30px drag
    // strip — without this they collide with the OpenFlow wordmark in
    // the sidebar.
    trafficLightPosition: { x: 14, y: 14 },
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
    width: 880,
    height: 680,
    resizable: false,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
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

// Small bottom-right popup that appears whenever paste falls back to
// clipboard — usually because Accessibility was denied, the focused app
// doesn't accept simulated keystrokes, or focus changed mid-pipeline.
// Created on demand, kept around until dismissed.
function createPasteFallbackWindow(): BrowserWindow {
  if (pasteFallbackWindow && !pasteFallbackWindow.isDestroyed()) {
    return pasteFallbackWindow
  }

  // Position near the bottom-right of the active display so it sits out
  // of the way of the user's text field but stays in the same screen
  // they're typing in.
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { x: dx, y: dy, width, height } = display.workArea
  const W = 360
  const H = 240
  const x = Math.round(dx + width - W - 24)
  const y = Math.round(dy + height - H - 80)

  const win = new BrowserWindow({
    width: W,
    height: H,
    x,
    y,
    frame: false,
    transparent: true,
    hasShadow: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: true,   // user needs to click the Insert button
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/paste-fallback.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Same Spaces / fullscreen behavior as the indicator — the fallback
  // shouldn't be lost when the user is on a non-primary Space.
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  if (process.platform === 'darwin') {
    win.setAlwaysOnTop(true, 'floating')
  }

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/paste-fallback/index.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/paste-fallback/index.html'))
  }

  win.on('closed', () => { pasteFallbackWindow = null })
  pasteFallbackWindow = win
  return win
}

function showPasteFallback(text: string): void {
  lastUnpastedText = text
  const win = createPasteFallbackWindow()
  const hotkey = getSettings().hotkeys.pushToTalk
  // The renderer subscribes to 'show' events; we always push a fresh
  // payload so a subsequent paste-failure reuses the same window.
  const send = () => win.webContents.send(IPC.PASTE_FALLBACK_SHOW, { text, hotkey })
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', send)
  } else {
    send()
  }
  if (!win.isVisible()) win.showInactive()
}

function dismissPasteFallback(): void {
  lastUnpastedText = null
  if (pasteFallbackWindow && !pasteFallbackWindow.isDestroyed()) {
    pasteFallbackWindow.hide()
  }
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
    { label: 'Reopen Onboarding…', click: () => createOnboardingWindow() },
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
      // Warm the focused-app cache while the user is speaking. The
      // pipeline reads it synchronously when AUDIO_DONE arrives.
      captureFocusedApp()
      positionIndicatorOnActiveDisplay()
      indicatorWindow?.setIgnoreMouseEvents(true, { forward: true })
      indicatorWindow?.showInactive()
      broadcastState('recording')
    },
    onStop: () => {
      // Renderer transitions recording → stopping → (flush) → sends AUDIO_DONE
      broadcastState('stopping')
    },
    onAbort: () => {
      // Double-tap arrived while a recording was live — discard the
      // pending audio. Bumping sessionId makes the eventual AUDIO_DONE
      // skip its work via stillLatest().
      //
      // We DO broadcast 'stopping' so the renderer stops its MediaRecorder
      // (otherwise it'd keep capturing forever). We do NOT schedule a hide;
      // onPasteLast — which fires immediately after — owns the visible
      // state transition. Scheduling a hide here caused a race where the
      // 'done' pill from paste-last appeared and then got hidden 100ms
      // later, leaving the user thinking nothing happened.
      sessionId++
      audioChunks.length = 0
      broadcastState('stopping')
    },
    onPasteLast: () => {
      const last = getHistory()[0]
      logInfo('Paste-last triggered', { hasHistory: Boolean(last) })
      if (!last) {
        broadcastState('error:nothing to paste')
        positionIndicatorOnActiveDisplay()
        indicatorWindow?.showInactive()
        setTimeout(() => {
          broadcastState('idle')
          indicatorWindow?.hide()
        }, 1800)
        return
      }
      pasteText(last.cleaned)
        .then(({ method }) => {
          positionIndicatorOnActiveDisplay()
          indicatorWindow?.showInactive()
          broadcastState(method === 'clipboard' ? 'clipboard' : 'done')
          setTimeout(() => {
            broadcastState('idle')
            indicatorWindow?.hide()
          }, method === 'clipboard' ? 6000 : 1500)
        })
        .catch(err => logError('Paste-last failed', err))
    },
  })
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
        // Clipboard fallback (Accessibility denied or paste failed) gets
        // a dedicated popup window with a click-to-insert affordance.
        // The pill itself dismisses on its normal short timer; the
        // popup hangs around for 15s on its own clock.
        if (isClipboard) {
          showPasteFallback(result.cleaned)
        }
        const dismissAfter = isClipboard ? 2200 : 1500
        setTimeout(() => {
          if (stillLatest()) {
            broadcastState('idle')
            indicatorWindow?.setIgnoreMouseEvents(true, { forward: true })
            indicatorWindow?.hide()
          }
        }, dismissAfter)
      }
    } catch (err) {
      const userErr = toUserError(err)
      // NO_SPEECH is expected user behavior (held the key, didn't talk),
      // not a true error — log info-level and dismiss faster than a real
      // pipeline failure.
      if (userErr.code === 'NO_SPEECH') {
        logInfo('No speech detected')
      } else {
        logError('Pipeline error', err)
      }
      if (stillLatest()) {
        broadcastState(`error:${userErr.userMessage}`)
        const dismissAfter = userErr.code === 'NO_SPEECH' ? 2200 : 4000
        setTimeout(() => {
          if (stillLatest()) {
            broadcastState('idle')
            indicatorWindow?.setIgnoreMouseEvents(true, { forward: true })
            indicatorWindow?.hide()
          }
        }, dismissAfter)
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

  // Paste fallback retry: the popup window's Insert button calls this
  // after the user has had a chance to focus their target text field.
  // We re-run pasteText with the stashed cleaned text; on success the
  // popup closes itself.
  ipcMain.handle(IPC.PASTE_FALLBACK_RETRY, async () => {
    if (!lastUnpastedText) return false
    const { method } = await pasteText(lastUnpastedText)
    const success = method === 'paste'
    if (success) dismissPasteFallback()
    return success
  })
  ipcMain.on(IPC.PASTE_FALLBACK_DISMISS, () => dismissPasteFallback())
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
  // Pre-spawn the AppleScript helper so the first paste doesn't pay
  // the ~120ms process-spawn tax.
  prewarmPasteHelper()

  const settings = getSettings()
  if (settings.firstRun) {
    createOnboardingWindow()
  }
})

app.on('window-all-closed', () => {
  // Intentionally empty — app lives in tray
})

app.on('before-quit', () => {
  shutdownPasteHelper()
})
