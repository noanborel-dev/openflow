import { useEffect, useState } from 'react'
import type { Settings } from '../../../shared/types'

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

// Render a key as the glyph(s) we want shown inside the keycap chip.
// Modifier names map to their canonical macOS symbols + label.
function keyDisplay(name: string): string {
  if (name === 'CTRL') return '⌃'
  if (name === 'ALT') return '⌥'
  if (name === 'SHIFT') return '⇧'
  if (name === 'META') return '⌘'
  if (name === 'SPACE') return 'space'
  if (name === ' ') return 'space'
  return name.toLowerCase()
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

  const keyGlyph = keyDisplay(hotkeys.pushToTalk)

  return (
    <div className="max-w-[640px] space-y-5">
      {/* Hero card — dark charcoal panel that breaks the cream surrounding
          surface. Cobalt-glow keycap, animated pulse on the keycap mimics
          the "hold to dictate" gesture. Click the keycap to rebind. */}
      <div className="relative overflow-hidden rounded-[18px] p-7 bg-[#0E1118]"
           style={{
             backgroundImage:
               'radial-gradient(circle at 12% 0%, rgba(90,143,232,0.22), transparent 55%), ' +
               'radial-gradient(circle at 100% 100%, rgba(90,143,232,0.10), transparent 50%)',
           }}>
        <div className="flex items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-[#5A8FE8] mb-3">
              Primary · push to talk
            </div>
            <div className="text-[34px] font-bold tracking-tight leading-[1.05] text-white">
              {listening ? 'Press any key…' : 'Hold to dictate.'}
            </div>
            <div className="text-[12px] font-mono text-white/55 mt-2 tracking-wider">
              release ↘ cleanup ↘ paste
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Keycap glyph={keyGlyph} active={listening} onClick={() => setListening(l => !l)} />
            <button
              onClick={() => setListening(l => !l)}
              className="px-3 py-2 text-[10.5px] font-mono uppercase tracking-[0.14em] text-white/55 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg transition-colors"
            >
              ↺ rebind
            </button>
          </div>
        </div>
      </div>

      {/* Behavior cheatsheet — kept as a quiet card under the hero so the
          hero stays the visual anchor. */}
      <div className="bg-card border border-ink-08 rounded-card p-5 space-y-2.5 text-[12.5px] text-ink-60">
        <div className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-ink-45 mb-2">
          Three behaviors on one key
        </div>
        <Behavior label="tap" desc="Toggle recording on. Tap again to stop." />
        <Behavior label="hold" desc="Record while held. Release to stop." />
        <Behavior label="double-tap" desc="Paste your most recent dictation again." />
      </div>
    </div>
  )
}

function Keycap({
  glyph,
  active,
  onClick,
}: {
  glyph: string
  active: boolean
  onClick: () => void
}) {
  // The keycap pulses gently when idle so it reads as the "press me"
  // affordance. When listening for a new bind, the glow intensifies and
  // the inner label switches to a hint.
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative h-[58px] min-w-[64px] px-4 rounded-[12px] flex items-center justify-center',
        'bg-[#15192498] border-2 transition-all duration-200',
        active
          ? 'border-[#7BA3F0] scale-[1.02]'
          : 'border-[#2B3A5A] hover:border-[#4A6FB5]',
        'animate-keycap-pulse',
      ].join(' ')}
      style={{
        boxShadow: active
          ? '0 0 0 4px rgba(123,163,240,0.18), 0 0 22px rgba(123,163,240,0.5), inset 0 1px 0 rgba(255,255,255,0.08)'
          : '0 0 0 0 rgba(123,163,240,0), 0 0 14px rgba(90,143,232,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <span
        className={[
          'text-[20px] leading-none font-mono',
          active ? 'text-[#9DBEF5]' : 'text-[#BCD0F2]',
          glyph.length > 2 ? 'text-[14px]' : '',
        ].join(' ')}
        style={{
          textShadow: active
            ? '0 0 12px rgba(157,190,245,0.7)'
            : '0 0 8px rgba(123,163,240,0.4)',
        }}
      >
        {glyph}
      </span>
      <style>{`
        @keyframes keycap-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(123,163,240,0), 0 0 14px rgba(90,143,232,0.25), inset 0 1px 0 rgba(255,255,255,0.06); }
          50%      { box-shadow: 0 0 0 0 rgba(123,163,240,0), 0 0 22px rgba(90,143,232,0.42), inset 0 1px 0 rgba(255,255,255,0.10); }
        }
        .animate-keycap-pulse:not(:hover) {
          animation: keycap-pulse 2.6s ease-in-out infinite;
        }
      `}</style>
    </button>
  )
}

function Behavior({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-mono text-[10.5px] text-ink-45 uppercase tracking-[0.14em] w-[80px] shrink-0">
        {label}
      </span>
      <span>{desc}</span>
    </div>
  )
}
