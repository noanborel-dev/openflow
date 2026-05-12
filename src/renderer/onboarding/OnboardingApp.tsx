import { useEffect, useMemo, useRef, useState } from 'react'
import type { CategoryStrictness, Provider, Settings, Strictness } from '../../shared/types'
import type { LocalModelProgress, LocalModelReadiness } from '../global'
import { MODELS } from '../../shared/constants'
import { Pill } from '../shared/ui/Pill'
import { Card } from '../shared/ui/Card'
import { Wordmark } from '../shared/ui/Wordmark'
import { BrandLogo } from '../shared/ui/BrandLogo'

type Step = 1 | 2 | 3 | 4 | 5 | 6

const TOTAL_STEPS: Step = 6

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
  const [saving, setSaving] = useState(false)
  const [hotkey, setHotkey] = useState<string>('CTRL')
  const [listening, setListening] = useState(false)
  // Per-provider state so users can pick Groq / OpenAI / Anthropic and
  // each has its own key field. Matches the Settings → Provider tab.
  const [provider, setProvider] = useState<Provider>('groq')
  const [groqKey, setGroqKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [strictness, setStrictness] = useState<CategoryStrictness>({
    personal: 1,
    work: 3,
    writing: 2,
  })
  const [micGranted, setMicGranted] = useState(false)
  const [accessibilityGranted, setAccessibilityGranted] = useState(false)
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([])
  const [inputDeviceId, setInputDeviceId] = useState<string | null>(null)

  // Poll real OS permission state while on the permissions step. Stops as
  // soon as both are granted or the user moves on.
  useEffect(() => {
    if (step !== 2) return
    let cancelled = false
    async function tick() {
      const [mic, acc] = await Promise.all([
        window.openflow.getMicPermissionStatus(),
        window.openflow.isAccessibilityTrusted(),
      ])
      if (cancelled) return
      setMicGranted(mic === 'granted')
      setAccessibilityGranted(acc)
    }
    tick()
    const id = window.setInterval(tick, 750)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [step])

  // Once mic is granted, enumerate available input devices and load the
  // user's saved choice (if any). Browsers only return real device labels
  // after the permission grant, so this can't run until micGranted flips.
  useEffect(() => {
    if (!micGranted) return
    let cancelled = false
    Promise.all([
      navigator.mediaDevices.enumerateDevices(),
      window.openflow.getSettings(),
    ]).then(([devices, settings]) => {
      if (cancelled) return
      const mics = devices.filter((d) => d.kind === 'audioinput')
      setMicDevices(mics)
      // If saved deviceId still exists, keep it. Otherwise fall back to
      // null (= system default) and let the user choose explicitly.
      const saved = settings.inputDeviceId
      const stillAvailable = saved && mics.some((m) => m.deviceId === saved)
      setInputDeviceId(stillAvailable ? saved : null)
    })
    return () => { cancelled = true }
  }, [micGranted])

  function handleSelectMic(id: string | null) {
    setInputDeviceId(id)
    window.openflow.setSettings({ inputDeviceId: id })
  }

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
    // This triggers the macOS prompt; the polling effect above will pick
    // up the actual grant once the user toggles it in System Settings.
    await window.openflow.openAccessibilitySettings()
  }

  async function handleSaveProvider() {
    setSaving(true)
    // Anthropic transcription falls back to Groq, so we keep whatever
    // Groq key was entered alongside the Anthropic one.
    await window.openflow.setSettings({
      provider: {
        provider,
        groqKey: groqKey.trim(),
        openaiKey: openaiKey.trim(),
        anthropicKey: anthropicKey.trim(),
        transcriptionModel: MODELS[provider].transcription,
        cleanupModel: MODELS[provider].cleanup,
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
      {/* OS drag strip — full width, top 32px. Required for hiddenInset
          windows; without it the renderer captures clicks and the
          window can't be moved when focused. */}
      <div
        className="absolute top-0 left-0 right-0 h-8 z-50"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />
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
        <div className="inline-flex items-center gap-3">
          <Wordmark size="button" />
          <span className="font-mono text-[10.5px] text-ink-45 tabular-nums">
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
            accessibilityGranted={accessibilityGranted}
            onRequestMic={handleRequestMic}
            onOpenAccessibility={handleOpenAccessibility}
            onContinue={next}
            micDevices={micDevices}
            inputDeviceId={inputDeviceId}
            onSelectMic={handleSelectMic}
          />
        )}

        {step === 3 && (
          <StepProvider
            provider={provider}
            onProviderChange={setProvider}
            groqKey={groqKey}
            openaiKey={openaiKey}
            anthropicKey={anthropicKey}
            onGroqKeyChange={setGroqKey}
            onOpenaiKeyChange={setOpenaiKey}
            onAnthropicKeyChange={setAnthropicKey}
            saving={saving}
            onContinue={handleSaveProvider}
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
          <StepDone hotkey={hotkey} onFinish={handleFinish} />
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
  accessibilityGranted,
  onRequestMic,
  onOpenAccessibility,
  onContinue,
  micDevices,
  inputDeviceId,
  onSelectMic,
}: {
  micGranted: boolean
  accessibilityGranted: boolean
  onRequestMic: () => void
  onOpenAccessibility: () => void
  onContinue: () => void
  micDevices: MediaDeviceInfo[]
  inputDeviceId: string | null
  onSelectMic: (id: string | null) => void
}) {
  const allGranted = micGranted && accessibilityGranted
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
          showLiveMic
          liveMicDeviceId={inputDeviceId}
        />
        {micGranted && micDevices.length > 0 && (
          <Card>
            <div className="px-4 py-3">
              <div className="text-[11.5px] text-ink-60 mb-2">
                Use this microphone
              </div>
              <div className="space-y-1.5">
                <MicChoice
                  label="System default"
                  hint="Whatever your Mac is set to use."
                  selected={inputDeviceId === null}
                  onClick={() => onSelectMic(null)}
                />
                {micDevices.map((d) => (
                  <MicChoice
                    key={d.deviceId}
                    label={d.label || 'Unnamed microphone'}
                    selected={inputDeviceId === d.deviceId}
                    onClick={() => onSelectMic(d.deviceId)}
                  />
                ))}
              </div>
            </div>
          </Card>
        )}
        <PermissionRow
          label="Accessibility"
          hint="Paste into the focused app."
          granted={accessibilityGranted}
          onAction={onOpenAccessibility}
          actionLabel="Open Settings"
        />
      </div>

      <Pill variant="primary" onClick={onContinue} disabled={!allGranted}>
        {allGranted ? 'Continue →' : 'Waiting for permissions…'}
      </Pill>
    </>
  )
}

function MicChoice({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string
  hint?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full text-left flex items-center gap-3 px-2.5 py-1.5 rounded-input transition-colors',
        selected ? 'bg-ink/5' : 'hover:bg-ink/[0.03]',
      ].join(' ')}
    >
      <span
        className={[
          'w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center',
          selected ? 'border-ink' : 'border-ink-45',
        ].join(' ')}
      >
        {selected && <span className="w-1.5 h-1.5 rounded-full bg-ink" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[12px] truncate">{label}</span>
        {hint && <span className="block text-[10.5px] text-ink-45">{hint}</span>}
      </span>
    </button>
  )
}

function PermissionRow({
  label,
  hint,
  granted,
  onAction,
  actionLabel,
  showLiveMic,
  liveMicDeviceId,
}: {
  label: string
  hint: string
  granted: boolean
  onAction: () => void
  actionLabel: string
  showLiveMic?: boolean
  liveMicDeviceId?: string | null
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div>
            <div className="text-[13px] font-medium">{label}</div>
            <div className="text-[11.5px] text-ink-45 mt-0.5">{hint}</div>
          </div>
          {granted && showLiveMic && <LiveMicMeter deviceId={liveMicDeviceId ?? null} />}
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

// Live mic level meter — proves to the user that we can actually hear
// them. Pure visual, doesn't store anything. Stops when unmounted.
// Re-mounts when deviceId changes so the meter follows the picker.
function LiveMicMeter({ deviceId }: { deviceId: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null
    let raf = 0
    let cancelled = false

    async function start() {
      try {
        const constraints: MediaStreamConstraints = {
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        }
        stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (cancelled) return
        ctx = new AudioContext()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)
        const c = canvasRef.current
        if (!c) return
        const draw = () => {
          if (cancelled) return
          analyser.getByteFrequencyData(data)
          const dpr = window.devicePixelRatio || 1
          const W = c.width = c.clientWidth * dpr
          const H = c.height = c.clientHeight * dpr
          const g = c.getContext('2d')
          if (!g) return
          g.clearRect(0, 0, W, H)
          const bars = 12
          const gap = 2 * dpr
          const barW = (W - gap * (bars - 1)) / bars
          for (let i = 0; i < bars; i++) {
            // Sample evenly across the freq spectrum we care about.
            const idx = Math.floor((i / bars) * (data.length * 0.6))
            const v = data[idx] / 255   // 0..1
            const h = Math.max(2 * dpr, v * H)
            const x = i * (barW + gap)
            const y = (H - h) / 2
            g.fillStyle = '#2B7FFF'
            g.fillRect(x, y, barW, h)
          }
          raf = requestAnimationFrame(draw)
        }
        draw()
      } catch {
        // user rejected permission or device unavailable — silently no-op
      }
    }
    start()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      if (stream) stream.getTracks().forEach((t) => t.stop())
      if (ctx) ctx.close().catch(() => {})
    }
  }, [deviceId])
  return (
    <canvas
      ref={canvasRef}
      className="w-[88px] h-6 rounded"
      aria-label="live microphone level"
    />
  )
}

// ─── Step 3: Provider ───────────────────────────────────────────────

interface ProviderInfo {
  value: Provider
  name: string
  model: string
  description: string
  price: string
  keyPlaceholder: string
  keyHint: string
  brand: 'groq' | 'openai' | 'anthropic' | 'local'
}

const ONBOARDING_PROVIDERS: ProviderInfo[] = [
  { value: 'local',     brand: 'local',     name: 'Local',     model: 'whisper-large-v3-turbo (on-device)', description: 'Runs on your Mac. Offline, free, no keys. ~547MB download.', price: 'free, offline', keyPlaceholder: '',          keyHint: '' },
  { value: 'groq',      brand: 'groq',      name: 'Groq',      model: 'whisper-large-v3-turbo', description: 'Fastest cloud Whisper. Free tier covers most users.', price: 'free tier',  keyPlaceholder: 'gsk_…',     keyHint: 'console.groq.com' },
  { value: 'openai',    brand: 'openai',    name: 'OpenAI',    model: 'whisper-1',    description: 'Industry-standard. Fast, accurate, cheap.',         price: '$0.006/min', keyPlaceholder: 'sk-…',      keyHint: 'platform.openai.com/api-keys' },
  { value: 'anthropic', brand: 'anthropic', name: 'Anthropic', model: 'claude-haiku', description: 'Best for cleanup; uses Groq for transcription.',     price: '$0.004/min', keyPlaceholder: 'sk-ant-…',  keyHint: 'console.anthropic.com' },
]

function StepProvider({
  provider,
  onProviderChange,
  groqKey,
  openaiKey,
  anthropicKey,
  onGroqKeyChange,
  onOpenaiKeyChange,
  onAnthropicKeyChange,
  saving,
  onContinue,
}: {
  provider: Provider
  onProviderChange: (p: Provider) => void
  groqKey: string
  openaiKey: string
  anthropicKey: string
  onGroqKeyChange: (s: string) => void
  onOpenaiKeyChange: (s: string) => void
  onAnthropicKeyChange: (s: string) => void
  saving: boolean
  onContinue: () => void
}) {
  // Local-model state mirrors the Settings tab — readiness drives whether
  // the user can advance past this step.
  const [localReadiness, setLocalReadiness] = useState<LocalModelReadiness | null>(null)
  const [localProgress, setLocalProgress] = useState<LocalModelProgress | null>(null)
  useEffect(() => {
    window.openflow.getLocalModelStatus().then((s) => {
      setLocalReadiness(s.readiness)
      setLocalProgress(s.progress)
    })
    const off = window.openflow.onLocalModelProgress((p) => {
      setLocalProgress(p)
      if (p.status === 'done') {
        window.openflow.getLocalModelStatus().then((s) => setLocalReadiness(s.readiness))
      }
    })
    return off
  }, [])

  // Which key field maps to the active provider. Anthropic needs the
  // Anthropic key for cleanup + the Groq key for transcription — the
  // latter is handled in a hint, not a second field, to keep the flow
  // simple. Users can add the Groq key in Settings afterward if needed.
  const keyValue =
    provider === 'groq' ? groqKey :
    provider === 'openai' ? openaiKey :
    provider === 'anthropic' ? anthropicKey :
    ''
  const keyChange =
    provider === 'groq' ? onGroqKeyChange :
    provider === 'openai' ? onOpenaiKeyChange :
    provider === 'anthropic' ? onAnthropicKeyChange :
    () => {}
  const info = ONBOARDING_PROVIDERS.find((p) => p.value === provider)!
  const ready = provider === 'local'
    ? Boolean(localReadiness?.ready)
    : keyValue.trim().length > 0

  return (
    <>
      <h1 className="text-[42px] leading-[0.98] tracking-tight mb-4">
        Pick your <span className="font-display italic font-medium inline-block animate-heroPop origin-bottom-left">provider.</span>
      </h1>
      <p className="text-[13.5px] text-ink-60 leading-relaxed max-w-[460px] mb-6">
        Bring your own key. OpenFlow never proxies — your audio goes straight to your provider. Keys are stored locally and never sent to OpenFlow servers.
      </p>

      <div className="space-y-2.5 max-w-[520px] mb-5">
        {ONBOARDING_PROVIDERS.map((p) => {
          const selected = p.value === provider
          return (
            <button
              key={p.value}
              onClick={() => onProviderChange(p.value)}
              className={[
                'w-full text-left bg-card border rounded-[14px] px-4 py-3.5 transition-all duration-150',
                selected
                  ? 'border-ink ring-1 ring-ink shadow-sm'
                  : 'border-ink-08 hover:border-ink-45',
              ].join(' ')}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
                     style={{ background: providerTileColor(p.brand) }}>
                  <ProviderGlyph brand={p.brand} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13.5px] font-semibold">{p.name}</span>
                    <span className="text-[10.5px] font-mono text-ink-45">{p.model}</span>
                  </div>
                  <div className="text-[11px] text-ink-60 mt-0.5">{p.description}</div>
                </div>
                <span className="text-[11px] font-mono text-ink-45 mr-2 shrink-0">{p.price}</span>
                <span className={[
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                  selected ? 'bg-ink border-ink' : 'border-ink-08',
                ].join(' ')}>
                  {selected && <span className="w-2 h-2 rounded-full bg-paper" />}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      <div className="max-w-[520px] mb-5">
        {provider === 'local' ? (
          <OnboardingLocalPanel readiness={localReadiness} progress={localProgress} />
        ) : (
          <>
            <div className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-ink-45 mb-1.5">
              {info.name} API Key
            </div>
            <input
              type="password"
              value={keyValue}
              onChange={(e) => keyChange(e.target.value)}
              placeholder={info.keyPlaceholder}
              className="w-full bg-card border border-ink-08 rounded-input px-3 py-2.5 text-[13px] font-mono focus:outline-none focus:border-volt focus:ring-2 focus:ring-volt-muted"
            />
            <a
              onClick={() => window.open(`https://${info.keyHint}`, '_blank')}
              className="text-[11px] text-ink-45 hover:text-ink mt-2 inline-block cursor-pointer"
            >
              Get a key at {info.keyHint} ↗
            </a>
            {provider === 'anthropic' && (
              <div className="text-[11px] text-ink-45 mt-3 leading-relaxed">
                Anthropic uses Groq for transcription. Add a Groq key in Settings → Provider after onboarding, or transcription will fall back to whichever provider is configured.
              </div>
            )}
          </>
        )}
      </div>

      <Pill variant="primary" onClick={onContinue} disabled={saving || !ready}>
        {saving ? 'Saving…' : 'Continue →'}
      </Pill>
    </>
  )
}

function ProviderGlyph({ brand }: { brand: 'openai' | 'anthropic' | 'groq' | 'local' }) {
  if (brand === 'anthropic') {
    return <BrandLogo brand="claude" size={22} />
  }
  if (brand === 'openai') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2.4c-.95 0-1.85.22-2.65.61a4.78 4.78 0 0 0-3.7 6.4 4.78 4.78 0 0 0 0 6.18 4.78 4.78 0 0 0 3.7 6.4 4.78 4.78 0 0 0 6.18 1.42 4.78 4.78 0 0 0 6.4-3.7 4.78 4.78 0 0 0 0-6.18 4.78 4.78 0 0 0-3.7-6.4A4.78 4.78 0 0 0 12 2.4Z"
          stroke="#fff" strokeWidth="1.4" fill="none"
        />
      </svg>
    )
  }
  if (brand === 'local') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="6" y="6" width="12" height="12" rx="1.5" stroke="#fff" strokeWidth="1.4"/>
        <rect x="9" y="9" width="6" height="6" fill="#fff" opacity="0.9"/>
        <path d="M3 9h2M3 12h2M3 15h2M19 9h2M19 12h2M19 15h2M9 3v2M12 3v2M15 3v2M9 19v2M12 19v2M15 19v2" stroke="#fff" strokeWidth="1.2"/>
      </svg>
    )
  }
  return <span className="text-[15px] font-bold text-white" style={{ fontFamily: 'system-ui' }}>G</span>
}

function providerTileColor(brand: 'openai' | 'anthropic' | 'groq' | 'local'): string {
  if (brand === 'openai')    return '#0F1011'
  if (brand === 'anthropic') return '#D97757'
  if (brand === 'local')     return '#1B2233'
  return '#F55036'
}

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(0)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// Onboarding-step version of the Settings panel — same three-state
// rendering (missing-binary | not-downloaded | downloading | ready) but
// laid out for the narrower onboarding column. Continue is gated on
// `localReadiness.ready` upstream.
function OnboardingLocalPanel({
  readiness,
  progress,
}: {
  readiness: LocalModelReadiness | null
  progress: LocalModelProgress | null
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!readiness) return <div className="text-[11px] text-ink-45">Loading model status…</div>

  if (!readiness.whisperCli || !readiness.ffmpeg) {
    const which = !readiness.whisperCli ? 'whisper-cli' : 'ffmpeg'
    return (
      <div className="bg-card border border-danger/40 rounded-card px-4 py-3.5">
        <div className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-danger mb-1">{which} not found</div>
        <p className="text-[11.5px] text-ink-60 leading-relaxed">
          {which === 'whisper-cli'
            ? 'In dev: `brew install whisper-cpp`. In a packaged build this means a broken install — re-download the .app.'
            : 'Run `npm install` to pull ffmpeg-static, or reinstall OpenFlow.'}
        </p>
      </div>
    )
  }

  const downloading = progress?.status === 'starting' || progress?.status === 'downloading'
  const downloaded = readiness.modelDownloaded && progress?.status !== 'downloading'

  async function startDownload() {
    setBusy(true)
    setError(null)
    const result = await window.openflow.downloadLocalModel()
    setBusy(false)
    if (!result.ok) setError(result.error ?? 'Download failed')
  }

  if (downloaded) {
    return (
      <div className="bg-card border border-ok/30 rounded-card px-4 py-3.5">
        <div className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-ok mb-1">✓ Model ready</div>
        <p className="text-[11.5px] text-ink-60">large-v3-turbo q5_0 · stored on this Mac · no key needed.</p>
      </div>
    )
  }

  if (downloading) {
    const pct = progress!.totalBytes > 0 ? Math.min(100, (progress!.receivedBytes / progress!.totalBytes) * 100) : 0
    return (
      <div className="bg-card border border-ink-08 rounded-card px-4 py-3.5">
        <div className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-ink-45 mb-2">
          Downloading model… {pct.toFixed(0)}%
        </div>
        <div className="h-1.5 bg-ink-08 rounded-full overflow-hidden">
          <div className="h-full bg-volt transition-[width] duration-200" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[10.5px] font-mono text-ink-45 mt-2">
          {formatBytes(progress!.receivedBytes)} / {formatBytes(progress!.totalBytes)} · downloads once, then offline forever
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-ink-08 rounded-card px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-ink-45 mb-0.5">One-time download</div>
          <p className="text-[11.5px] text-ink-60">large-v3-turbo q5_0 · ~547 MB · then everything runs offline.</p>
        </div>
        <Pill variant="primary" onClick={startDownload} disabled={busy}>
          {busy ? '…' : 'Download'}
        </Pill>
      </div>
      {error && <p className="text-[11px] text-danger mt-2.5">✗ {error}</p>}
    </div>
  )
}

// ─── Step 4: Hotkey — interactive trainer ──────────────────────────

type Challenge = 'tap' | 'hold' | 'doubletap'
const CHALLENGE_ORDER: Challenge[] = ['tap', 'hold', 'doubletap']

const CHALLENGE_INFO: Record<Challenge, { title: string; hint: string; icon: string }> = {
  tap:       { title: 'Try a single tap', hint: 'Quick press, then release.', icon: '·' },
  hold:      { title: 'Now hold it down', hint: 'Press and hold for a moment, then release.', icon: '━' },
  doubletap: { title: 'Now double-tap', hint: 'Two quick presses in a row.', icon: '··' },
}

function keyCodeMatches(savedKey: string, e: KeyboardEvent): boolean {
  const code = e.code
  if (savedKey === 'CTRL') return code === 'ControlLeft' || code === 'ControlRight'
  if (savedKey === 'ALT') return code === 'AltLeft' || code === 'AltRight'
  if (savedKey === 'SHIFT') return code === 'ShiftLeft' || code === 'ShiftRight'
  if (savedKey === 'META') return code === 'MetaLeft' || code === 'MetaRight'
  return e.key.toUpperCase() === savedKey
}

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
  const [completed, setCompleted] = useState<Set<Challenge>>(new Set())
  const [active, setActive] = useState<Challenge>('tap')
  const [pressing, setPressing] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0)  // 0..1, drives hold-bar fill
  const stateRef = useRef({ pressedAt: 0, lastTapAt: 0, holdRaf: 0 })

  // Listen for the hotkey while this step is mounted. Renderer-only;
  // captures only when the onboarding window has focus, which is exactly
  // what we want for a tutorial.
  useEffect(() => {
    if (listening) return  // pause trainer while user is rebinding
    function tickHold() {
      const elapsed = Date.now() - stateRef.current.pressedAt
      // Visual fill maxes at ~600ms — feels satisfying, generous beyond
      // the 150ms hold threshold so users don't accidentally land in the
      // tap bucket while watching the bar.
      setHoldProgress(Math.min(1, elapsed / 600))
      if (stateRef.current.pressedAt > 0) {
        stateRef.current.holdRaf = requestAnimationFrame(tickHold)
      }
    }

    function onDown(e: KeyboardEvent) {
      if (!keyCodeMatches(hotkey, e)) return
      e.preventDefault()
      // OS auto-repeat fires DOWN repeatedly while held; ignore.
      if (stateRef.current.pressedAt !== 0) return
      const now = Date.now()

      // Double-tap: second DOWN within 500ms of the prior tap UP.
      if (stateRef.current.lastTapAt && now - stateRef.current.lastTapAt < 500) {
        stateRef.current.lastTapAt = 0
        if (active === 'doubletap') {
          markComplete('doubletap')
        }
        return
      }

      stateRef.current.pressedAt = now
      setPressing(true)
      setHoldProgress(0)
      cancelAnimationFrame(stateRef.current.holdRaf)
      stateRef.current.holdRaf = requestAnimationFrame(tickHold)
    }

    function onUp(e: KeyboardEvent) {
      if (!keyCodeMatches(hotkey, e)) return
      if (stateRef.current.pressedAt === 0) return
      const held = Date.now() - stateRef.current.pressedAt
      stateRef.current.pressedAt = 0
      cancelAnimationFrame(stateRef.current.holdRaf)
      setPressing(false)
      setHoldProgress(0)

      if (held >= 200) {
        // True hold.
        if (active === 'hold') {
          markComplete('hold')
        }
        stateRef.current.lastTapAt = 0
      } else {
        // Tap. Mark for double-tap window.
        stateRef.current.lastTapAt = Date.now()
        if (active === 'tap') {
          markComplete('tap')
        }
      }
    }

    function markComplete(c: Challenge) {
      setCompleted((prev) => {
        const next = new Set(prev)
        next.add(c)
        return next
      })
      // Auto-advance to the next not-yet-completed challenge.
      setTimeout(() => {
        setActive((current) => {
          const remaining = CHALLENGE_ORDER.filter((x) => x !== c && !completed.has(x))
          return remaining[0] ?? current
        })
      }, 600)
    }

    window.addEventListener('keydown', onDown, true)
    window.addEventListener('keyup', onUp, true)
    return () => {
      window.removeEventListener('keydown', onDown, true)
      window.removeEventListener('keyup', onUp, true)
      cancelAnimationFrame(stateRef.current.holdRaf)
    }
  }, [hotkey, active, completed, listening])

  // Once all three are complete, surface the Continue CTA prominently.
  const allDone = completed.size === 3

  return (
    <>
      <h1 className="text-[42px] leading-[0.98] tracking-tight mb-4">
        Try your <span className="font-display italic font-medium inline-block animate-heroPop origin-bottom-left">key.</span>
      </h1>
      <p className="text-[13.5px] text-ink-60 leading-relaxed max-w-[420px] mb-5">
        One key. Three behaviors. Try each.
      </p>

      {/* Live key visualization — also the rebind target. Click to
          listen for a new key, otherwise it just shows your current
          hotkey and pulses while you press it. */}
      <div className="max-w-[460px] mb-6">
        <button
          type="button"
          onClick={onToggleListen}
          className={[
            'w-full relative h-[100px] bg-card border-2 rounded-card flex items-center justify-center transition-all duration-150',
            listening ? 'border-volt' :
            pressing ? 'border-volt scale-[1.015]' : 'border-ink-08 hover:border-ink-45',
          ].join(' ')}
        >
          <div className="font-display italic text-[32px] text-ink select-none">
            {listening ? 'press any key…' : prettifyKey(hotkey)}
          </div>
          {!listening && (
            <div className="absolute top-2 right-3 text-[10px] font-mono uppercase tracking-wider text-ink-45">
              click to change
            </div>
          )}
          {/* Hold-progress fill */}
          <div
            className="absolute inset-x-0 bottom-0 h-1 bg-volt rounded-b-card transition-[width] duration-75"
            style={{ width: `${holdProgress * 100}%` }}
          />
          {pressing && (
            <div className="absolute inset-0 rounded-card pointer-events-none animate-voltPulse" />
          )}
        </button>
      </div>

      {/* Three challenge cards. Active one highlighted; completed ones
          collapse to a checkmark row. */}
      <div className="max-w-[460px] space-y-2 mb-6">
        {CHALLENGE_ORDER.map((c) => {
          const info = CHALLENGE_INFO[c]
          const isDone = completed.has(c)
          const isActive = active === c && !isDone
          return (
            <div
              key={c}
              className={[
                'flex items-center gap-3 px-4 py-3 rounded-card border transition-all duration-200',
                isDone ? 'bg-card border-ok/30' :
                isActive ? 'bg-card border-ink shadow-sm' :
                'bg-paper border-ink-08 opacity-50',
              ].join(' ')}
            >
              <span
                className={[
                  'font-mono text-[15px] w-8 text-center transition-colors',
                  isDone ? 'text-ok' : isActive ? 'text-ink' : 'text-ink-45',
                ].join(' ')}
              >
                {isDone ? '✓' : info.icon}
              </span>
              <div className="flex-1">
                <div className={['text-[13px] font-medium', isDone ? 'text-ink-45 line-through decoration-ink-08' : 'text-ink'].join(' ')}>
                  {info.title}
                </div>
                {isActive && (
                  <div className="text-[11.5px] text-ink-45 mt-0.5 animate-stepIn">
                    {info.hint}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        <Pill variant="primary" onClick={onContinue}>
          {allDone ? "Nice — let's continue →" : 'Skip for now →'}
        </Pill>
        {!allDone && (
          <span className="text-[11px] text-ink-45 tabular-nums">
            {completed.size} / 3 done
          </span>
        )}
      </div>
    </>
  )
}

// ─── Step 5: Strictness — 3-substep side-by-side flow ──────────────

type StrictCat = keyof CategoryStrictness
const SUBSTEP_ORDER: StrictCat[] = ['personal', 'work', 'writing']

// Per-bucket meta + sample dictation + per-level cleaned output.
// Hard-coded; not a real LLM call. Each bucket's preview pane mocks
// the canvas the user would actually be writing into.
const CAT_META: Record<StrictCat, {
  title: string
  blurb: string
  apps: string
  raw: string
  outputs: Record<Strictness, string>
  visual: 'imessage' | 'email' | 'doc'
}> = {
  personal: {
    title: 'Personal messaging',
    blurb: 'Friends, family, group chats. Most people want this loose.',
    apps: 'iMessage · WhatsApp · Telegram',
    raw: "yo um so are we still on for tomorrow or like did that move",
    outputs: {
      1: "yo so are we still on for tomorrow or like did that move",
      2: "are we still on for tomorrow or did that move",
      3: "Are we still on for tomorrow, or has it moved?",
    },
    visual: 'imessage',
  },
  work: {
    title: 'Work messaging',
    blurb: 'Colleagues — chat and email. Polished by default.',
    apps: 'Slack · Discord · Gmail · Outlook',
    raw: "hey just wanted to follow up on the proposal um can you let me know if you got a chance to look at it",
    outputs: {
      1: "hey just wanted to follow up on the proposal can you let me know if you got a chance to look at it",
      2: "Just following up on the proposal — can you let me know if you've had a chance to look?",
      3: "Hi — following up on the proposal. Could you let me know once you've had a chance to review it?",
    },
    visual: 'email',
  },
  writing: {
    title: 'Writing & AI',
    blurb: 'Longform docs and AI prompts. Balanced tends to feel right.',
    apps: 'Notion · Google Docs · Claude · ChatGPT',
    raw: "so the main idea is that um we want users to feel like the app is responding to them and like adapting",
    outputs: {
      1: "so the main idea is that we want users to feel like the app is responding to them and like adapting",
      2: "The main idea is that we want users to feel the app is responding to them and adapting.",
      3: "The core idea: users should feel the app responds and adapts to them.",
    },
    visual: 'doc',
  },
}

// Char-by-char reveal hook. Plays a "the AI is typing" effect on the
// preview output whenever the source text changes (level change or
// category change). Tunable speed via msPerChar.
function useTypewriter(text: string, msPerChar = 14): string {
  const [shown, setShown] = useState('')
  useEffect(() => {
    setShown('')
    let i = 0
    const id = window.setInterval(() => {
      i++
      setShown(text.slice(0, i))
      if (i >= text.length) window.clearInterval(id)
    }, msPerChar)
    return () => window.clearInterval(id)
  }, [text, msPerChar])
  return shown
}


const LEVEL_LABEL: Record<Strictness, string> = { 1: 'Light', 2: 'Balanced', 3: 'Strict' }

function StepStrictness({
  value,
  onChange,
  onContinue,
}: {
  value: CategoryStrictness
  onChange: (v: CategoryStrictness) => void
  onContinue: () => void
}) {
  const [substep, setSubstep] = useState<StrictCat>('personal')
  const idx = SUBSTEP_ORDER.indexOf(substep)
  const meta = CAT_META[substep]
  const level = value[substep]

  function setLevel(lvl: Strictness) {
    onChange({ ...value, [substep]: lvl })
  }
  function handleNext() {
    const nextIdx = idx + 1
    if (nextIdx < SUBSTEP_ORDER.length) setSubstep(SUBSTEP_ORDER[nextIdx])
    else onContinue()
  }
  function handleSubBack() {
    if (idx > 0) setSubstep(SUBSTEP_ORDER[idx - 1])
  }

  const isLast = idx === SUBSTEP_ORDER.length - 1

  return (
    <>
      <h1 className="text-[42px] leading-[0.98] tracking-tight mb-4">
        How <span className="font-display italic font-medium inline-block animate-heroPop origin-bottom-left">polished?</span>
      </h1>

      {/* Sub-step pips — show progress through personal → work → writing. */}
      <div className="flex items-center gap-2 mb-7">
        {SUBSTEP_ORDER.map((s, i) => (
          <div
            key={s}
            className={[
              'h-1 rounded-full transition-all duration-300',
              i === idx ? 'bg-ink w-10' : i < idx ? 'bg-ink/60 w-6' : 'bg-ink-08 w-6',
            ].join(' ')}
          />
        ))}
        <span className="text-[10.5px] font-mono uppercase tracking-wider text-ink-45 ml-2">
          {idx + 1} / {SUBSTEP_ORDER.length}
        </span>
      </div>

      {/* Side-by-side: picker on the left, app-shaped preview on the right. */}
      <div className="grid grid-cols-2 gap-8 max-w-[760px] mb-7">
        <div key={substep} className="animate-stepIn flex flex-col justify-center">
          <div className="text-[24px] font-semibold leading-tight mb-1.5">{meta.title}</div>
          <div className="text-[11.5px] text-ink-45 mb-7">{meta.apps}</div>

          <div className="flex gap-2">
            {([1, 2, 3] as Strictness[]).map((lvl) => {
              const selected = level === lvl
              return (
                <button
                  key={lvl}
                  onClick={() => setLevel(lvl)}
                  className={[
                    'flex-1 px-3 py-2.5 rounded-pill text-[13px] font-medium border transition-all duration-150',
                    selected
                      ? 'bg-ink text-paper border-ink -translate-y-0.5'
                      : 'bg-card text-ink border-ink-08 hover:border-ink-45',
                  ].join(' ')}
                >
                  {LEVEL_LABEL[lvl]}
                </button>
              )
            })}
          </div>
        </div>

        <div key={`${substep}-${level}`} className="animate-stepIn">
          {meta.visual === 'imessage' && (
            <IMessageMock raw={meta.raw} cleaned={meta.outputs[level]} />
          )}
          {meta.visual === 'email' && (
            <EmailMock raw={meta.raw} cleaned={meta.outputs[level]} />
          )}
          {meta.visual === 'doc' && (
            <DocMock raw={meta.raw} cleaned={meta.outputs[level]} />
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {idx > 0 && (
          <button onClick={handleSubBack} className="text-[12px] text-ink-45 hover:text-ink">
            ← previous
          </button>
        )}
        <Pill variant="primary" onClick={handleNext}>
          {isLast ? 'Continue →' : 'Next →'}
        </Pill>
      </div>
    </>
  )
}

// ─── Step 5 visual mocks ───────────────────────────────────────────

function MockHeader({ brand, label }: { brand?: 'imessage' | 'gmail' | 'notion' | 'slack' | 'claude'; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2.5 px-1">
      {brand && <BrandLogo brand={brand} size={14} />}
      <div className="text-[10.5px] font-mono uppercase tracking-wider text-ink-45">{label}</div>
    </div>
  )
}

function IMessageMock({ raw, cleaned }: { raw: string; cleaned: string }) {
  const typed = useTypewriter(cleaned)
  return (
    <div>
      <MockHeader brand="imessage" label="iMessage" />
      <div className="bg-card rounded-card border border-ink-08 px-3 py-3 shadow-sm">
        <div className="text-center text-[10px] text-ink-45 mb-3 font-mono">Today 2:14 PM</div>
        {/* Received bubble — what you said, gray */}
        <div className="flex justify-start mb-2">
          <div className="bg-[#e9e9eb] text-ink text-[12.5px] px-3 py-1.5 rounded-[16px] rounded-bl-[4px] max-w-[78%] leading-snug">
            {raw}
          </div>
        </div>
        {/* Sent bubble — what OpenFlow types, iMessage blue */}
        <div className="flex justify-end">
          <div className="bg-[#0b93f6] text-white text-[12.5px] px-3 py-1.5 rounded-[16px] rounded-br-[4px] max-w-[78%] leading-snug">
            {typed}
            <span className="inline-block w-[2px] h-[12px] bg-white/80 ml-0.5 align-text-bottom animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}

function EmailMock({ raw, cleaned }: { raw: string; cleaned: string }) {
  const typed = useTypewriter(cleaned)
  return (
    <div>
      <MockHeader brand="gmail" label="Gmail · Compose" />
      <div className="bg-card rounded-card border border-ink-08 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-ink-08 bg-paper/40">
          <div className="text-[11px] text-ink-45">To: <span className="text-ink">alex@company.com</span></div>
          <div className="text-[11px] text-ink-45 mt-1">Subject: <span className="text-ink">Quick follow-up</span></div>
        </div>
        <div className="px-4 py-3 min-h-[110px]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-45 mb-1.5">You said</div>
          <div className="text-[11.5px] text-ink-45 italic mb-3 leading-snug">"{raw}"</div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-45 mb-1.5">OpenFlow types</div>
          <div className="text-[13px] text-ink leading-snug">
            {typed}
            <span className="inline-block w-[2px] h-[14px] bg-ink ml-0.5 align-text-bottom animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}

function DocMock({ raw, cleaned }: { raw: string; cleaned: string }) {
  const typed = useTypewriter(cleaned)
  return (
    <div>
      <MockHeader brand="notion" label="Notion · Page" />
      <div className="bg-card rounded-card border border-ink-08 shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-2 border-b border-ink-08">
          <div className="text-[15px] font-semibold leading-tight">Untitled</div>
        </div>
        <div className="px-5 py-4 min-h-[110px]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-45 mb-1.5">You said</div>
          <div className="text-[11.5px] text-ink-45 italic mb-3 leading-snug">"{raw}"</div>
          <div className="text-[13px] text-ink leading-snug">
            {typed}
            <span className="inline-block w-[2px] h-[14px] bg-ink ml-0.5 align-text-bottom animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Step 6: Done ──────────────────────────────────────────────────

function StepDone({ hotkey, onFinish }: { hotkey: string; onFinish: () => void }) {
  const hotkeyHint = useMemo(() => prettifyKey(hotkey), [hotkey])
  return (
    <>
      <h1 className="text-[56px] leading-[0.95] tracking-tight mb-5">
        You're <span className="font-display italic font-medium inline-block animate-heroPop origin-bottom-left">ready.</span>
      </h1>
      <p className="text-[14.5px] text-ink-60 leading-relaxed max-w-[460px] mb-6">
        Press <span className="font-mono text-ink bg-card border border-ink-08 px-1.5 py-0.5 rounded text-[13px]">{hotkeyHint}</span> anywhere on your Mac and start talking. The indicator pill appears where you left it.
      </p>

      <Card>
        <div className="px-5 py-4 max-w-[460px] text-[12px] text-ink-60 leading-relaxed">
          You can re-open these settings any time from the tray icon → Settings, or relaunch this welcome flow from Settings → General.
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
