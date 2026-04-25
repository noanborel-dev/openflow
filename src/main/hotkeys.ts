import { GlobalKeyboardListener, IGlobalKeyDownMap } from 'node-global-key-listener'
import { HOTKEY_TIMING } from '../shared/constants'

type Callbacks = {
  onStart: () => void
  onStop: () => void
}

// Module-level state. Only one hotkey active at a time.
let listener: GlobalKeyboardListener | null = null
let currentKey: string | null = null
let callbacks: Callbacks | null = null

// Secondary "chord tap" hotkey state — e.g. paste-last.
// Separate from the hold-to-talk primary key; fires once on keydown when
// the chord's non-modifier key is pressed with all required modifiers held.
let chordBinding: string | null = null       // e.g. "CTRL+SHIFT+V"
let chordCallback: (() => void) | null = null
let lastChordFireAt = 0                       // debounce OS auto-repeat

// Interaction state machine state
let pressedAt = 0         // timestamp of current keydown, 0 if not pressed
let lastTapAt = 0         // timestamp of last short tap (for double-tap detection)
let locked = false        // true after a double-tap until next press releases it
let active = false        // true while a recording session is in progress (start fired, stop not yet)

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

// Parse a chord string like "CTRL+SHIFT+V" into its modifier set and main key.
// Returns null if the binding is empty or malformed.
function parseChord(binding: string): { mods: Set<string>; key: string } | null {
  if (!binding) return null
  const parts = binding.trim().toUpperCase().split('+').map(p => p.trim()).filter(Boolean)
  if (parts.length === 0) return null
  const key = parts[parts.length - 1]
  const mods = new Set(parts.slice(0, -1))
  return { mods, key }
}

function modHeld(mod: string, down: IGlobalKeyDownMap): boolean {
  if (mod === 'CTRL')  return Boolean(down['LEFT CTRL']  || down['RIGHT CTRL'])
  if (mod === 'SHIFT') return Boolean(down['LEFT SHIFT'] || down['RIGHT SHIFT'])
  if (mod === 'ALT' || mod === 'OPTION') return Boolean(down['LEFT ALT'] || down['RIGHT ALT'])
  if (mod === 'META' || mod === 'COMMAND' || mod === 'CMD') return Boolean(down['LEFT META'] || down['RIGHT META'])
  return false
}

function handleChord(e: { name?: string; state?: string }, down: IGlobalKeyDownMap): boolean {
  if (e.state !== 'DOWN') return false
  const parsed = chordBinding ? parseChord(chordBinding) : null
  if (!parsed || !chordCallback) return false
  if ((e.name ?? '').toUpperCase() !== parsed.key) return false
  for (const m of parsed.mods) {
    if (!modHeld(m, down)) return false
  }
  const now = Date.now()
  if (now - lastChordFireAt < 300) return false // debounce
  lastChordFireAt = now
  chordCallback()
  return true
}

export function registerPasteLastHotkey(chord: string, onFire: () => void): void {
  chordBinding = chord
  chordCallback = onFire
}

export function registerHotkey(key: string, cbs: Callbacks): void {
  // Tear down primary + chord state so re-registering the hold hotkey
  // doesn't double-install listeners. Chord registration, if any, must
  // be re-applied by the caller after this.
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

  listener = new GlobalKeyboardListener()

  listener.addListener((e, down) => {
    // Chord tap handling runs first and independently of the hold state.
    if (handleChord(e, down)) return

    if (!currentKey || !callbacks) return
    if (!keyMatches(currentKey, e.name ?? '')) return

    const now = Date.now()

    if (e.state === 'DOWN') {
      // Ignore auto-repeat: OS fires DOWN repeatedly while held.
      if (pressedAt !== 0) return
      pressedAt = now

      // Locked mode: pressing while locked ends the session.
      if (locked) {
        locked = false
        fireStop()
        return
      }

      // Double-tap detection: two DOWN events within window => enter lock.
      if (lastTapAt !== 0 && now - lastTapAt <= HOTKEY_TIMING.dblTapWindowMs) {
        lastTapAt = 0
        locked = true
        // If we weren't already recording (tap was too short to cross holdThreshold), start now.
        fireStart()
        return
      }

      // Normal hold: start recording. (We start on DOWN immediately for
      // responsiveness; the holdThreshold gate only matters on UP.)
      fireStart()
    } else if (e.state === 'UP') {
      if (pressedAt === 0) return
      const held = now - pressedAt
      pressedAt = 0

      if (locked) {
        // Stay active. UP during a locked session is ignored.
        return
      }

      if (held < HOTKEY_TIMING.holdThresholdMs) {
        // Short press: discard this recording attempt and remember the tap
        // for possible double-tap.
        lastTapAt = now
        // Cancel the start we fired on DOWN by firing stop — but the pipeline
        // will naturally no-op on empty audio (main/index.ts already guards
        // `audioBuffer.length < 500`).
        fireStop()
        return
      }

      // Real hold: fire stop.
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
}

export function unregisterAll(): void {
  unregisterHotkey()
  chordBinding = null
  chordCallback = null
  lastChordFireAt = 0
}
