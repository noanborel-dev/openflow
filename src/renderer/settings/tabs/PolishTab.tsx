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
// Light = very-casual, Balanced = casual, Strict = formal. Mapped 1:1
// so users can think in either language.
const LEVEL_REGISTER: Record<Strictness, string> = { 1: 'Very-casual', 2: 'Casual', 3: 'Formal' }
const ORDER: Bucket[] = ['personal', 'work', 'writing']

// Per-context example dictation + cleaned output at each level. Same
// content the onboarding uses so users see consistent examples
// between flows.
const EXAMPLES: Record<Bucket, Record<Strictness, string>> = {
  personal: {
    1: "yo so are we still on for tomorrow or like did that move",
    2: "are we still on for tomorrow or did that move",
    3: "Are we still on for tomorrow, or has it moved?",
  },
  work: {
    1: "hey just wanted to follow up on the proposal can you let me know if you got a chance to look at it",
    2: "Just following up on the proposal — can you let me know if you've had a chance to look?",
    3: "Hi — following up on the proposal. Could you let me know once you've had a chance to review it?",
  },
  writing: {
    1: "so the main idea is that we want users to feel like the app is responding to them and like adapting",
    2: "The main idea is that we want users to feel the app is responding to them and adapting.",
    3: "The core idea: users should feel the app responds and adapts to them.",
  },
}

// Bubble palette per level. Order top-to-bottom in the hero is Strict
// (formal cool gray) → Balanced (casual warm pink) → Light (very-casual
// deep purple), descending from most to least polished.
const BUBBLE_STYLES: Record<Strictness, { bg: string; fg: string }> = {
  3: { bg: '#E5E1F0', fg: '#1F1B2E' },  // Formal
  2: { bg: '#F5DCDA', fg: '#2A1A18' },  // Casual
  1: { bg: '#3F2570', fg: '#F0E6FF' },  // Very-casual
}

export default function PolishTab() {
  const [strictness, setStrictness] = useState<CategoryStrictness | null>(null)
  // Which bucket's examples the hero is showing. Hovering or clicking a
  // row updates this, and the hero re-renders with that bucket's
  // dictation + cleaned outputs. Selected level is highlighted.
  const [activeBucket, setActiveBucket] = useState<Bucket>('personal')

  useEffect(() => {
    window.openflow.getSettings().then((s: Settings) => setStrictness(s.strictness))
  }, [])

  function setLevel(bucket: Bucket, lvl: Strictness) {
    if (!strictness) return
    const next = { ...strictness, [bucket]: lvl }
    setStrictness(next)
    setActiveBucket(bucket)
    window.openflow.setSettings({ strictness: next })
  }

  if (!strictness) return <div className="text-ink-45 text-sm">Loading…</div>

  const activeLevel = strictness[activeBucket]
  const activeExamples = EXAMPLES[activeBucket]

  return (
    <div className="max-w-[760px]">
      <SectionHero
        label="POLISH"
        accent="violet"
        headline={<>One voice, <em className="font-display italic">three</em> registers.</>}
        body={
          <>
            Same content, calibrated to context. Picking a level on a row below highlights it here — that's the register
            your <span className="text-ink font-medium">{META[activeBucket].title.toLowerCase()}</span> goes out as.
          </>
        }
        visual={<RegisterBubbles bucket={activeBucket} examples={activeExamples} activeLevel={activeLevel} />}
      />

      {/* Per-context rows — three active + locked Code & Terminal. Each
          row's hover/click pulls the hero's example set to that
          context, so users can see exactly what each bucket produces
          at each level. */}
      <div className="bg-card border border-ink-08 rounded-[14px] overflow-hidden">
        {ORDER.map((bucket, i) => {
          const meta = META[bucket]
          const current = strictness[bucket]
          const isLast = i === ORDER.length - 1
          const isActive = activeBucket === bucket
          return (
            <div
              key={bucket}
              onMouseEnter={() => setActiveBucket(bucket)}
              className={[
                'grid grid-cols-[40px_1fr_auto] items-center gap-4 px-5 py-4 transition-colors',
                isLast ? '' : 'border-b border-ink-08',
                isActive ? 'bg-paper/60' : '',
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

        {/* Locked Code & Terminal row */}
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

// Three labeled bubbles for the active context. Currently-selected
// level gets a ring + checkmark + slight scale to make the connection
// between the level pill below and the actual register output explicit.
function RegisterBubbles({
  bucket,
  examples,
  activeLevel,
}: {
  bucket: Bucket
  examples: Record<Strictness, string>
  activeLevel: Strictness
}) {
  // Display order: Strict (3) at top, Balanced (2) middle, Light (1) bottom.
  // Most-polished → least-polished feels like a natural reading order.
  const levels: Strictness[] = [3, 2, 1]
  return (
    <div key={bucket} className="flex flex-col gap-2.5 w-full max-w-[300px] animate-stepIn">
      {levels.map((lvl) => {
        const style = BUBBLE_STYLES[lvl]
        const isActive = activeLevel === lvl
        return (
          <div key={lvl} className="relative">
            {/* Label row above each bubble */}
            <div className="flex items-baseline justify-between mb-0.5 px-1">
              <span className="text-[9.5px] font-mono uppercase tracking-[0.16em] text-ink-45">
                {LEVEL_LABEL[lvl]} · {LEVEL_REGISTER[lvl]}
              </span>
              {isActive && (
                <span className="text-[9.5px] font-mono uppercase tracking-[0.14em]" style={{ color: '#6B46C1' }}>
                  ← current
                </span>
              )}
            </div>
            <div
              className={[
                'rounded-[18px] px-4 py-2.5 text-[12.5px] leading-snug transition-all duration-200',
                isActive ? 'scale-[1.015]' : 'opacity-75',
              ].join(' ')}
              style={{
                background: style.bg,
                color: style.fg,
                boxShadow: isActive ? '0 0 0 2px rgba(107, 70, 193, 0.55)' : 'none',
              }}
            >
              {examples[lvl]}
            </div>
          </div>
        )
      })}
    </div>
  )
}
