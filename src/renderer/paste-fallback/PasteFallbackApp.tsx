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

function prettifyKey(name: string): string {
  if (name === 'CTRL') return '⌃ Ctrl'
  if (name === 'ALT') return '⌥ Option'
  if (name === 'SHIFT') return '⇧ Shift'
  if (name === 'META') return '⌘ Command'
  return name
}

export default function PasteFallbackApp() {
  // text is what OpenFlow tried to paste. hotkey is the bound key, surfaced
  // in the message so users can connect "I pressed ⌃ Ctrl, it didn't paste"
  // to this dialog. retrying flips during the brief delay between click
  // and the actual paste attempt.
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

  const keyDisplay = prettifyKey(hotkey)
  const preview = text.length > 110 ? text.slice(0, 110) + '…' : text

  return (
    <div
      className="min-h-screen w-screen bg-paper text-ink font-sans flex flex-col p-4"
      style={{ borderRadius: 16 }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-[9.5px] font-mono uppercase tracking-[0.18em] text-[#C94A2A]">
          Couldn't paste
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-ink-45 hover:text-ink leading-none text-[14px] -mt-1"
        >
          ×
        </button>
      </div>

      <div className="font-display italic text-[20px] leading-[1.1] tracking-tight mb-2">
        Your text is on the clipboard.
      </div>
      <div className="text-[11.5px] text-ink-60 leading-snug mb-3">
        Click into your text field, then press{' '}
        <span className="font-mono text-ink bg-card border border-ink-08 px-1.5 py-0.5 rounded text-[10.5px]">
          ⌘ V
        </span>
        {' '}— or use{' '}
        <span className="font-mono text-ink bg-card border border-ink-08 px-1.5 py-0.5 rounded text-[10.5px]">
          {keyDisplay}
        </span>
        {' '}again. We can also insert it for you:
      </div>

      {/* Preview the cleaned text so the user knows what's on the
          clipboard before they decide whether to paste again. */}
      <div className="bg-card border border-ink-08 rounded-[10px] px-3 py-2 text-[11.5px] text-ink mb-3 max-h-[60px] overflow-hidden leading-snug">
        {preview}
      </div>

      <div className="flex items-center gap-2 mt-auto">
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="flex-1 bg-ink text-paper rounded-pill px-4 py-2 text-[12.5px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {retrying ? 'Inserting…' : 'Insert text →'}
        </button>
        <button
          onClick={handleDismiss}
          className="text-[11px] text-ink-45 hover:text-ink px-3 py-2"
        >
          Close
        </button>
      </div>
      {retryFailed && (
        <div className="text-[10.5px] text-danger mt-2 leading-snug">
          Still no luck — make sure a text field is focused, then try again.
        </div>
      )}
    </div>
  )
}
