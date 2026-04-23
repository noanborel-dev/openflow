export default function HotkeysTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Hotkeys</h2>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between items-center py-2 border-b border-white/10">
          <span className="text-white/70">Push-to-talk</span>
          <kbd className="px-2 py-1 bg-white/10 rounded text-xs font-mono">Right ⌥</kbd>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-white/10">
          <span className="text-white/70">Command mode</span>
          <kbd className="px-2 py-1 bg-white/10 rounded text-xs font-mono">⌘⇧Space</kbd>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-white/10">
          <span className="text-white/70">Paste last dictation</span>
          <kbd className="px-2 py-1 bg-white/10 rounded text-xs font-mono">⌘⇧V</kbd>
        </div>
      </div>
      <p className="text-white/30 text-xs">Custom hotkey binding coming in a future update.</p>
    </div>
  )
}
