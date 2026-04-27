import { GlobalKeyboardListener } from 'node-global-key-listener'
import { HOTKEY_TIMING } from '../shared/constants'

type Callbacks = {
  onStart: () => void
  onStop: () => void
  onAbort: () => void          // recording in progress should be discarded
  onPasteLast: () => void      // double-tap: paste most recent dictation
}

// Module-level state. Only one hotkey active at a time.
let listener: GlobalKeyboardListener | null = null
let currentKey: string | null = null
let callbacks: Callbacks | null = null

// Interaction state machine state.
//
// Three behaviors on the same key:
//  - HOLD: press + hold => record while held; release stops.
//  - SINGLE TAP (toggle): tap once, recording stays on until next press.
//  - DOUBLE TAP: two presses within dblTapWindowMs => paste last
//    transcription. Any recording in progress when the second tap
//    arrives is aborted (no paste from this session).
//
// Because we can't predict whether a press is "first of double-tap" or
// "single tap that turns on recording", we start recording immediately
// on every DOWN. If a second DOWN arrives in time, we abort that fresh
// recording and fire pasteLast instead. The user sees a brief flicker
// of the indicator on a true double-tap — acceptable for the simpler
// mental model.
let pressedAt = 0      // timestamp of current keydown, 0 if not pressed
let lastTapAt = 0      // timestamp of last tap-toggle release (for double-tap detection)
let locked = false     // true while a tap-toggle session is in progress (after a tap)
let active = false     // true while a recording session is live (start fired, stop not yet)
let pendingPasteLast = false  // double-tap detected on this DOWN; fire onPasteLast on the matching UP

// Map the user-facing key name to the set of node-global-key-listener key names
// that should match. "CTRL" matches either LEFT or RIGHT control.
function keyMatches(saved: string, eventName: string): boolean {
  if (!saved) return false
  const norm = saved.trim().toUpperCase()
  if (norm === 'CTRL') return eventName === 'LEFT CTRL' || eventName === 'RIGHT CTRL'
  if (norm === 'ALT' || norm === 'OPTION') return eventName === 'LEFT ALT' || eventName === 'RIGHT ALT'
  if (norm === 'SHIFT') return eventName === 'LEFT SHIFT' || eventName === 'RIGHT SHIFT'
  if (norm === 'META' || norm === 'COMMAND' || norm === 'CMD') return eventName === 'LEFT META' || eventName === 'RIGHT META'
  return eventName === norm
}

function fireStart(): void {
  if (active) return
  active = true
  callbacks?.onStart()
}

function fireStop(): void {
  if (!active) return
  active = false
  callbacks?.onStop()
}

function fireAbort(): void {
  if (!active) return
  active = false
  callbacks?.onAbort()
}

export function registerHotkey(key: string, cbs: Callbacks): void {
  if (listener) {
    listener.kill()
    listener = null
  }
  currentKey = key
  callbacks = cbs
  pressedAt = 0
  lastTapAt = 0
  locked = false
  active = false
  pendingPasteLast = false

  listener = new GlobalKeyboardListener()

  listener.addListener((e) => {
    if (!currentKey || !callbacks) return
    if (!keyMatches(currentKey, e.name ?? '')) return

    const now = Date.now()

    if (e.state === 'DOWN') {
      // Ignore OS auto-repeat while held.
      if (pressedAt !== 0) return
      pressedAt = now

      // Double-tap window: this is the SECOND press within the window
      // since the prior tap. Abort whatever just started (and the locked
      // tap-toggle session if there was one) and paste the last
      // transcription instead.
      //
      // We DO NOT fire onPasteLast here yet — when the hotkey is a
      // modifier (Option, Ctrl, etc.), the modifier is physically held
      // at this moment, and injecting ⌘V on top of it produces
      // ⌥⌘V / ⌃⌘V which most apps don't bind (or worse: bind to
      // "paste and match style"). We defer to the matching UP so the
      // modifier is fully released before pasteText fires.
      if (lastTapAt !== 0 && now - lastTapAt <= HOTKEY_TIMING.dblTapWindowMs) {
        lastTapAt = 0
        const wasLocked = locked
        locked = false
        if (wasLocked) {
          // The first tap entered tap-toggle mode and recording is still
          // live from that earlier session — abort it; user wants paste.
          fireAbort()
        }
        pendingPasteLast = true
        return
      }

      // If we're already locked from a prior tap, this press ends that
      // session normally (tap toggle off).
      if (locked) {
        locked = false
        fireStop()
        return
      }

      // Otherwise: start of a new recording. Could be a hold or a tap;
      // UP will decide.
      fireStart()
    } else if (e.state === 'UP') {
      if (pressedAt === 0) return
      const held = now - pressedAt
      pressedAt = 0

      if (pendingPasteLast) {
        // Hotkey now released — safe to inject ⌘V.
        pendingPasteLast = false
        callbacks.onPasteLast()
        return
      }

      if (locked) {
        // UP during an already-locked tap-toggle session is irrelevant.
        return
      }

      if (held < HOTKEY_TIMING.holdThresholdMs) {
        // Quick tap: enter tap-toggle mode and remember the timestamp
        // so a follow-up press within dblTapWindowMs counts as double-tap.
        locked = true
        lastTapAt = now
        return
      }

      // Real hold: release stops recording, no double-tap window.
      lastTapAt = 0
      fireStop()
    }
  })
}

export function unregisterHotkey(): void {
  if (listener) {
    listener.kill()
    listener = null
  }
  currentKey = null
  callbacks = null
  pressedAt = 0
  lastTapAt = 0
  locked = false
  active = false
  pendingPasteLast = false
}

export function unregisterAll(): void {
  unregisterHotkey()
}
