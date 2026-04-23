export default function AboutTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">About OpenFlow</h2>
      <p className="text-ink-60 text-sm leading-relaxed">
        Free, open-source voice dictation. Press and hold a hotkey, speak, and your
        cleaned-up text appears wherever your cursor is.
      </p>
      <div className="space-y-1 text-sm text-ink-45">
        <div>Version 0.1.0</div>
        <div>MIT License</div>
        <div
          className="text-blue-400 cursor-pointer"
          onClick={() => window.open('https://github.com/openflow-app/openflow', '_blank')}
        >
          github.com/openflow-app/openflow ↗
        </div>
      </div>
      <div className="pt-4 text-xs text-ink-45 leading-relaxed">
        Your voice goes from your mic to your API provider. OpenFlow never sees or stores
        your audio, transcripts, or API keys on any server we control.
      </div>
    </div>
  )
}
