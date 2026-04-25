import { useEffect, useState } from 'react'
import type { Settings } from '../../../shared/types'
import { Card, Row } from '../../shared/ui/Card'
import { Pill } from '../../shared/ui/Pill'

// Map a browser KeyboardEvent to a single canonical key name for the
// push-to-talk hotkey. Returns null for chords / unsupported keys.
function eventToSingleKey(e: KeyboardEvent): string | null {
  const code = e.code
  if (code === 'ControlLeft' || code === 'ControlRight') return 'CTRL'
  if (code === 'AltLeft' || code === 'AltRight') return 'ALT'
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT'
  if (code === 'MetaLeft' || code === 'MetaRight') return 'META'
  if (e.key.length === 1) return e.key.toUpperCase()
  if (/^F\d{1,2}$/.test(e.key)) return e.key.toUpperCase()
  return null
}

// Map a browser KeyboardEvent to a chord string like "CTRL+SHIFT+V" for
// the paste-last hotkey. Requires at least one modifier + a non-modifier.
function eventToChord(e: KeyboardEvent): string | null {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('CTRL')
  if (e.shiftKey) parts.push('SHIFT')
  if (e.altKey) parts.push('ALT')
  if (e.metaKey) parts.push('META')
  const key = e.key
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return null
  if (key.length === 1) parts.push(key.toUpperCase())
  else if (/^F\d{1,2}$/.test(key)) parts.push(key.toUpperCase())
  else return null
  if (parts.length < 2) return null // need at least one modifier
  return parts.join('+')
}

function prettifyKey(name: string): string {
  if (name === 'CTRL') return '⌃ Ctrl'
  if (name === 'ALT') return '⌥ Option'
  if (name === 'SHIFT') return '⇧ Shift'
  if (name === 'META') return '⌘ Command'
  return name
}

function prettifyChord(chord: string): string {
  if (!chord) return 'Not set'
  return chord.split('+').map(part => {
    if (part === 'CTRL') return '⌃'
    if (part === 'SHIFT') return '⇧'
    if (part === 'ALT') return '⌥'
    if (part === 'META') return '⌘'
    return part
  }).join('')
}

type ListeningField = 'pushToTalk' | 'pasteLast' | null

export default function HotkeysTab() {
  const [hotkeys, setHotkeys] = useState<Settings['hotkeys'] | null>(null)
  const [listening, setListening] = useState<ListeningField>(null)

  useEffect(() => {
    window.openflow.getSettings().then(s => setHotkeys(s.hotkeys))
  }, [])

  useEffect(() => {
    if (!listening) return
    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault()
      const next = listening === 'pushToTalk'
        ? eventToSingleKey(e)
        : eventToChord(e)
      if (!next) return
      setHotkeys(prev => {
        if (!prev) return prev
        const updated = { ...prev, [listening!]: next }
        window.openflow.setSettings({ hotkeys: updated }).then(() => {
          window.openflow.reloadHotkeys()
        })
        return updated
      })
      setListening(null)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [listening])

  if (!hotkeys) return <div className="text-ink-45 text-sm">Loading…</div>

  return (
    <div className="max-w-md space-y-3">
      <Card>
        <Row>
          <div className="flex-1">
            <div className="text-[12.5px] font-medium">Push-to-talk</div>
            <div className="text-[10.5px] text-ink-45 mt-0.5">
              Hold to talk. Double-tap to lock recording on.
            </div>
          </div>
          <Pill
            variant={listening === 'pushToTalk' ? 'volt' : 'secondary'}
            onClick={() => setListening(l => l === 'pushToTalk' ? null : 'pushToTalk')}
          >
            <span className="font-mono text-[11px]">
              {listening === 'pushToTalk'
                ? 'Press any key…'
                : prettifyKey(hotkeys.pushToTalk)}
            </span>
          </Pill>
        </Row>
        <Row>
          <div className="flex-1">
            <div className="text-[12.5px] font-medium">Paste last transcription</div>
            <div className="text-[10.5px] text-ink-45 mt-0.5">
              Re-pastes your most recent dictation. Chord required.
            </div>
          </div>
          <Pill
            variant={listening === 'pasteLast' ? 'volt' : 'secondary'}
            onClick={() => setListening(l => l === 'pasteLast' ? null : 'pasteLast')}
          >
            <span className="font-mono text-[11px]">
              {listening === 'pasteLast'
                ? 'Press chord…'
                : prettifyChord(hotkeys.pasteLast)}
            </span>
          </Pill>
        </Row>
      </Card>
      {listening && (
        <button
          onClick={() => setListening(null)}
          className="text-ink-45 text-xs hover:text-ink"
        >
          Cancel
        </button>
      )}
    </div>
  )
}
