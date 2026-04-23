import { useEffect, useState } from 'react'
import type { Settings } from '../../../shared/types'
import { Card, Row } from '../../shared/ui/Card'
import { Pill } from '../../shared/ui/Pill'

// Map a browser KeyboardEvent.code to the node-global-key-listener canonical name.
// We only accept modifier keys or function/letter keys — NOT chords.
function eventToKeyName(e: KeyboardEvent): string | null {
  const code = e.code
  if (code === 'ControlLeft' || code === 'ControlRight') return 'CTRL'
  if (code === 'AltLeft' || code === 'AltRight') return 'ALT'
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT'
  if (code === 'MetaLeft' || code === 'MetaRight') return 'META'
  // Letters, digits, F-keys — use .key (uppercased)
  if (e.key.length === 1) return e.key.toUpperCase()
  if (/^F\d{1,2}$/.test(e.key)) return e.key.toUpperCase()
  return null
}

function prettify(name: string): string {
  if (name === 'CTRL') return '⌃ Ctrl'
  if (name === 'ALT') return '⌥ Option'
  if (name === 'SHIFT') return '⇧ Shift'
  if (name === 'META') return '⌘ Command'
  return name
}

export default function HotkeysTab() {
  const [hotkeys, setHotkeys] = useState<Settings['hotkeys'] | null>(null)
  const [listening, setListening] = useState(false)

  useEffect(() => {
    window.openflow.getSettings().then(s => setHotkeys(s.hotkeys))
  }, [])

  useEffect(() => {
    if (!listening) return
    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault()
      const name = eventToKeyName(e)
      if (!name) return
      setHotkeys(prev => {
        if (!prev) return prev
        const updated = { ...prev, pushToTalk: name }
        window.openflow.setSettings({ hotkeys: updated }).then(() => {
          window.openflow.reloadHotkeys()
        })
        return updated
      })
      setListening(false)
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
            variant={listening ? 'volt' : 'secondary'}
            onClick={() => setListening(l => !l)}
          >
            <span className="font-mono text-[11px]">
              {listening ? 'Press any key…' : prettify(hotkeys.pushToTalk)}
            </span>
          </Pill>
        </Row>
      </Card>
      {listening && (
        <button
          onClick={() => setListening(false)}
          className="text-ink-45 text-xs hover:text-ink"
        >
          Cancel
        </button>
      )}
    </div>
  )
}
