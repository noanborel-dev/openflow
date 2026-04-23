import { useEffect, useState } from 'react'
import type { Settings } from '../../../shared/types'

function keyEventToString(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.metaKey) parts.push('Command')
  if (e.ctrlKey) parts.push('Control')
  if (e.altKey) parts.push('Option')
  if (e.shiftKey) parts.push('Shift')

  const key = e.key
  // Ignore pure modifier presses
  if (['Meta', 'Control', 'Alt', 'Shift'].includes(key)) return ''

  // Map browser key names to node-global-key-listener names
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    'Enter': 'Return',
    'Escape': 'Escape',
    'Backspace': 'Backspace',
    'Tab': 'Tab',
    'ArrowUp': 'Up',
    'ArrowDown': 'Down',
    'ArrowLeft': 'Left',
    'ArrowRight': 'Right',
  }
  parts.push(keyMap[key] ?? key.toUpperCase())
  return parts.join('+')
}

function formatForDisplay(binding: string): string {
  return binding
    .replace('Command', '⌘')
    .replace('Option', '⌥')
    .replace('Control', '⌃')
    .replace('Shift', '⇧')
    .replace(/\+/g, '')
}

type HotkeyField = 'pushToTalk' | 'pasteLast'

export default function HotkeysTab() {
  const [hotkeys, setHotkeys] = useState<Settings['hotkeys'] | null>(null)
  const [recording, setRecording] = useState<HotkeyField | null>(null)

  useEffect(() => {
    window.openflow.getSettings().then(s => setHotkeys(s.hotkeys))
  }, [])

  useEffect(() => {
    if (!recording) return

    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault()
      const binding = keyEventToString(e)
      if (!binding) return

      setHotkeys(prev => {
        if (!prev) return prev
        const updated = { ...prev, [recording!]: binding }
        window.openflow.setSettings({ hotkeys: updated }).then(() => {
          window.openflow.reloadHotkeys()
        })
        return updated
      })
      setRecording(null)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [recording])

  if (!hotkeys) return <div className="text-white/50 text-sm">Loading…</div>

  const rows: { label: string; field: HotkeyField }[] = [
    { label: 'Push-to-talk', field: 'pushToTalk' },
    { label: 'Paste last dictation', field: 'pasteLast' },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Hotkeys</h2>
      <div className="space-y-3 text-sm">
        {rows.map(({ label, field }) => (
          <div key={field} className="flex justify-between items-center py-2 border-b border-white/10">
            <span className="text-white/70">{label}</span>
            <button
              onClick={() => setRecording(field)}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                recording === field
                  ? 'bg-blue-600 text-white animate-pulse'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              {recording === field ? 'Press any key…' : formatForDisplay(hotkeys[field])}
            </button>
          </div>
        ))}
        <div className="flex justify-between items-center py-2 border-b border-white/10">
          <span className="text-white/70">Command mode</span>
          <kbd className="px-2 py-1 bg-white/10 rounded text-xs font-mono">⌘⇧Space</kbd>
        </div>
      </div>
      {recording && (
        <button onClick={() => setRecording(null)} className="text-white/30 text-xs hover:text-white/60">
          Cancel
        </button>
      )}
    </div>
  )
}
