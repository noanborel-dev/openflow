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
  // text is what OpenFlow tried to paste. retrying flips during the
  // brief delay between Insert-button click and the actual paste attempt.
  const [text, setText] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [retryFailed, setRetryFailed] = useState(false)
  const dismissRef = useRef<number | null>(null)

  // Listen for new fallback events from main. Each new event resets the
  // dismiss timer (15s) and clears any previous retry state.
  useEffect(() => {
    return window.pasteFallback.onShow((payload) => {
      setText(payload.text)
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

      {/* The instruction: just the keys to press, animated. No prose. */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <AnimatedKey label="⌘" order={0} />
        <span className="text-ink-45 text-[12px]">+</span>
        <AnimatedKey label="V" order={1} />
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
        @keyframes pasteKeyPress {
          0%, 100%      { transform: translateY(0);   box-shadow: 0 3px 0 0 rgba(0,0,0,0.10), 0 1px 0 1px rgba(255,255,255,0.6) inset; }
          /* Each key has its own press window inside a shared 2.4s loop.
             order=0 (⌘) presses at 15-30%, order=1 (V) at 35-50%. */
        }
        @keyframes pressKey0 {
          0%, 100%   { transform: translateY(0);   box-shadow: 0 3px 0 0 rgba(0,0,0,0.10), 0 1px 0 1px rgba(255,255,255,0.6) inset; }
          15%        { transform: translateY(2px); box-shadow: 0 1px 0 0 rgba(0,0,0,0.16), 0 1px 0 1px rgba(255,255,255,0.5) inset; }
          30%        { transform: translateY(2px); box-shadow: 0 1px 0 0 rgba(0,0,0,0.16), 0 1px 0 1px rgba(255,255,255,0.5) inset; }
          45%        { transform: translateY(0);   box-shadow: 0 3px 0 0 rgba(0,0,0,0.10), 0 1px 0 1px rgba(255,255,255,0.6) inset; }
        }
        @keyframes pressKey1 {
          0%, 100%   { transform: translateY(0);   box-shadow: 0 3px 0 0 rgba(0,0,0,0.10), 0 1px 0 1px rgba(255,255,255,0.6) inset; }
          25%        { transform: translateY(0);   box-shadow: 0 3px 0 0 rgba(0,0,0,0.10), 0 1px 0 1px rgba(255,255,255,0.6) inset; }
          40%        { transform: translateY(2px); box-shadow: 0 1px 0 0 rgba(0,0,0,0.16), 0 1px 0 1px rgba(255,255,255,0.5) inset; }
          55%        { transform: translateY(2px); box-shadow: 0 1px 0 0 rgba(0,0,0,0.16), 0 1px 0 1px rgba(255,255,255,0.5) inset; }
          70%        { transform: translateY(0);   box-shadow: 0 3px 0 0 rgba(0,0,0,0.10), 0 1px 0 1px rgba(255,255,255,0.6) inset; }
        }
        .anim-key-0 { animation: pressKey0 2.4s ease-in-out infinite; }
        .anim-key-1 { animation: pressKey1 2.4s ease-in-out infinite; }
      `}</style>
    </div>
  )
}

// A single keycap that "presses" on a staggered loop so ⌘ + V reads
// as a sequence the user should mimic. Each key has its own keyframe
// timed off the same 2.4s clock.
function AnimatedKey({ label, order }: { label: string; order: 0 | 1 }) {
  return (
    <div
      className={`anim-key-${order} flex items-center justify-center bg-card border border-ink-08 rounded-[10px] min-w-[42px] h-[42px] px-3 font-mono text-[16px] text-ink leading-none`}
      style={{ boxShadow: '0 3px 0 0 rgba(0,0,0,0.10), 0 1px 0 1px rgba(255,255,255,0.6) inset' }}
    >
      {label}
    </div>
  )
}
