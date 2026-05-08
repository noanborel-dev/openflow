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

      {/* Three behaviors — animated. Each card loops the actual gesture
          on a small keycap so users see the timing, not just read it. */}
      <div className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-ink-45 mb-3 px-1">
        Three behaviors on one key
      </div>
      <div className="grid grid-cols-3 gap-3">
        <BehaviorCard
          label="Tap"
          desc="Toggle recording on. Tap again to stop."
          gesture="tap"
          glyph={keyGlyph}
        />
        <BehaviorCard
          label="Hold"
          desc="Record while held. Release to stop."
          gesture="hold"
          glyph={keyGlyph}
        />
        <BehaviorCard
          label="Double-tap"
          desc="Paste your most recent dictation again."
          gesture="double"
          glyph={keyGlyph}
        />
      </div>

      {/* Animation keyframes — defined once at the page level so all
          three cards share the same CSS rules. Each gesture has its
          own loop, all 3.6s total so they stay in sync visually. */}
      <style>{`
        @keyframes gestureTap {
          0%, 100%      { transform: translateY(0);   box-shadow: 0 4px 0 0 rgba(0,0,0,0.10), 0 1px 0 1px rgba(255,255,255,0.6) inset; }
          7%            { transform: translateY(3px); box-shadow: 0 1px 0 0 rgba(0,0,0,0.18), 0 1px 0 1px rgba(255,255,255,0.5) inset; }
          14%           { transform: translateY(0);   box-shadow: 0 4px 0 0 rgba(0,0,0,0.10), 0 1px 0 1px rgba(255,255,255,0.6) inset; }
        }
        @keyframes gestureHold {
          0%, 100%      { transform: translateY(0);   box-shadow: 0 4px 0 0 rgba(0,0,0,0.10), 0 1px 0 1px rgba(255,255,255,0.6) inset; }
          8%            { transform: translateY(3px); box-shadow: 0 1px 0 0 rgba(0,0,0,0.18), 0 1px 0 1px rgba(255,255,255,0.5) inset; }
          75%           { transform: translateY(3px); box-shadow: 0 1px 0 0 rgba(0,0,0,0.18), 0 1px 0 1px rgba(255,255,255,0.5) inset; }
          85%           { transform: translateY(0);   box-shadow: 0 4px 0 0 rgba(0,0,0,0.10), 0 1px 0 1px rgba(255,255,255,0.6) inset; }
        }
        @keyframes gestureDouble {
          0%, 100%      { transform: translateY(0);   box-shadow: 0 4px 0 0 rgba(0,0,0,0.10), 0 1px 0 1px rgba(255,255,255,0.6) inset; }
          6%            { transform: translateY(3px); box-shadow: 0 1px 0 0 rgba(0,0,0,0.18), 0 1px 0 1px rgba(255,255,255,0.5) inset; }
          12%           { transform: translateY(0);   box-shadow: 0 4px 0 0 rgba(0,0,0,0.10), 0 1px 0 1px rgba(255,255,255,0.6) inset; }
          18%           { transform: translateY(3px); box-shadow: 0 1px 0 0 rgba(0,0,0,0.18), 0 1px 0 1px rgba(255,255,255,0.5) inset; }
          24%           { transform: translateY(0);   box-shadow: 0 4px 0 0 rgba(0,0,0,0.10), 0 1px 0 1px rgba(255,255,255,0.6) inset; }
        }

        /* Pulse rings emitted at the moment of each "press". One per tap
           in tap/double, sustained ring during hold. The ring fades and
           expands outward — kinetic "this is the action" cue. */
        @keyframes pulseTap {
          0%, 100% { opacity: 0; transform: scale(0.8); }
          7%       { opacity: 0.5; transform: scale(1); }
          22%      { opacity: 0;   transform: scale(1.6); }
        }
        @keyframes pulseHold {
          0%, 100% { opacity: 0; transform: scale(0.8); }
          8%       { opacity: 0.5; transform: scale(1); }
          80%      { opacity: 0.3; transform: scale(1.45); }
          90%      { opacity: 0;   transform: scale(1.6); }
        }
        @keyframes pulseDouble {
          0%, 100% { opacity: 0; transform: scale(0.8); }
          6%       { opacity: 0.5; transform: scale(1); }
          14%      { opacity: 0;   transform: scale(1.5); }
          18%      { opacity: 0.5; transform: scale(1); }
          26%      { opacity: 0;   transform: scale(1.5); }
        }

        /* Timeline tracker — small bar that fills to show when the key
           is "pressed" during the loop. Read this as a piano-roll. */
        @keyframes timelineTap    { 0%, 100% { width: 0%; left: 0%; } 7%  { width: 4%; left: 14%; } 14% { width: 4%; left: 14%; opacity: 0; } 14.01% { opacity: 1; } }
        @keyframes timelineHold   { 0%, 100% { width: 0%; left: 0%; } 8%  { width: 0%; left: 14%; } 75% { width: 60%; left: 14%; } 85% { width: 60%; left: 14%; opacity: 0; } 85.01% { opacity: 1; } }
        @keyframes timelineDouble { 0%, 100% { width: 0%; left: 0%; } 6%  { width: 4%; left: 12%; } 12% { width: 4%; left: 12%; opacity: 0; } 12.01% { opacity: 1; left: 30%; } 18% { opacity: 1; width: 4%; left: 30%; } 24% { width: 4%; left: 30%; opacity: 0; } 24.01% { opacity: 1; } }

        .keycap-anim          { animation: gestureTap    3.6s ease-in-out infinite; }
        .keycap-anim.hold     { animation: gestureHold   3.6s ease-in-out infinite; }
        .keycap-anim.double   { animation: gestureDouble 3.6s ease-in-out infinite; }
        .pulse-anim           { animation: pulseTap      3.6s ease-out  infinite; }
        .pulse-anim.hold      { animation: pulseHold     3.6s ease-out  infinite; }
        .pulse-anim.double    { animation: pulseDouble   3.6s ease-out  infinite; }
        .timeline-anim        { animation: timelineTap    3.6s linear   infinite; }
        .timeline-anim.hold   { animation: timelineHold   3.6s linear   infinite; }
        .timeline-anim.double { animation: timelineDouble 3.6s linear   infinite; }
      `}</style>
    </div>
  )
}

function BehaviorCard({
  label, desc, gesture, glyph,
}: {
  label: string
  desc: string
  gesture: 'tap' | 'hold' | 'double'
  glyph: string
}) {
  const cls = gesture === 'tap' ? '' : gesture
  return (
    <div className="bg-card border border-ink-08 rounded-[14px] p-4 flex flex-col">
      {/* Animated keycap with emitting pulse ring */}
      <div className="relative h-[88px] flex items-center justify-center mb-3">
        <div className="absolute w-[58px] h-[58px] rounded-[14px] bg-[#5A8FE8]/35 pointer-events-none">
          <div
            className={`absolute inset-0 rounded-[14px] bg-[#5A8FE8]/30 pulse-anim ${cls}`}
            style={{ animationName: gesture === 'tap' ? 'pulseTap' : gesture === 'hold' ? 'pulseHold' : 'pulseDouble' }}
          />
        </div>
        <div
          className={`relative w-[52px] h-[52px] rounded-[12px] bg-paper border border-ink-08 flex items-center justify-center keycap-anim ${cls}`}
          style={{
            boxShadow: '0 4px 0 0 rgba(0,0,0,0.10), 0 1px 0 1px rgba(255,255,255,0.6) inset',
            animationName: gesture === 'tap' ? 'gestureTap' : gesture === 'hold' ? 'gestureHold' : 'gestureDouble',
          }}
        >
          <span
            className="text-[22px] leading-none text-ink font-mono"
            style={{ fontSize: glyph.length > 2 ? '14px' : '22px' }}
          >
            {glyph}
          </span>
        </div>
      </div>

      {/* Piano-roll timeline showing press timing in the loop. Helps
          users compare gesture durations at a glance. */}
      <div className="relative h-[3px] bg-ink-08 rounded-full mb-3 overflow-hidden">
        <div
          className={`absolute h-full bg-[#5A8FE8] rounded-full timeline-anim ${cls}`}
          style={{
            animationName: gesture === 'tap' ? 'timelineTap' : gesture === 'hold' ? 'timelineHold' : 'timelineDouble',
          }}
        />
      </div>

      <div className="text-[12.5px] font-semibold leading-tight">{label}</div>
      <div className="text-[11px] text-ink-60 mt-1 leading-snug">{desc}</div>
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

