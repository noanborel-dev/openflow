import { useEffect, useRef, useState } from 'react'
import type { Settings } from '../../../shared/types'
import { MiniPill } from '../../shared/ui/MiniPill'

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
    <div className="max-w-[760px] space-y-5">
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

      {/* Three behaviors — ported from the landing-page section.
          One panel is "on" at a time (cream-orange tint), cycling every
          4s. Each panel runs its own scripted gesture sequence on the
          keycap with a MiniPill that switches from "listening" to
          "pasted" mid-loop. */}
      <ThreeBehaviors glyph={keyGlyph} />
    </div>
  )
}

// ---------- Three Behaviors (ported from OpenFlowLanding) ----------

type Mode = 'tap' | 'hold' | 'double'

interface PanelState {
  pressed: boolean
  holding: boolean
  tapped: boolean
  pillVisible: boolean
  pillDone: boolean
}

const INITIAL_PANEL_STATE: PanelState = {
  pressed: false,
  holding: false,
  tapped: false,
  pillVisible: false,
  pillDone: false,
}

const PANELS: Array<{ mode: Mode; ord: string; name: string; oneLiner: string }> = [
  { mode: 'tap',    ord: '01', name: 'Tap',        oneLiner: 'Toggle recording on. Tap again to stop.' },
  { mode: 'hold',   ord: '02', name: 'Hold',       oneLiner: 'Record while held. Release to finish.' },
  { mode: 'double', ord: '03', name: 'Double-tap', oneLiner: 'Paste your last dictation again.' },
]

function ThreeBehaviors({ glyph }: { glyph: string }) {
  const [active, setActive] = useState<Mode>('tap')
  const [panels, setPanels] = useState<Record<Mode, PanelState>>({
    tap: { ...INITIAL_PANEL_STATE },
    hold: { ...INITIAL_PANEL_STATE },
    double: { ...INITIAL_PANEL_STATE, pillDone: true },
  })
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  function cleanup() {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }
  function schedule(fn: () => void, delay: number) {
    const t = setTimeout(fn, delay)
    timeoutsRef.current.push(t)
  }
  function setPanel(mode: Mode, patch: Partial<PanelState>) {
    setPanels(prev => ({ ...prev, [mode]: { ...prev[mode], ...patch } }))
  }
  function resetPanel(mode: Mode) {
    if (mode === 'double') {
      setPanel(mode, { ...INITIAL_PANEL_STATE, pillDone: true })
    } else {
      setPanel(mode, INITIAL_PANEL_STATE)
    }
  }

  useEffect(() => {
    cleanup()
    ;(Object.keys(panels) as Mode[]).forEach(m => { if (m !== active) resetPanel(m) })
    resetPanel(active)

    if (active === 'tap') {
      schedule(() => setPanel('tap', { pressed: true, tapped: true }), 400)
      schedule(() => setPanel('tap', { pressed: false, tapped: false }), 600)
      schedule(() => setPanel('tap', { pillVisible: true }), 450)
      schedule(() => setPanel('tap', { pressed: true, tapped: true }), 2800)
      schedule(() => setPanel('tap', { pressed: false, tapped: false }), 3000)
      schedule(() => setPanel('tap', { pillDone: true }), 2900)
    } else if (active === 'hold') {
      schedule(() => setPanel('hold', { pressed: true, holding: true, pillVisible: true }), 400)
      schedule(() => setPanel('hold', { pressed: false, holding: false, pillDone: true }), 2800)
    } else if (active === 'double') {
      schedule(() => setPanel('double', { pressed: true, tapped: true }), 800)
      schedule(() => setPanel('double', { pressed: false, tapped: false }), 950)
      schedule(() => setPanel('double', { pressed: true, tapped: true }), 1020)
      schedule(() => setPanel('double', { pressed: false, tapped: false }), 1170)
      schedule(() => setPanel('double', { pillVisible: true }), 1030)
    }

    schedule(() => {
      const order: Mode[] = ['tap', 'hold', 'double']
      const next = order[(order.indexOf(active) + 1) % 3]
      setActive(next)
    }, 4000)

    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return (
    <div
      className="bg-paper border border-ink-08 rounded-[18px] grid grid-cols-3 overflow-hidden"
      style={{ boxShadow: '0 30px 60px -30px rgba(20,30,50,0.18)', minHeight: 360 }}
    >
      <style>{`
        @keyframes tb-ripple   { 0% { transform: scale(0.85); border-color: rgba(200,85,61,0.55); opacity: 1; } 100% { transform: scale(1.25); border-color: rgba(200,85,61,0); opacity: 0; } }
        @keyframes tb-hold-ring{ 0% { transform: scale(0.95); opacity: 0.7; } 100% { transform: scale(1.18); opacity: 0; } }
        @keyframes tb-progress { from { width: 0; } to { width: 100%; } }
        .tb-keycap-anim.tap .tb-keycap-ripple { animation: tb-ripple 0.5s ease-out; }
        .tb-keycap-anim.holding::after {
          content: ""; position: absolute; inset: -10px;
          border-radius: 28px; border: 1.5px solid rgba(200,85,61,0.5);
          animation: tb-hold-ring 1.4s ease-out infinite;
          pointer-events: none;
        }
        .tb-progress-anim { animation: tb-progress 4s linear; }
      `}</style>

      {PANELS.map(p => {
        const s = panels[p.mode]
        const isOn = active === p.mode
        return (
          <div
            key={p.mode}
            className={[
              'relative flex flex-col gap-6 px-7 py-9 border-r border-ink-08 last:border-r-0 transition-colors duration-300',
              isOn ? 'bg-[#FFF7F3]' : 'bg-paper',
            ].join(' ')}
          >
            {/* Numbered eyebrow */}
            <div className={[
              'text-[10.5px] font-mono uppercase tracking-[0.14em]',
              isOn ? 'text-[#C8553D]' : 'text-ink-45',
            ].join(' ')}>
              {p.ord}
            </div>

            {/* Italic serif title */}
            <div
              className="text-[44px] leading-[0.95] tracking-tight text-ink"
              style={{
                fontStyle: 'italic',
                fontFamily: '"Instrument Serif", Georgia, serif',
              }}
            >
              {p.name}
            </div>

            <div className="text-[13px] text-ink-60 leading-snug -mt-3">
              {p.oneLiner}
            </div>

            {/* Keycap + pill, anchored to the bottom */}
            <div className="flex flex-col items-center gap-3.5 mt-auto">
              <div
                className={[
                  'relative tb-keycap-anim',
                  s.pressed ? 'pressed' : '',
                  s.holding ? 'holding' : '',
                  s.tapped ? 'tap' : '',
                ].join(' ')}
                style={{
                  width: 92, height: 92, borderRadius: 16,
                  background: 'linear-gradient(180deg, #fdfbf3 0%, #e9e1c8 100%)',
                  border: '1px solid #c5bda0',
                  boxShadow: s.pressed
                    ? '0 1px 0 #b8af90, 0 3px 6px rgba(0,0,0,0.08), inset 0 2px 0 rgba(255,255,255,0.7)'
                    : '0 6px 0 #b8af90, 0 10px 20px rgba(0,0,0,0.1), inset 0 2px 0 rgba(255,255,255,0.7)',
                  transform: s.pressed ? 'translateY(5px)' : 'translateY(0)',
                  transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span
                  className="tb-keycap-ripple"
                  style={{
                    position: 'absolute', inset: -8, borderRadius: 24,
                    border: '1.5px solid rgba(200,85,61,0)', pointerEvents: 'none',
                  }}
                />
                <span
                  className="font-mono text-ink leading-none"
                  style={{ fontSize: glyph.length > 2 ? '18px' : '30px', fontWeight: 500 }}
                >
                  {glyph}
                </span>
                {(glyph === '⌃' || glyph === '⌥' || glyph === '⇧' || glyph === '⌘') && (
                  <span
                    className="absolute font-mono text-ink-45 uppercase"
                    style={{
                      bottom: 8, left: '50%', transform: 'translateX(-50%)',
                      fontSize: 8, letterSpacing: '0.1em',
                    }}
                  >
                    {glyph === '⌃' ? 'Control' : glyph === '⌥' ? 'Option' : glyph === '⇧' ? 'Shift' : 'Command'}
                  </span>
                )}
              </div>

              <div
                style={{
                  opacity: isOn && (s.pillVisible || s.pillDone) ? 1 : 0,
                  transition: 'opacity 0.35s',
                }}
              >
                <MiniPill state={s.pillDone ? 'done' : 'listening'} />
              </div>
            </div>

            {/* Bottom progress bar — fills over the 4s the panel is active */}
            <span
              key={isOn ? `${p.mode}-on` : `${p.mode}-off`}
              className={[
                'absolute left-0 bottom-0 h-[2px] bg-[#C8553D]',
                isOn ? 'tb-progress-anim' : '',
              ].join(' ')}
              style={{ width: isOn ? undefined : 0 }}
            />
          </div>
        )
      })}
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

