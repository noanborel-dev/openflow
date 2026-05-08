import { useState } from 'react'
import GeneralTab from './tabs/GeneralTab'
import HotkeysTab from './tabs/HotkeysTab'
import AIProviderTab from './tabs/AIProviderTab'
import DictionaryTab from './tabs/DictionaryTab'
import PolishTab from './tabs/PolishTab'
import StyleTab from './tabs/StyleTab'
import AboutTab from './tabs/AboutTab'

const TABS = ['Provider', 'Hotkey', 'Polish', 'Style', 'Dictionary', 'General', 'About'] as const
type Tab = typeof TABS[number]

const TITLES: Record<Tab, { title: string; italic: string; sub: string }> = {
  Provider:   { title: 'Your',  italic: 'provider.',    sub: 'Transcription + cleanup service' },
  Hotkey:     { title: 'Your',  italic: 'hotkey.',      sub: 'Tap · hold · double-tap' },
  Polish:     { title: 'Your',  italic: 'polish.',      sub: 'How aggressively to clean each context' },
  Style:      { title: 'Your',  italic: 'style.',       sub: 'Three registers · same voice' },
  Dictionary: { title: 'Your',  italic: 'dictionary.',  sub: 'Bias Whisper toward terms it mishears' },
  General:    { title: 'Your',  italic: 'preferences.', sub: 'How OpenFlow should behave' },
  About:      { title: 'About', italic: 'OpenFlow.',    sub: 'Version & diagnostics' },
}

export default function SettingsApp() {
  const [tab, setTab] = useState<Tab>('Provider')
  const titleInfo = TITLES[tab]

  return (
    <div className="flex h-screen bg-paper text-ink select-none font-sans">
      <aside className="w-[200px] bg-[#F2F0E8] border-r border-ink-08 pt-9 px-3 flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-2 pb-4 mb-3 border-b border-ink-08">
          <div className="w-6 h-6 rounded-[6px] bg-ink text-paper flex items-center justify-center text-[11px] font-bold font-display italic">O</div>
          <span className="text-[13.5px] font-semibold tracking-tight">OpenFlow</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {TABS.map((t) => {
            const on = tab === t
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-left px-2.5 py-2 rounded-[8px] text-[12.5px] transition ${
                  on ? 'bg-ink text-paper' : 'text-ink-60 hover:bg-ink-08'
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-volt' : 'bg-ink/25'}`} />
                  {t}
                </span>
              </button>
            )
          })}
        </nav>
        <div className="mt-auto pb-3 px-2 pt-3 border-t border-ink-08 flex items-center justify-between text-[10px] font-mono text-ink-45">
          <span>v0.1.0</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-ok" />
            connected
          </span>
        </div>
      </aside>

      <main className="flex-1 overflow-auto px-8 py-8">
        <h1 className="text-[34px] leading-none tracking-tight">
          {titleInfo.title}{' '}
          <span className="font-display italic font-medium">{titleInfo.italic}</span>
        </h1>
        <p className="text-[12px] text-ink-60 mt-2 mb-6 leading-relaxed max-w-[58ch]">{titleInfo.sub}</p>

        {tab === 'Provider' && <AIProviderTab />}
        {tab === 'Hotkey' && <HotkeysTab />}
        {tab === 'Polish' && <PolishTab />}
        {tab === 'Style' && <StyleTab />}
        {tab === 'Dictionary' && <DictionaryTab />}
        {tab === 'General' && <GeneralTab />}
        {tab === 'About' && <AboutTab />}
      </main>
    </div>
  )
}
