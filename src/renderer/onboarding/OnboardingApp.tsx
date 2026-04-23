import { useState } from 'react'
import type { Settings } from '../../shared/types'
import { MODELS } from '../../shared/constants'
import { Pill } from '../shared/ui/Pill'

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

type Step = 1 | 2 | 3

export default function OnboardingApp() {
  const [step, setStep] = useState<Step>(1)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleGrantPermissions() {
    await window.openflow.requestMicPermission()
    await window.openflow.openAccessibilitySettings()
    setStep(2)
  }

  async function handleSaveKey() {
    setSaving(true)
    await window.openflow.setSettings({
      provider: {
        provider: 'groq',
        groqKey: apiKey.trim(),
        openaiKey: '',
        anthropicKey: '',
        transcriptionModel: MODELS.groq.transcription,
        cleanupModel: MODELS.groq.cleanup,
      },
    })
    setSaving(false)
    setStep(3)
  }

  async function handleFinish() {
    await window.openflow.setSettings({ firstRun: false })
    window.close()
  }

  return (
    <div className="min-h-screen bg-paper text-ink font-sans flex flex-col">
      <header className="px-5 pt-5">
        <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-pill bg-card border border-ink-08 shadow-sm">
          <div className="w-5 h-5 rounded-[6px] bg-ink text-paper flex items-center justify-center text-[10px] font-bold">O</div>
          <span className="text-[13px] font-semibold tracking-tight">OpenFlow</span>
          <span className="font-mono text-[10.5px] text-ink-45 ml-2">0{step} / 03</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center px-10 pb-10">
        {step === 1 && (
          <>
            <h1 className="text-[42px] leading-[0.98] tracking-tight mb-4">
              Grant <span className="font-display italic font-medium">access.</span>
            </h1>
            <p className="text-[13.5px] text-ink-60 leading-relaxed max-w-[360px] mb-7">
              OpenFlow needs your microphone to hear you, and Accessibility so it can paste text into the focused app.
            </p>
            <div className="flex items-center gap-3">
              <Pill variant="primary" onClick={handleGrantPermissions}>
                Grant access <span>→</span>
              </Pill>
              <button onClick={() => setStep(2)} className="text-[12px] text-ink-45 hover:text-ink">
                Skip
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-[42px] leading-[0.98] tracking-tight mb-4">
              Connect your <span className="font-display italic font-medium">key.</span>
            </h1>
            <p className="text-[13.5px] text-ink-60 leading-relaxed max-w-[360px] mb-5">
              Paste your Groq key. Free tier works for most people — heavy use runs about $1–3/month.
            </p>
            <div className="max-w-[380px] mb-5">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-45 mb-1.5">
                Groq API Key
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="gsk_…"
                className="w-full bg-card border border-ink-08 rounded-input px-3 py-2.5 text-[13px] font-mono focus:outline-none focus:border-ink"
              />
              <a
                onClick={() => window.open('https://console.groq.com', '_blank')}
                className="text-[11px] text-ink-45 hover:text-ink mt-2 inline-block cursor-pointer"
              >
                Get a free key at console.groq.com ↗
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Pill
                variant="primary"
                onClick={handleSaveKey}
                disabled={saving || !apiKey.trim()}
              >
                {saving ? 'Saving…' : 'Continue →'}
              </Pill>
              <button onClick={() => setStep(3)} className="text-[12px] text-ink-45 hover:text-ink">
                Skip for now
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-[42px] leading-[0.98] tracking-tight mb-4">
              Start <span className="font-display italic font-medium">speaking.</span>
            </h1>
            <p className="text-[13.5px] text-ink-60 leading-relaxed max-w-[380px] mb-7">
              Hold <kbd className="font-mono text-[12px] bg-card border border-ink-08 px-1.5 py-0.5 rounded">⌃ Ctrl</kbd> anywhere and speak. Release to paste. Double-tap to lock on.
            </p>
            <div>
              <Pill variant="primary" onClick={handleFinish}>
                Start using OpenFlow
              </Pill>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
