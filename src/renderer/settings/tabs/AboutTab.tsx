import { useEffect, useState } from 'react'
import type { Settings } from '../../../shared/types'
import { Wordmark } from '../../shared/ui/Wordmark'

const VERSION = '0.1.0'
const BUILD = '218'   // build number stamped at package time; placeholder for now
const ARCH = 'arm64'  // populated later from process.arch via IPC

export default function AboutTab() {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    window.yappr.getSettings().then(setSettings)
  }, [])

  const providerName = providerLabel(settings?.provider.provider)

  return (
    <div className="max-w-[840px] space-y-4">
      {/* Hero card with mark + version + status pills + update CTA */}
      <div className="bg-card border border-ink-08 rounded-[16px] px-7 py-7 relative overflow-hidden"
           style={{
             backgroundImage:
               'radial-gradient(circle at 100% 0%, rgba(43,127,255,0.05), transparent 50%)',
           }}>
        <div className="flex items-center gap-5">
          <Wordmark size="hero" />
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] font-mono text-ink-60">
              v{VERSION} · Build {BUILD} · macOS
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-pill bg-ok/10 text-ok text-[10.5px] font-mono uppercase tracking-[0.12em]">
                <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                up to date
              </span>
              <span className="px-2 py-1 rounded-pill bg-ink-08 text-ink-60 text-[10.5px] font-mono uppercase tracking-[0.12em]">
                BYOK
              </span>
              <span className="px-2 py-1 rounded-pill bg-ink-08 text-ink-60 text-[10.5px] font-mono uppercase tracking-[0.12em]">
                no telemetry
              </span>
            </div>
          </div>
          <button
            onClick={() => window.open('https://yappr.app/download', '_blank')}
            className="bg-ink text-paper px-4 py-2.5 rounded-pill text-[12.5px] font-medium hover:opacity-90 transition-opacity shrink-0"
          >
            Check for updates
          </button>
        </div>
      </div>

      {/* License key — placeholder UI. Persistence works; validation
          and feature-gating ship with the Stripe SKU. Today it just
          stores the key locally so the surface is real when payments
          go live. */}
      <LicenseCard settings={settings} onChange={setSettings} />

      {/* Voice flow diagram — emphasizes the proxy-skip story */}
      <div className="bg-card border border-ink-08 rounded-[16px] px-6 py-6">
        <div className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-ink-45 mb-4">
          Where your voice goes
        </div>
        <div className="flex items-center gap-3">
          <FlowNode label="Your Mac" icon="mic" />
          <FlowArrow />
          <FlowNode label="Yappr servers" icon="proxy" badge="skipped" muted />
          <FlowArrow />
          <FlowNode label="Your provider" icon="transcript" />
        </div>
        <p className="text-[11.5px] text-ink-60 leading-relaxed mt-4">
          Your voice goes from your mic to your API provider. Yappr never sees or stores your audio,
          transcripts, or API keys on any server we control.
        </p>
      </div>

      {/* Resources + Diagnostics, two columns */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-ink-08 rounded-[16px] px-5 py-5">
          <div className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-ink-45 mb-3">Resources</div>
          <div className="space-y-3">
            <ResourceLink href="https://yappr.app" label="yappr.app" />
            <ResourceLink href="https://yappr.app/privacy" label="Privacy policy" />
            <ResourceLink href="https://yappr.app/licenses" label="Third-party licenses" />
          </div>
        </div>
        <div className="bg-card border border-ink-08 rounded-[16px] px-5 py-5">
          <div className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-ink-45 mb-3">Diagnostics</div>
          <DiagRow label="Build" value={`${BUILD} · ${ARCH}`} />
          <DiagRow label="Provider" value={providerName} />
          <DiagRow
            label="Log file"
            value={
              <button
                onClick={() => window.yappr.revealLog()}
                className="text-ink underline underline-offset-2 hover:opacity-70 cursor-pointer text-[11.5px]"
              >
                Reveal in Finder ↗
              </button>
            }
            isLast
          />
        </div>
      </div>

      <p className="text-[10.5px] text-ink-45 px-1 leading-relaxed">
        Your voice goes from your mic to your API provider. Yappr never sees or stores your audio, transcripts, or API keys on any server we control.
      </p>

      <p className="text-[10px] text-ink-45 px-1 leading-relaxed">
        Built with Llama. Llama 3 is licensed under the Llama 3 Community License, Copyright © Meta Platforms, Inc.
        Slack, Gmail, iMessage, Notion, Cursor, ChatGPT, Claude, Groq, Llama, and Whisper are trademarks of their
        respective owners. Yappr is not affiliated with or endorsed by these companies.
      </p>
    </div>
  )
}

function FlowNode({
  label, icon, muted, badge,
}: {
  label: string
  icon: 'mic' | 'proxy' | 'transcript'
  muted?: boolean
  badge?: string
}) {
  return (
    <div className={[
      'flex-1 rounded-[12px] px-3 py-3.5 text-center relative',
      muted ? 'bg-paper/40 border border-dashed border-ink-08' : 'bg-paper/60 border border-ink-08',
    ].join(' ')}>
      {badge && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-[0.14em] bg-[#C94A2A]/12 text-[#C94A2A] border border-[#C94A2A]/25">
          {badge}
        </span>
      )}
      <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-ink-45 mb-1.5">
        {label}
      </div>
      <div className={['text-[12px] font-semibold inline-flex items-center gap-1.5 justify-center',
                       muted ? 'text-ink-45 line-through decoration-ink-45' : ''].join(' ')}>
        <FlowIcon kind={icon} />
        {iconLabel(icon)}
      </div>
    </div>
  )
}

function FlowArrow() {
  return (
    <span className="text-ink-45 text-[16px] shrink-0" aria-hidden>→</span>
  )
}

function FlowIcon({ kind }: { kind: 'mic' | 'proxy' | 'transcript' }) {
  const stroke = 'currentColor'
  if (kind === 'mic') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="3" width="6" height="12" rx="3"/>
        <path d="M5 12a7 7 0 0 0 14 0"/>
        <line x1="12" y1="19" x2="12" y2="22"/>
      </svg>
    )
  }
  if (kind === 'proxy') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <line x1="3" y1="12" x2="21" y2="12" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
      <polyline points="14 3 14 9 20 9"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="13" y2="17"/>
    </svg>
  )
}

function iconLabel(kind: 'mic' | 'proxy' | 'transcript'): string {
  if (kind === 'mic') return 'mic'
  if (kind === 'proxy') return 'proxy'
  return 'transcript'
}

function ResourceLink({ href, label }: { href: string; label: string }) {
  return (
    <button
      onClick={() => window.open(href, '_blank')}
      className="w-full flex items-center justify-between text-[12px] hover:opacity-70 transition-opacity"
    >
      <span className="underline underline-offset-2 truncate">{label}</span>
      <span className="text-ink-45 ml-2 shrink-0">↗</span>
    </button>
  )
}

function DiagRow({
  label, value, isLast,
}: {
  label: string
  value: React.ReactNode
  isLast?: boolean
}) {
  return (
    <div className={[
      'flex items-center justify-between py-2 text-[11.5px]',
      isLast ? '' : 'border-b border-dashed border-ink-08',
    ].join(' ')}>
      <span className="text-ink-60">{label}</span>
      <span className="font-mono text-ink">{value}</span>
    </div>
  )
}

function providerLabel(p?: string): string {
  if (p === 'local') return 'Local · whisper.cpp'
  return 'Groq · Whisper'
}

// Lifetime / Pro license-key card. The Stripe checkout isn't live yet,
// so this is an interest-capture + persistence surface only:
//   - Empty state → "Coming soon" with a "Get notified" mailto button.
//   - User pastes a key anyway → we store it locally (no network call,
//     no validation) so when activation ships the key will already be
//     in place and we can validate on next launch.
function LicenseCard({
  settings,
  onChange,
}: {
  settings: Settings | null
  onChange: (s: Settings) => void
}) {
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setDraft(settings?.licenseKey ?? '')
  }, [settings?.licenseKey])

  if (!settings) return null

  const stored = settings.licenseKey ?? ''
  const dirty = draft.trim() !== stored.trim()

  async function save() {
    if (!settings) return
    const key = draft.trim()
    await window.yappr.setSettings({ licenseKey: key })
    onChange({ ...settings, licenseKey: key })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1500)
  }

  async function clear() {
    if (!settings) return
    setDraft('')
    await window.yappr.setSettings({ licenseKey: '' })
    onChange({ ...settings, licenseKey: '' })
  }

  return (
    <div className="bg-card border border-ink-08 rounded-[16px] px-6 py-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-ink-45">
          Lifetime license
        </div>
        <span className="px-2 py-0.5 rounded-pill bg-ink-08 text-ink-60 text-[9.5px] font-mono uppercase tracking-[0.12em]">
          Coming soon
        </span>
      </div>

      <p className="text-[11.5px] text-ink-60 leading-relaxed mb-3">
        Paid tiers aren&rsquo;t live yet. When Lifetime launches you&rsquo;ll
        get a one-time activation key by email; paste it here to unlock
        Pro features forever. Everything in Yappr today is free.
      </p>

      <div className="flex items-stretch gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Paste your license key…"
          className="flex-1 bg-paper border border-ink-08 rounded-[10px] px-3 py-2 text-[12px] font-mono focus:outline-none focus:border-volt focus:ring-2 focus:ring-volt-muted"
          spellCheck={false}
          autoComplete="off"
        />
        {stored.length > 0 && !dirty ? (
          <button
            onClick={clear}
            className="text-[11.5px] text-ink-60 hover:text-ink hover:bg-ink-08 border border-ink-08 rounded-[10px] px-3 transition-colors"
          >
            Remove
          </button>
        ) : (
          <button
            onClick={save}
            disabled={!dirty || draft.trim().length === 0}
            className={`text-[11.5px] font-medium rounded-[10px] px-4 transition-colors ${
              saved
                ? 'bg-ok/15 text-ok border border-ok/30'
                : 'bg-ink text-paper hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {saved ? 'Saved' : 'Save'}
          </button>
        )}
        <button
          onClick={() => window.open(
            'mailto:hello@yappr.app?subject=Notify%20me%20when%20Lifetime%20launches',
            '_blank',
          )}
          className="text-[11.5px] text-ink-60 hover:text-ink hover:bg-ink-08 border border-ink-08 rounded-[10px] px-3 transition-colors"
        >
          Notify me
        </button>
      </div>

      {stored.length > 0 && !dirty && (
        <p className="text-[10.5px] text-ink-45 mt-2.5 font-mono">
          Key stored locally. Validation will run when activation ships.
        </p>
      )}
    </div>
  )
}
