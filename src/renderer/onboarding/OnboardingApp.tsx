import { useEffect, useMemo, useState } from 'react'
import type { Settings, Strictness } from '../../shared/types'
import { MODELS } from '../../shared/constants'
import { Pill } from '../shared/ui/Pill'
import { Card } from '../shared/ui/Card'

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7

const TOTAL_STEPS: Step = 7

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
  const [providerChoice, setProviderChoice] = useState<'cloud' | 'local'>('cloud')
  const [strictness, setStrictness] = useState<Strictness>(2)
  const [micGranted, setMicGranted] = useState(false)
  const [accessibilityRequested, setAccessibilityRequested] = useState(false)

  // Capture-key listener for the hotkey step.
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

  function next() {
    setStep((s) => (s < TOTAL_STEPS ? ((s + 1) as Step) : s))
  }
  function back() {
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s))
  }

  async function handleRequestMic() {
    const ok = await window.openflow.requestMicPermission()
    setMicGranted(ok)
  }

  async function handleOpenAccessibility() {
    await window.openflow.openAccessibilitySettings()
    setAccessibilityRequested(true)
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
    next()
  }

  async function handleFinish() {
    const partial: Partial<Settings> = {
      hotkeys: { pushToTalk: hotkey },
      strictness,
      firstRun: false,
    }
    await window.openflow.setSettings(partial)
    window.openflow.reloadHotkeys()
    window.close()
  }

  return (
    <div className="min-h-screen bg-paper text-ink font-sans flex flex-col relative overflow-hidden">
      {/* Drifting volt blob — soft, slow, decorative. Adds depth without
          stealing focus. Sits behind everything via -z-10. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-volt opacity-[0.07] blur-3xl animate-bgDrift -z-10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-32 w-[420px] h-[420px] rounded-full bg-volt opacity-[0.05] blur-3xl animate-bgDrift -z-10"
        style={{ animationDelay: '-11s' }}
      />

      <header className="px-5 pt-5 flex items-center justify-between">
        <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-pill bg-card border border-ink-08 shadow-sm">
          <div className="w-5 h-5 rounded-[6px] bg-ink text-paper flex items-center justify-center text-[10px] font-bold">O</div>
          <span className="text-[13px] font-semibold tracking-tight">OpenFlow</span>
          <span className="font-mono text-[10.5px] text-ink-45 ml-2 tabular-nums">
            {String(step).padStart(2, '0')} / {String(TOTAL_STEPS).padStart(2, '0')}
          </span>
        </div>
        {step > 1 && (
          <button onClick={back} className="text-[11.5px] text-ink-45 hover:text-ink transition-colors">
            ← back
          </button>
        )}
      </header>

      {/* Re-key on step change so the stepIn animation replays each step. */}
      <main key={step} className="flex-1 flex flex-col justify-center px-10 pb-10 animate-stepIn">
        {step === 1 && (
          <StepWelcome onContinue={next} />
        )}

        {step === 2 && (
          <StepPermissions
            micGranted={micGranted}
            accessibilityRequested={accessibilityRequested}
            onRequestMic={handleRequestMic}
            onOpenAccessibility={handleOpenAccessibility}
            onContinue={next}
          />
        )}

        {step === 3 && (
          <StepProvider
            choice={providerChoice}
            apiKey={apiKey}
            saving={saving}
            onChooseCloud={() => setProviderChoice('cloud')}
            onChooseLocal={() => setProviderChoice('local')}
            onApiKeyChange={setApiKey}
            onContinue={async () => {
              if (providerChoice === 'cloud') {
                await handleSaveKey()
              } else {
                next()
              }
            }}
          />
        )}

        {step === 4 && (
          <StepHotkey
            hotkey={hotkey}
            listening={listening}
            onToggleListen={() => setListening((l) => !l)}
            onContinue={next}
          />
        )}

        {step === 5 && (
          <StepStrictness
            value={strictness}
            onChange={setStrictness}
            onContinue={next}
          />
        )}

        {step === 6 && (
          <StepVoice onContinue={next} onSkip={next} />
        )}

        {step === 7 && (
          <StepTryIt onFinish={handleFinish} />
        )}
      </main>
    </div>
  )
}

// ─── Step 1: Welcome ────────────────────────────────────────────────

function StepWelcome({ onContinue }: { onContinue: () => void }) {
  return (
    <>
      <h1 className="text-[56px] leading-[0.95] tracking-tight mb-5">
        Meet <span className="font-display italic font-medium inline-block animate-heroPop origin-bottom-left">OpenFlow.</span>
      </h1>
      <p className="text-[14.5px] text-ink-60 leading-relaxed max-w-[420px] mb-8">
        Press a key. Say what you mean. We type it for you, formatted to match the app you're in.
      </p>
      <Pill variant="primary" onClick={onContinue}>
        Get started <span>→</span>
      </Pill>
    </>
  )
}

// ─── Step 2: Permissions ────────────────────────────────────────────

function StepPermissions({
  micGranted,
  accessibilityRequested,
  onRequestMic,
  onOpenAccessibility,
  onContinue,
}: {
  micGranted: boolean
  accessibilityRequested: boolean
  onRequestMic: () => void
  onOpenAccessibility: () => void
  onContinue: () => void
}) {
  return (
    <>
      <h1 className="text-[42px] leading-[0.98] tracking-tight mb-4">
        Grant <span className="font-display italic font-medium inline-block animate-heroPop origin-bottom-left">access.</span>
      </h1>
      <p className="text-[13.5px] text-ink-60 leading-relaxed max-w-[360px] mb-7">
        OpenFlow needs your microphone to hear you, and Accessibility so it can paste text into the focused app.
      </p>

      <div className="space-y-3 mb-7 max-w-[440px]">
        <PermissionRow
          label="Microphone"
          hint="Hear what you say."
          granted={micGranted}
          onAction={onRequestMic}
          actionLabel="Allow"
        />
        <PermissionRow
          label="Accessibility"
          hint="Paste into the focused app."
          granted={accessibilityRequested}
          onAction={onOpenAccessibility}
          actionLabel="Open Settings"
        />
      </div>

      <Pill variant="primary" onClick={onContinue}>
        Continue <span>→</span>
      </Pill>
    </>
  )
}

function PermissionRow({
  label,
  hint,
  granted,
  onAction,
  actionLabel,
}: {
  label: string
  hint: string
  granted: boolean
  onAction: () => void
  actionLabel: string
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div>
          <div className="text-[13px] font-medium">{label}</div>
          <div className="text-[11.5px] text-ink-45 mt-0.5">{hint}</div>
        </div>
        {granted ? (
          <span className="text-[12px] font-medium text-ok inline-flex items-center gap-1.5 animate-checkPop">
            <span className="inline-flex w-4 h-4 rounded-full bg-ok/15 items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 10 10" className="text-ok">
                <path d="M1.5 5.2 L4 7.5 L8.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            Granted
          </span>
        ) : (
          <Pill variant="secondary" onClick={onAction}>
            {actionLabel}
          </Pill>
        )}
      </div>
    </Card>
  )
}

// ─── Step 3: Provider ───────────────────────────────────────────────

function StepProvider({
  choice,
  apiKey,
  saving,
  onChooseCloud,
  onChooseLocal,
  onApiKeyChange,
  onContinue,
}: {
  choice: 'cloud' | 'local'
  apiKey: string
  saving: boolean
  onChooseCloud: () => void
  onChooseLocal: () => void
  onApiKeyChange: (s: string) => void
  onContinue: () => void
}) {
  const ready = choice === 'local' ? true : apiKey.trim().length > 0
  return (
    <>
      <h1 className="text-[42px] leading-[0.98] tracking-tight mb-4">
        Pick your <span className="font-display italic font-medium inline-block animate-heroPop origin-bottom-left">engine.</span>
      </h1>
      <p className="text-[13.5px] text-ink-60 leading-relaxed max-w-[420px] mb-6">
        Cloud is fastest to set up and works on day one. Local runs offline on your machine — bigger download, no API costs.
      </p>

      <div className="grid grid-cols-2 gap-3 max-w-[460px] mb-6">
        <ProviderCard
          title="Cloud"
          subtitle="Groq · ~$1–3/mo"
          tag="Recommended"
          selected={choice === 'cloud'}
          onClick={onChooseCloud}
        />
        <ProviderCard
          title="Local"
          subtitle="On-device · offline"
          tag="Coming soon"
          disabled
          selected={choice === 'local'}
          onClick={onChooseLocal}
        />
      </div>

      {choice === 'cloud' && (
        <div className="max-w-[420px] mb-5">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-45 mb-1.5">
            Groq API Key
          </div>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
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
      )}

      {choice === 'local' && (
        <Card>
          <div className="px-4 py-4 max-w-[420px]">
            <div className="text-[12.5px] text-ink-60 leading-relaxed">
              Local Whisper isn't shipping yet — we'll wire the model download in here. For now, pick Cloud.
            </div>
          </div>
        </Card>
      )}

      <Pill variant="primary" onClick={onContinue} disabled={saving || !ready}>
        {saving ? 'Saving…' : 'Continue →'}
      </Pill>
    </>
  )
}

function ProviderCard({
  title,
  subtitle,
  tag,
  selected,
  disabled,
  onClick,
}: {
  title: string
  subtitle: string
  tag?: string
  selected: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={[
        'text-left bg-card border rounded-card px-4 py-4 transition-all duration-200',
        selected ? 'border-ink ring-2 ring-volt-muted animate-voltPulse -translate-y-0.5' : 'border-ink-08 hover:border-ink-45 hover:-translate-y-0.5',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="text-[14px] font-semibold">{title}</div>
        {tag && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-45 bg-paper px-1.5 py-0.5 rounded">
            {tag}
          </span>
        )}
      </div>
      <div className="text-[11.5px] text-ink-60">{subtitle}</div>
    </button>
  )
}

// ─── Step 4: Hotkey ─────────────────────────────────────────────────

function StepHotkey({
  hotkey,
  listening,
  onToggleListen,
  onContinue,
}: {
  hotkey: string
  listening: boolean
  onToggleListen: () => void
  onContinue: () => void
}) {
  return (
    <>
      <h1 className="text-[42px] leading-[0.98] tracking-tight mb-4">
        Pick your <span className="font-display italic font-medium inline-block animate-heroPop origin-bottom-left">key.</span>
      </h1>
      <p className="text-[13.5px] text-ink-60 leading-relaxed max-w-[400px] mb-5">
        One key, three behaviors. Click the pill below and press whatever feels natural — Ctrl is the default.
      </p>

      <div className="mb-6">
        <Pill variant={listening ? 'volt' : 'secondary'} onClick={onToggleListen}>
          <span className="font-mono text-[12px]">
            {listening ? 'Press any key…' : prettifyKey(hotkey)}
          </span>
        </Pill>
      </div>

      <Card>
        <div className="px-4 py-4 max-w-[460px] space-y-2.5 text-[12.5px] text-ink-60">
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
      </Card>

      <div className="mt-6">
        <Pill variant="primary" onClick={onContinue}>
          Continue →
        </Pill>
      </div>
    </>
  )
}

// ─── Step 5: Strictness ─────────────────────────────────────────────

interface StrictnessOption {
  level: Strictness
  name: string
  blurb: string
  example: string
}

const STRICTNESS_OPTIONS: StrictnessOption[] = [
  {
    level: 1,
    name: 'Light',
    blurb: 'Strip filler only.',
    example: '"so the thing is" stays as is.',
  },
  {
    level: 2,
    name: 'Balanced',
    blurb: 'Polish + tech-term fixes.',
    example: '"so the thing is" → "the thing is".',
  },
  {
    level: 3,
    name: 'Strict',
    blurb: 'Restructure into clean prose.',
    example: '"so the thing is" → fully rewritten.',
  },
]

function StepStrictness({
  value,
  onChange,
  onContinue,
}: {
  value: Strictness
  onChange: (v: Strictness) => void
  onContinue: () => void
}) {
  return (
    <>
      <h1 className="text-[42px] leading-[0.98] tracking-tight mb-4">
        How <span className="font-display italic font-medium inline-block animate-heroPop origin-bottom-left">strict?</span>
      </h1>
      <p className="text-[13.5px] text-ink-60 leading-relaxed max-w-[420px] mb-6">
        Your default polish level. Email and docs will skew stricter; iMessage and Slack will skew looser. You can override per app later.
      </p>

      <div className="grid grid-cols-3 gap-3 max-w-[640px] mb-6">
        {STRICTNESS_OPTIONS.map((opt) => (
          <StrictnessCard
            key={opt.level}
            opt={opt}
            selected={value === opt.level}
            onClick={() => onChange(opt.level)}
          />
        ))}
      </div>

      <Pill variant="primary" onClick={onContinue}>
        Continue →
      </Pill>
    </>
  )
}

function StrictnessCard({
  opt,
  selected,
  onClick,
}: {
  opt: StrictnessOption
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'text-left bg-card border rounded-card px-4 py-4 transition-all duration-200 cursor-pointer',
        selected ? 'border-ink ring-2 ring-volt-muted animate-voltPulse -translate-y-0.5' : 'border-ink-08 hover:border-ink-45 hover:-translate-y-0.5',
      ].join(' ')}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="text-[14px] font-semibold">{opt.name}</div>
        <span className="font-mono text-[10px] text-ink-45">L{opt.level}</span>
      </div>
      <div className="text-[11.5px] text-ink-60 mb-2">{opt.blurb}</div>
      <div className="text-[11px] text-ink-45 italic leading-snug">{opt.example}</div>
    </button>
  )
}

// ─── Step 6: Voice enrollment (skippable) ──────────────────────────

function StepVoice({ onContinue, onSkip }: { onContinue: () => void; onSkip: () => void }) {
  return (
    <>
      <h1 className="text-[42px] leading-[0.98] tracking-tight mb-4">
        Hear <span className="font-display italic font-medium inline-block animate-heroPop origin-bottom-left">you.</span>
      </h1>
      <p className="text-[13.5px] text-ink-60 leading-relaxed max-w-[420px] mb-6">
        Optional: record ~15 seconds of your voice. OpenFlow learns your voiceprint and tunes out coworkers, TVs, and crowds.
      </p>

      <Card>
        <div className="px-4 py-5 max-w-[440px]">
          <div className="text-[12.5px] text-ink-60 leading-relaxed">
            Voice enrollment isn't shipping yet — it'll record + embed your voice here. You can always set it up later in Settings.
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3 mt-6">
        <Pill variant="primary" onClick={onContinue} disabled>
          Record 15 seconds →
        </Pill>
        <button onClick={onSkip} className="text-[12px] text-ink-45 hover:text-ink">
          Skip for now
        </button>
      </div>
    </>
  )
}

// ─── Step 7: Try it ─────────────────────────────────────────────────

function StepTryIt({ onFinish }: { onFinish: () => void }) {
  const hotkeyHint = useMemo(() => prettifyKey('CTRL'), [])
  return (
    <>
      <h1 className="text-[42px] leading-[0.98] tracking-tight mb-4">
        You're <span className="font-display italic font-medium inline-block animate-heroPop origin-bottom-left">ready.</span>
      </h1>
      <p className="text-[13.5px] text-ink-60 leading-relaxed max-w-[420px] mb-6">
        Press <span className="font-mono text-ink">{hotkeyHint}</span> anywhere on your Mac and start talking. The indicator pill will show up where you left it.
      </p>

      <Card>
        <div className="px-4 py-5 max-w-[440px] text-[12.5px] text-ink-60 leading-relaxed">
          Live demo coming soon — for now, just close this window and try it in any app.
        </div>
      </Card>

      <div className="mt-6">
        <Pill variant="primary" onClick={onFinish}>
          Start using OpenFlow ✨
        </Pill>
      </div>
    </>
  )
}
