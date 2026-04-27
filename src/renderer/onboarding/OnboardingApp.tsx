import { useEffect, useState } from 'react'
import type { Settings } from '../../shared/types'
import { MODELS } from '../../shared/constants'
import { Pill } from '../shared/ui/Pill'

type Step = 1 | 2 | 3

function eventToSingleKey(e: KeyboardEvent): string | null {
  const code = e.code
  if (code === 'ControlLeft' || code === 'ControlRight') return 'CTRL'
  if (code === 'AltLeft' || code === 'AltRight') return 'ALT'
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT'
  if (code === 'MetaLeft' || code === 'MetaRight') return 'META'
  if (e.key.length === 1) return e.key.toUpperCase()
  if (/^F\d{1,2}$/.test(e.key)) return e.key.toUpperCase()
  return null
}

function prettifyKey(name: string): string {
  if (name === 'CTRL') return '⌃ Ctrl'
  if (name === 'ALT') return '⌥ Option'
  if (name === 'SHIFT') return '⇧ Shift'
  if (name === 'META') return '⌘ Command'
  return name
}

export default function OnboardingApp() {
  const [step, setStep] = useState<Step>(1)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [hotkey, setHotkey] = useState<string>('CTRL')
  const [listening, setListening] = useState(false)

  useEffect(() => {
    if (!listening) return
    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault()
      const next = eventToSingleKey(e)
      if (!next) return
      setHotkey(next)
      setListening(false)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [listening])

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
    // Persist whatever hotkey the user picked + flip firstRun off; reload
    // so the new key is active immediately.
    await window.openflow.setSettings({
      hotkeys: { pushToTalk: hotkey },
      firstRun: false,
    })
    window.openflow.reloadHotkeys()
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
                className="w-full bg-card border border-ink-08 rounded-input px-3 py-2.5 text-[13px] font-mono focus:outline-none focus:border-volt focus:ring-2 focus:ring-volt-muted"
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
              Pick your <span className="font-display italic font-medium">key.</span>
            </h1>
            <p className="text-[13.5px] text-ink-60 leading-relaxed max-w-[400px] mb-5">
              One key, three behaviors. Click the pill below and press whatever key feels natural — Ctrl is the default.
            </p>

            <div className="mb-6">
              <Pill
                variant={listening ? 'volt' : 'secondary'}
                onClick={() => setListening(l => !l)}
              >
                <span className="font-mono text-[12px]">
                  {listening ? 'Press any key…' : prettifyKey(hotkey)}
                </span>
              </Pill>
            </div>

            <div className="bg-card border border-ink-08 rounded-card p-4 max-w-[440px] mb-6 space-y-2.5 text-[12.5px] text-ink-60">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[10.5px] text-ink-45 uppercase tracking-wider w-[78px] shrink-0">tap</span>
                <span>Toggle recording on. Tap again to stop.</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[10.5px] text-ink-45 uppercase tracking-wider w-[78px] shrink-0">hold</span>
                <span>Record while held. Release to stop.</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[10.5px] text-ink-45 uppercase tracking-wider w-[78px] shrink-0">double-tap</span>
                <span>Paste your most recent dictation again.</span>
              </div>
            </div>

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
