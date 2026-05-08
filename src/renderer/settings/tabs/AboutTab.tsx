import { useEffect, useState } from 'react'
import type { Settings } from '../../../shared/types'

const VERSION = '0.1.0'
const BUILD = '218'   // build number stamped at package time; placeholder for now
const ARCH = 'arm64'  // populated later from process.arch via IPC

export default function AboutTab() {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    window.openflow.getSettings().then(setSettings)
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
          <div className="w-[72px] h-[72px] rounded-[16px] bg-ink text-paper flex items-center justify-center shrink-0">
            <span className="font-display italic text-[42px] leading-none -mt-1">O</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[24px] font-semibold tracking-tight leading-none mb-1.5">OpenFlow</div>
            <div className="text-[11.5px] font-mono text-ink-60">
              v{VERSION} · Build {BUILD} · macOS
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-pill bg-ok/10 text-ok text-[10.5px] font-mono uppercase tracking-[0.12em]">
                <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                up to date
              </span>
              <span className="px-2 py-1 rounded-pill bg-ink-08 text-ink-60 text-[10.5px] font-mono uppercase tracking-[0.12em]">
                MIT license
              </span>
              <span className="px-2 py-1 rounded-pill bg-ink-08 text-ink-60 text-[10.5px] font-mono uppercase tracking-[0.12em]">
                open source
              </span>
            </div>
          </div>
          <button
            onClick={() => window.open('https://github.com/openflow-app/openflow/releases', '_blank')}
            className="bg-ink text-paper px-4 py-2.5 rounded-pill text-[12.5px] font-medium hover:opacity-90 transition-opacity shrink-0"
          >
            Check for updates
          </button>
        </div>
      </div>

      {/* Voice flow diagram — emphasizes the proxy-skip story */}
      <div className="bg-card border border-ink-08 rounded-[16px] px-6 py-6">
        <div className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-ink-45 mb-4">
          Where your voice goes
        </div>
        <div className="flex items-center gap-3">
          <FlowNode label="Your Mac" icon="mic" />
          <FlowArrow />
          <FlowNode label="OpenFlow servers" icon="proxy" badge="skipped" muted />
          <FlowArrow />
          <FlowNode label="Your provider" icon="transcript" />
        </div>
        <p className="text-[11.5px] text-ink-60 leading-relaxed mt-4">
          Your voice goes from your mic to your API provider. OpenFlow never sees or stores your audio,
          transcripts, or API keys on any server we control.
        </p>
      </div>

      {/* Resources + Diagnostics, two columns */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-ink-08 rounded-[16px] px-5 py-5">
          <div className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-ink-45 mb-3">Resources</div>
          <div className="space-y-3">
            <ResourceLink href="https://github.com/openflow-app/openflow" label="github.com/openflow-app/openflow" />
            <ResourceLink href="https://docs.openflow.app" label="docs.openflow.app" />
            <ResourceLink href="https://github.com/openflow-app/openflow/releases" label="Release notes" />
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
                onClick={() => window.openflow.revealLog()}
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
        Your voice goes from your mic to your API provider. OpenFlow never sees or stores your audio, transcripts, or API keys on any server we control.
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
  if (p === 'openai')    return 'OpenAI · Whisper'
  if (p === 'anthropic') return 'Anthropic · Claude'
  if (p === 'local')     return 'Local · whisper.cpp'
  return 'Groq · Whisper'
}
