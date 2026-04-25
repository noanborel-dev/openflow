import { useState } from 'react'
import GeneralTab from './tabs/GeneralTab'
import HotkeysTab from './tabs/HotkeysTab'
import AIProviderTab from './tabs/AIProviderTab'
import DictionaryTab from './tabs/DictionaryTab'
import AboutTab from './tabs/AboutTab'

const TABS = ['Provider', 'Hotkey', 'Dictionary', 'General', 'About'] as const
type Tab = typeof TABS[number]

const TITLES: Record<Tab, { title: string; italic: string; sub: string }> = {
  Provider:   { title: 'Your',  italic: 'provider.',    sub: 'Transcription + cleanup service' },
  Hotkey:     { title: 'Your',  italic: 'hotkey.',      sub: 'Hold to talk · double-tap to lock' },
  Dictionary: { title: 'Your',  italic: 'dictionary.',  sub: 'Bias Whisper toward terms it mishears' },
  General:    { title: 'Your',  italic: 'preferences.', sub: 'How OpenFlow should behave' },
  About:      { title: 'About', italic: 'OpenFlow.',    sub: 'Version & diagnostics' },
}

export default function SettingsApp() {
  const [tab, setTab] = useState<Tab>('Provider')
  const titleInfo = TITLES[tab]

  return (
    <div className="flex h-screen bg-paper text-ink select-none font-sans">
      <aside className="w-[180px] bg-[#F2F0E8] border-r border-ink-08 pt-10 px-3 flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-2 pb-4 mb-3 border-b border-ink-08">
          <div className="w-5 h-5 rounded-[6px] bg-ink text-paper flex items-center justify-center text-[10px] font-bold">O</div>
          <span className="text-[13px] font-semibold tracking-tight">OpenFlow</span>
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
                  <span className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-volt' : 'bg-ink/30'}`} />
                  {t}
                </span>
              </button>
            )
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto px-7 py-7">
        <h1 className="text-[30px] leading-none tracking-tight">
          {titleInfo.title}{' '}
          <span className="font-display italic font-medium">{titleInfo.italic}</span>
        </h1>
        <p className="text-[11.5px] text-ink-45 mt-1 mb-5">{titleInfo.sub}</p>

        {tab === 'Provider' && <AIProviderTab />}
        {tab === 'Hotkey' && <HotkeysTab />}
        {tab === 'Dictionary' && <DictionaryTab />}
        {tab === 'General' && <GeneralTab />}
        {tab === 'About' && <AboutTab />}
      </main>
    </div>
  )
}
