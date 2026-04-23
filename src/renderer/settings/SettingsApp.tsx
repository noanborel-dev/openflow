import { useState } from 'react'
import GeneralTab from './tabs/GeneralTab'
import HotkeysTab from './tabs/HotkeysTab'
import AIProviderTab from './tabs/AIProviderTab'
import PerAppRulesTab from './tabs/PerAppRulesTab'
import AboutTab from './tabs/AboutTab'

const TABS = ['General', 'Hotkeys', 'AI Provider', 'Per-App Rules', 'About'] as const
type Tab = typeof TABS[number]

export default function SettingsApp() {
  const [tab, setTab] = useState<Tab>('AI Provider')

  return (
    <div className="flex h-screen bg-[#1c1c1e] text-white select-none">
      <div className="w-44 pt-10 px-3 border-r border-white/10 flex flex-col gap-1 shrink-0">
        <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider px-2 mb-2">Settings</p>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
              tab === t ? 'bg-blue-600 text-white' : 'text-white/70 hover:bg-white/10'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-6">
        {tab === 'General' && <GeneralTab />}
        {tab === 'Hotkeys' && <HotkeysTab />}
        {tab === 'AI Provider' && <AIProviderTab />}
        {tab === 'Per-App Rules' && <PerAppRulesTab />}
        {tab === 'About' && <AboutTab />}
      </div>
    </div>
  )
}
