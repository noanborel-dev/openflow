import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [accessibilityGranted, setAccessibilityGranted] = useState(false)

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
            accessibilityGranted={accessibilityGranted}
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
  accessibilityGranted,
  onRequestMic,
  onOpenAccessibility,
  onContinue,
}: {
  micGranted: boolean
  accessibilityGranted: boolean
  onRequestMic: () => void
  onOpenAccessibility: () => void
  onContinue: () => void
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
        />
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
        One key. Three behaviors. Try each one — your hotkey is{' '}
        <button
          onClick={onToggleListen}
          className="font-mono text-[12.5px] bg-card border border-ink-08 px-2 py-0.5 rounded hover:border-ink-45 transition-colors"
        >
          {listening ? 'press any key…' : prettifyKey(hotkey)}
        </button>
        {!listening && '. Click to change.'}
      </p>

      {/* Live key visualization. Pulses while pressed, fills the bar to
          show how long you've held. */}
      <div className="max-w-[460px] mb-6">
        <div
          className={[
            'relative h-[88px] bg-card border-2 rounded-card flex items-center justify-center transition-all duration-150',
            pressing ? 'border-volt scale-[1.015]' : 'border-ink-08',
          ].join(' ')}
        >
          <div className="font-display italic text-[28px] text-ink select-none">
            {prettifyKey(hotkey)}
          </div>
          {/* Hold-progress fill */}
          <div
            className="absolute inset-x-0 bottom-0 h-1 bg-volt rounded-b-card transition-[width] duration-75"
            style={{ width: `${holdProgress * 100}%` }}
          />
          {pressing && (
            <div className="absolute inset-0 rounded-card pointer-events-none animate-voltPulse" />
          )}
        </div>
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

// ─── Step 5: Strictness — visual preview ───────────────────────────

const STRICTNESS_RAW =
  "um so I was thinking that maybe like we should you know set up a meeting tomorrow or something to go over the launch stuff"

const STRICTNESS_PREVIEW: Record<Strictness, { name: string; blurb: string; output: string }> = {
  1: {
    name: 'Light',
    blurb: 'Strip filler. Keep your voice.',
    output:
      "so I was thinking that maybe like we should set up a meeting tomorrow or something to go over the launch stuff",
  },
  2: {
    name: 'Balanced',
    blurb: 'Polish wording. Drop verbal padding.',
    output:
      "I was thinking maybe we should set up a meeting tomorrow to go over the launch stuff.",
  },
  3: {
    name: 'Strict',
    blurb: 'Restructure into clean prose.',
    output:
      "Let's set up a meeting tomorrow to review the launch.",
  },
}

function StepStrictness({
  value,
  onChange,
  onContinue,
}: {
  value: Strictness
  onChange: (v: Strictness) => void
  onContinue: () => void
}) {
  const preview = STRICTNESS_PREVIEW[value]
  return (
    <>
      <h1 className="text-[42px] leading-[0.98] tracking-tight mb-4">
        How <span className="font-display italic font-medium inline-block animate-heroPop origin-bottom-left">polished?</span>
      </h1>
      <p className="text-[13.5px] text-ink-60 leading-relaxed max-w-[460px] mb-6">
        Your default cleanup level. Email and docs lean stricter automatically; iMessage and Slack lean looser. Click a level to see what you'd actually get.
      </p>

      {/* Big before/after preview. The only thing that changes between
          levels is the "after" line — the input stays put as the anchor. */}
      <div className="max-w-[640px] bg-card border border-ink-08 rounded-card overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-ink-08 bg-paper/60">
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-45 mb-1.5">
            You said
          </div>
          <div className="text-[14px] text-ink-60 leading-relaxed italic">
            "{STRICTNESS_RAW}"
          </div>
        </div>
        <div className="px-5 py-5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-45 mb-1.5 flex items-center gap-2">
            <span>OpenFlow types</span>
            <span className="font-mono text-[9.5px] text-ink-45 bg-paper px-1.5 py-0.5 rounded">
              L{value} · {preview.name}
            </span>
          </div>
          <div
            key={value}
            className="text-[17px] text-ink leading-snug font-medium animate-stepIn"
          >
            {preview.output}
          </div>
        </div>
      </div>

      {/* Three pill-style level pickers under the preview. */}
      <div className="flex items-center gap-2 max-w-[640px] mb-6">
        {([1, 2, 3] as Strictness[]).map((level) => {
          const opt = STRICTNESS_PREVIEW[level]
          const selected = value === level
          return (
            <button
              key={level}
              onClick={() => onChange(level)}
              className={[
                'flex-1 text-left rounded-card px-4 py-3 border transition-all duration-200 cursor-pointer',
                selected
                  ? 'bg-ink text-paper border-ink -translate-y-0.5'
                  : 'bg-card text-ink border-ink-08 hover:border-ink-45 hover:-translate-y-0.5',
              ].join(' ')}
            >
              <div className="flex items-baseline justify-between mb-0.5">
                <div className="text-[13.5px] font-semibold">{opt.name}</div>
                <span className={['font-mono text-[10px]', selected ? 'text-paper/60' : 'text-ink-45'].join(' ')}>
                  L{level}
                </span>
              </div>
              <div className={['text-[11px] leading-snug', selected ? 'text-paper/70' : 'text-ink-60'].join(' ')}>
                {opt.blurb}
              </div>
            </button>
          )
        })}
      </div>

      <Pill variant="primary" onClick={onContinue}>
        Continue →
      </Pill>
    </>
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
