export default function AboutTab() {
  return (
    <div className="space-y-4 max-w-md">
      <p className="text-ink-60 text-sm leading-relaxed">
        Free, open-source voice dictation. Press and hold a hotkey, speak, and your
        cleaned-up text appears wherever your cursor is.
      </p>
      <div className="space-y-1 text-sm text-ink-45">
        <div>Version 0.1.0</div>
        <div>MIT License</div>
        <div
          className="text-ink hover:opacity-70 cursor-pointer underline underline-offset-2"
          onClick={() => window.open('https://github.com/openflow-app/openflow', '_blank')}
        >
          github.com/openflow-app/openflow ↗
        </div>
        <div
          className="text-ink hover:opacity-70 cursor-pointer underline underline-offset-2 pt-2"
          onClick={() => window.openflow.revealLog()}
        >
          Reveal log file ↗
        </div>
      </div>
      <div className="pt-4 text-xs text-ink-45 leading-relaxed">
        Your voice goes from your mic to your API provider. OpenFlow never sees or stores
        your audio, transcripts, or API keys on any server we control.
      </div>
    </div>
  )
}
