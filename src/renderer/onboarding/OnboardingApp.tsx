import { useState } from 'react'
import type { Settings } from '../../shared/types'

// window.openflow is declared in AIProviderTab — both use the same preload
// Redeclare here for this file's scope
declare global {
  interface Window {
    openflow: {
      getSettings: () => Promise<Settings>
      setSettings: (p: Partial<Settings>) => Promise<void>
      testProvider: (provider: string, key: string) => Promise<{ ok: boolean; error?: string }>
      getHistory: () => Promise<unknown>
      requestMicPermission: () => Promise<boolean>
      openAccessibilitySettings: () => Promise<void>
      reloadHotkeys: () => void
      onStateChange: (cb: (state: string) => void) => () => void
    }
  }
}

type Step = 'mic' | 'accessibility' | 'hotkey' | 'apikey' | 'done'

function Screen({
  step,
  total,
  title,
  subtitle,
  children,
}: {
  step: number
  total: number
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-5 text-center">
      <div className="text-xs text-white/30">{step} of {total}</div>
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      <p className="text-white/60 text-sm leading-relaxed max-w-xs mx-auto">{subtitle}</p>
      <div className="flex flex-col gap-3 pt-2">{children}</div>
    </div>
  )
}

export default function OnboardingApp() {
  const [step, setStep] = useState<Step>('mic')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleMicPermission() {
    await window.openflow.requestMicPermission()
    setStep('accessibility')
  }

  async function handleApiKeySave() {
    if (!apiKey.trim()) { setStep('done'); return }
    setSaving(true)
    await window.openflow.setSettings({
      provider: { provider: 'groq', groqKey: apiKey.trim(), openaiKey: '', anthropicKey: '', transcriptionModel: 'whisper-large-v3-turbo', cleanupModel: 'llama-3.3-70b-versatile' },
    })
    setSaving(false)
    setStep('done')
  }

  async function handleFinish() {
    await window.openflow.setSettings({ firstRun: false })
    window.close()
  }

  const STEP_NUMS: Record<Step, number> = { mic: 1, accessibility: 2, hotkey: 3, apikey: 4, done: 5 }
  const n = STEP_NUMS[step]

  return (
    <div className="min-h-screen bg-[#1c1c1e] flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm">
        {step === 'mic' && (
          <Screen step={n} total={5} title="Microphone Access" subtitle="OpenFlow needs your mic to record dictation.">
            <button onClick={handleMicPermission} className="btn-primary">Grant Access</button>
            <button onClick={() => setStep('accessibility')} className="btn-ghost">Skip</button>
          </Screen>
        )}
        {step === 'accessibility' && (
          <Screen step={n} total={5} title="Accessibility Access" subtitle="Needed to automatically paste text at your cursor. Click the button below — macOS will prompt you to allow access.">
            <button onClick={() => window.openflow.openAccessibilitySettings()} className="btn-primary">Allow Access</button>
            <button onClick={() => setStep('hotkey')} className="btn-ghost">Done / Skip</button>
          </Screen>
        )}
        {step === 'hotkey' && (
          <Screen step={n} total={5} title="Your Hotkey" subtitle="Hold Right Option (⌥) anywhere to start dictating. Release to transcribe and paste.">
            <div className="px-6 py-4 bg-white/10 rounded-xl text-center font-mono text-xl text-white">
              Right ⌥
            </div>
            <button onClick={() => setStep('apikey')} className="btn-primary">Got it</button>
          </Screen>
        )}
        {step === 'apikey' && (
          <Screen step={n} total={5} title="Your API Key" subtitle="OpenFlow uses Groq by default — free, fast, and private.">
            <a
              className="text-blue-400 text-sm cursor-pointer"
              onClick={() => window.open('https://console.groq.com', '_blank')}
            >
              Get a free Groq key ↗
            </a>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="gsk_…"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-sm font-mono text-white placeholder-white/30"
            />
            <button onClick={handleApiKeySave} disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? 'Saving…' : 'Continue'}
            </button>
            <button onClick={() => setStep('done')} className="btn-ghost">Skip for now</button>
          </Screen>
        )}
        {step === 'done' && (
          <Screen step={n} total={5} title="You're all set!" subtitle="Press and hold Right Option (⌥) anywhere and speak. Release to see your text appear.">
            <button onClick={handleFinish} className="btn-primary">Start Using OpenFlow</button>
          </Screen>
        )}
      </div>
    </div>
  )
}
