import { useEffect, useState } from 'react'
import type { Settings } from '../../../shared/types'
import { Card, Row } from '../../shared/ui/Card'
import { Pill } from '../../shared/ui/Pill'

// Map a browser KeyboardEvent to a single canonical key name.
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

function prettifyKey(name: string): string {
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
      const next = eventToSingleKey(e)
      if (!next) return
      setHotkeys(prev => {
        if (!prev) return prev
        const updated = { ...prev, pushToTalk: next }
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
            <div className="text-[12.5px] font-medium">Your key</div>
            <div className="text-[10.5px] text-ink-45 mt-0.5">
              One key, three behaviors.
            </div>
          </div>
          <Pill
            variant={listening ? 'volt' : 'secondary'}
            onClick={() => setListening(l => !l)}
          >
            <span className="font-mono text-[11px]">
              {listening ? 'Press any key…' : prettifyKey(hotkeys.pushToTalk)}
            </span>
          </Pill>
        </Row>
      </Card>

      <div className="bg-card border border-ink-08 rounded-card p-4 space-y-2.5 text-[12px] text-ink-60">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10.5px] text-ink-45 uppercase tracking-wider w-[68px] shrink-0">tap</span>
          <span>Toggle recording on. Tap again to stop.</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10.5px] text-ink-45 uppercase tracking-wider w-[68px] shrink-0">hold</span>
          <span>Record while held. Release to stop.</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10.5px] text-ink-45 uppercase tracking-wider w-[68px] shrink-0">double-tap</span>
          <span>Paste your most recent dictation again.</span>
        </div>
      </div>

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
