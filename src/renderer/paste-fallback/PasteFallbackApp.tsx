import { useEffect, useRef, useState } from 'react'

interface PasteFallbackPayload {
  text: string
  hotkey: string
}

declare global {
  interface Window {
    pasteFallback: {
      onShow: (cb: (payload: PasteFallbackPayload) => void) => () => void
      retry: () => Promise<boolean>
      dismiss: () => void
    }
  }
}

export default function PasteFallbackApp() {
  // text is what Yappr tried to paste. retrying flips during the
  // brief delay between Insert-button click and the actual paste attempt.
  const [text, setText] = useState('')
  const [hotkey, setHotkey] = useState('CTRL')
  const [retrying, setRetrying] = useState(false)
  const [retryFailed, setRetryFailed] = useState(false)
  const dismissRef = useRef<number | null>(null)

  // Listen for new fallback events from main. Each new event resets the
  // dismiss timer (15s) and clears any previous retry state.
  useEffect(() => {
    return window.pasteFallback.onShow((payload) => {
      setText(payload.text)
      setHotkey(payload.hotkey)
      setRetrying(false)
      setRetryFailed(false)
      if (dismissRef.current) window.clearTimeout(dismissRef.current)
      dismissRef.current = window.setTimeout(() => {
        window.pasteFallback.dismiss()
      }, 15000)
    })
  }, [])

  async function handleRetry() {
    setRetrying(true)
    setRetryFailed(false)
    // Small delay so the user has a beat to click into their target
    // text field before paste fires. Apple Events keystroke needs the
    // destination app to be frontmost.
    await new Promise((r) => window.setTimeout(r, 80))
    const ok = await window.pasteFallback.retry()
    setRetrying(false)
    if (!ok) setRetryFailed(true)
  }

  function handleDismiss() {
    if (dismissRef.current) window.clearTimeout(dismissRef.current)
    window.pasteFallback.dismiss()
  }

  const preview = text.length > 110 ? text.slice(0, 110) + '…' : text

  return (
    <div
      className="min-h-screen w-screen bg-paper text-ink font-sans flex flex-col p-4"
      style={{ borderRadius: 16 }}
    >
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="absolute top-2.5 right-3 text-ink-45 hover:text-ink leading-none text-[15px] w-6 h-6 flex items-center justify-center"
      >
        ×
      </button>

      {/* The cleaned text we couldn't paste. Sits at the top so the
          user can glance at what they were about to send. */}
      <div className="bg-card border border-ink-08 rounded-[10px] px-3.5 py-2.5 text-[12px] text-ink mb-4 max-h-[64px] overflow-hidden leading-snug mt-1">
        {preview}
      </div>

      {/* The instruction: double-tap the hotkey to paste again. Animated
          keycap presses twice per loop to read as a double-tap. */}
      <div className="flex items-center justify-center gap-2 mb-1">
        <DoubleTapKey label={keyGlyph(hotkey)} />
      </div>
      <div className="text-[10.5px] text-ink-45 text-center mb-4">
        double-tap to paste
      </div>

      <button
        onClick={handleRetry}
        disabled={retrying}
        className="bg-ink text-paper rounded-pill px-4 py-2.5 text-[12.5px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 mt-auto"
      >
        {retrying ? 'Inserting…' : 'Insert for me'}
      </button>
      {retryFailed && (
        <div className="text-[10.5px] text-danger mt-2 leading-snug text-center">
          Focus a text field, then try again.
        </div>
      )}
      <style>{`
        @keyframes doubleTapPress {
          0%, 100%   { transform: translateY(0);   box-shadow: 0 3px 0 0 rgba(0,0,0,0.10), 0 1px 0 1px rgba(255,255,255,0.6) inset; }
          10%        { transform: translateY(2px); box-shadow: 0 1px 0 0 rgba(0,0,0,0.16), 0 1px 0 1px rgba(255,255,255,0.5) inset; }
          22%        { transform: translateY(0);   box-shadow: 0 3px 0 0 rgba(0,0,0,0.10), 0 1px 0 1px rgba(255,255,255,0.6) inset; }
          32%        { transform: translateY(2px); box-shadow: 0 1px 0 0 rgba(0,0,0,0.16), 0 1px 0 1px rgba(255,255,255,0.5) inset; }
          44%        { transform: translateY(0);   box-shadow: 0 3px 0 0 rgba(0,0,0,0.10), 0 1px 0 1px rgba(255,255,255,0.6) inset; }
        }
        .anim-double-tap { animation: doubleTapPress 2.4s ease-in-out infinite; }
      `}</style>
    </div>
  )
}

// Render the bound hotkey as the glyph we show on the keycap. Mirrors
// the formatter in HotkeysTab so the keycap matches what the settings
// pane shows for the same binding.
function keyGlyph(name: string): string {
  if (name === 'CTRL') return '⌃'
  if (name === 'ALT') return '⌥'
  if (name === 'SHIFT') return '⇧'
  if (name === 'META') return '⌘'
  if (name === 'SPACE' || name === ' ') return 'space'
  return name.toLowerCase()
}

// A single keycap that "presses" twice per loop, miming the double-tap
// gesture the user should perform to re-paste.
function DoubleTapKey({ label }: { label: string }) {
  return (
    <div
      className="anim-double-tap flex items-center justify-center bg-card border border-ink-08 rounded-[10px] min-w-[42px] h-[42px] px-3 font-mono text-[16px] text-ink leading-none"
      style={{ boxShadow: '0 3px 0 0 rgba(0,0,0,0.10), 0 1px 0 1px rgba(255,255,255,0.6) inset' }}
    >
      {label}
    </div>
  )
}
