import { useEffect, useState } from 'react'
import { siGmail, siImessage, siNotion } from 'simple-icons'
import type { CategoryStrictness, Settings, Strictness } from '../../../shared/types'
import { SectionHero } from '../../shared/ui/SectionHero'

interface BrandRef { title: string; hex: string; path: string }

function BrandIcon({ icon, size = 24 }: { icon: BrandRef; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label={icon.title}>
      <path d={icon.path} fill={`#${icon.hex}`} />
    </svg>
  )
}

function TerminalIcon({ size = 22 }: { size?: number }) {
  // Minimal terminal glyph — kept low-contrast since this row is locked
  // and shouldn't compete visually with the active rows.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-60">
      <rect x="2.5" y="4.5" width="19" height="15" rx="3" />
      <path d="M7 10l3 2-3 2" />
      <line x1="13" y1="14" x2="17" y2="14" />
    </svg>
  )
}

type Bucket = keyof CategoryStrictness

const META: Record<Bucket, { title: string; sub: string; icon: 'imessage' | 'gmail' | 'notion' }> = {
  personal: { title: 'Personal messaging', sub: 'iMessage · WhatsApp · Telegram', icon: 'imessage' },
  work:     { title: 'Work messaging',     sub: 'Slack · Discord · Gmail · Outlook', icon: 'gmail' },
  writing:  { title: 'Writing & AI',       sub: 'Notion · Google Docs · Claude · ChatGPT', icon: 'notion' },
}
const ICONS: Record<'imessage' | 'gmail' | 'notion', BrandRef> = {
  imessage: siImessage as BrandRef,
  gmail:    siGmail as BrandRef,
  notion:   siNotion as BrandRef,
}

const LEVEL_LABEL: Record<Strictness, string> = { 1: 'Light', 2: 'Balanced', 3: 'Strict' }
const ORDER: Bucket[] = ['personal', 'work', 'writing']

export default function PolishTab() {
  const [strictness, setStrictness] = useState<CategoryStrictness | null>(null)

  useEffect(() => {
    window.openflow.getSettings().then((s: Settings) => setStrictness(s.strictness))
  }, [])

  function setLevel(bucket: Bucket, lvl: Strictness) {
    if (!strictness) return
    const next = { ...strictness, [bucket]: lvl }
    setStrictness(next)
    window.openflow.setSettings({ strictness: next })
  }

  if (!strictness) return <div className="text-ink-45 text-sm">Loading…</div>

  return (
    <div className="max-w-[760px]">
      <SectionHero
        number="01"
        label="POLISH"
        accent="green"
        headline={<>Strikes, <em className="font-display italic">never</em> drops.</>}
        body="Filler words, false starts, repeated phrasing — gone. The actual sentence is preserved."
        visual={<RawPolishedPreview />}
      />

      {/* Per-context rows — three active + locked Code & Terminal */}
      <div className="bg-card border border-ink-08 rounded-[14px] overflow-hidden">
        {ORDER.map((bucket, i) => {
          const meta = META[bucket]
          const current = strictness[bucket]
          const isLast = i === ORDER.length - 1
          return (
            <div
              key={bucket}
              className={[
                'grid grid-cols-[40px_1fr_auto] items-center gap-4 px-5 py-4',
                isLast ? '' : 'border-b border-ink-08',
              ].join(' ')}
            >
              <div className="w-9 h-9 rounded-[10px] flex items-center justify-center"
                   style={{ background: 'rgba(0,0,0,0.03)' }}>
                <BrandIcon icon={ICONS[meta.icon]} size={22} />
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold leading-tight">{meta.title}</div>
                <div className="text-[11px] text-ink-45 mt-0.5">{meta.sub}</div>
              </div>
              <div className="flex items-center gap-1">
                {([1, 2, 3] as Strictness[]).map((lvl) => {
                  const selected = current === lvl
                  return (
                    <button
                      key={lvl}
                      onClick={() => setLevel(bucket, lvl)}
                      className={[
                        'px-3.5 py-1.5 rounded-pill text-[11.5px] font-medium transition-all duration-150',
                        selected
                          ? 'bg-ink text-paper'
                          : 'text-ink-60 hover:text-ink',
                      ].join(' ')}
                    >
                      {LEVEL_LABEL[lvl]}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Locked Code & Terminal row — visually quieter, can't be changed */}
        <div className="grid grid-cols-[40px_1fr_auto] items-center gap-4 px-5 py-4 border-t border-ink-08 bg-paper/40">
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center bg-ink/[0.04]">
            <TerminalIcon />
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold leading-tight text-ink-60">Code & Terminal</div>
            <div className="text-[11px] text-ink-45 mt-0.5">VS Code · Terminal · iTerm — faithful transcription, always.</div>
          </div>
          <span className="text-[11px] font-mono text-ink-45 px-3 py-1.5">Locked</span>
        </div>
      </div>
    </div>
  )
}

function RawPolishedPreview() {
  return (
    <div className="bg-paper/60 border border-ink-08 rounded-[12px] px-4 py-4 w-full max-w-[280px] text-[12px] leading-relaxed">
      <div className="text-[9.5px] font-mono uppercase tracking-[0.16em] text-ink-45 mb-1.5">Raw</div>
      <div className="text-ink-60 mb-3">
        <s className="text-[#C94A2A]/70 decoration-[#C94A2A]/70">um</s>{' '}so I need to{' '}
        <s className="text-[#C94A2A]/70 decoration-[#C94A2A]/70">like</s>{' '}reply to Sarah about the thursday meeting{' '}
        <s className="text-[#C94A2A]/70 decoration-[#C94A2A]/70">basically</s>
      </div>
      <div className="text-[9.5px] font-mono uppercase tracking-[0.16em] text-[#3D7E3D] mb-1.5">Polished</div>
      <div className="text-ink font-medium">
        So I need to reply to Sarah about the <span className="border-b-[1.5px] border-[#3D7E3D]">Thursday</span> meeting.
      </div>
    </div>
  )
}
