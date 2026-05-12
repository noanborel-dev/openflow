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

function TerminalIcon({ size = 22, className = 'text-ink-60' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="3" />
      <path d="M7 10l3 2-3 2" />
      <line x1="13" y1="14" x2="17" y2="14" />
    </svg>
  )
}

type Bucket = keyof CategoryStrictness
type HoverCtx = Bucket | 'code' | null

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
const LEVEL_REGISTER: Record<Strictness, string> = { 1: 'Very-casual', 2: 'Casual', 3: 'Formal' }
const ORDER: Bucket[] = ['personal', 'work', 'writing']

// Per-context example dictation + cleaned output at each level.
// Topics intentionally NOT lunch — keep us differentiated from
// Wispr Flow's example. Personal = picking up a package, Work =
// proposal follow-up, Writing = product idea.
const EXAMPLES: Record<Bucket, { raw: string; outputs: Record<Strictness, string> }> = {
  personal: {
    raw: "yo um did you get the package i sent like the one with the book",
    outputs: {
      1: "yo did you get the package i sent like the one with the book",
      2: "did you get the package I sent? the one with the book",
      3: "Did the package make it to you — the one with the book?",
    },
  },
  work: {
    raw: "hey just wanted to follow up on the proposal um can you let me know if you got a chance to look at it",
    outputs: {
      1: "hey just wanted to follow up on the proposal can you let me know if you got a chance to look at it",
      2: "Just following up on the proposal — can you let me know if you've had a chance to look?",
      3: "Hi — following up on the proposal. Could you let me know once you've had a chance to review it?",
    },
  },
  writing: {
    raw: "so the main idea is that um we want users to feel like the app is responding to them and like adapting",
    outputs: {
      1: "so the main idea is that we want users to feel like the app is responding to them and like adapting",
      2: "The main idea is that we want users to feel the app is responding to them and adapting.",
      3: "The core idea: users should feel the app responds and adapts to them.",
    },
  },
}

// Code is FAITHFUL — single example, single output, never level-dependent.
const CODE_EXAMPLE = {
  raw: "git commit dash m fix the um the bug in user auth",
  output: "git commit -m \"fix the bug in user auth\"",
}

const BUBBLE_STYLES: Record<Strictness, { bg: string; fg: string }> = {
  3: { bg: '#E5E1F0', fg: '#1F1B2E' },
  2: { bg: '#F5DCDA', fg: '#2A1A18' },
  1: { bg: '#3F2570', fg: '#F0E6FF' },
}

// Char-by-char typewriter for cleaned-output renders inside mocks.
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

export default function PolishTab() {
  const [strictness, setStrictness] = useState<CategoryStrictness | null>(null)
  // hoverCtx is the row the pointer is over right now; activeBucket is
  // the row whose level pills you most recently touched. When the pointer
  // leaves all rows, the hero falls back to the abstract register-bubble
  // view tied to activeBucket.
  const [hoverCtx, setHoverCtx] = useState<HoverCtx>(null)
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

  // Decide what the hero shows. Hover wins; otherwise fall back to the
  // resting register-bubble view for activeBucket.
  const showMock = hoverCtx !== null
  const heroBucketForBody = hoverCtx === 'code' ? null : (hoverCtx ?? activeBucket)

  return (
    <div className="max-w-[760px]">
      <SectionHero
        label="POLISH"
        accent="violet"
        headline={<>One voice, <em className="font-display italic">three</em> registers.</>}
        body={
          heroBucketForBody
            ? <>Same content, calibrated to context. Hovering a row shows what {META[heroBucketForBody].title.toLowerCase()} looks like inside the actual app — at the level you've picked.</>
            : <>Same content, calibrated to context. Code &amp; Terminal stay faithful — words are never dropped there. Hover a row below to preview.</>
        }
        visual={
          <HeroVisual
            mode={showMock ? (hoverCtx === 'code' ? 'code' : 'mock') : 'resting'}
            bucket={heroBucketForBody}
            level={heroBucketForBody ? strictness[heroBucketForBody] : strictness[activeBucket]}
          />
        }
      />

      {/* Per-context rows. mouseEnter sets hoverCtx; mouseLeave clears
          it. The level pills below update the saved strictness AND
          mark this bucket as the resting-state default. */}
      <div
        className="bg-card border border-ink-08 rounded-[14px] overflow-hidden"
        onMouseLeave={() => setHoverCtx(null)}
      >
        {ORDER.map((bucket, i) => {
          const meta = META[bucket]
          const current = strictness[bucket]
          const isLast = i === ORDER.length - 1
          const isHovered = hoverCtx === bucket
          return (
            <div
              key={bucket}
              onMouseEnter={() => setHoverCtx(bucket)}
              className={[
                'grid grid-cols-[40px_1fr_auto] items-center gap-4 px-5 py-4 transition-colors',
                isLast ? '' : 'border-b border-ink-08',
                isHovered ? 'bg-paper/60' : '',
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

        {/* Code & Terminal — locked but still hoverable so users can see
            what Faithful mode produces in a Terminal canvas. */}
        <div
          onMouseEnter={() => setHoverCtx('code')}
          className={[
            'grid grid-cols-[40px_1fr_auto] items-center gap-4 px-5 py-4 border-t border-ink-08 transition-colors',
            hoverCtx === 'code' ? 'bg-paper/60' : 'bg-paper/40',
          ].join(' ')}
        >
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center bg-ink/[0.04]">
            <TerminalIcon />
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold leading-tight text-ink-60">Code & Terminal</div>
            <div className="text-[11px] text-ink-45 mt-0.5">VS Code · Terminal · iTerm — faithful, always.</div>
          </div>
          <span className="text-[11px] font-mono text-ink-45 px-3 py-1.5">Locked</span>
        </div>
      </div>
    </div>
  )
}

// HeroVisual: fixed-size canvas so the hero never resizes while the
// user moves their pointer across rows. The actual mock is rendered
// inside via React-key-based remount, so swapping contexts just
// re-mounts the inner element with an opacity-only fade-in. No
// height changes, no scale, no translate — kills the bounce/shake.
function HeroVisual({
  mode, bucket, level,
}: {
  mode: 'resting' | 'mock' | 'code'
  bucket: Bucket | null
  level: Strictness
}) {
  const key = `${mode}-${bucket ?? 'none'}-${level}`
  return (
    <div className="relative w-[300px] h-[280px] flex items-center justify-center">
      <style>{`
        @keyframes polishFadeIn {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        .polish-fade { animation: polishFadeIn 220ms ease-out both; }
      `}</style>
      <div key={key} className="polish-fade w-full">
        {mode === 'resting' && <RegisterBubbles />}
        {mode === 'code' && <TerminalMock />}
        {mode === 'mock' && bucket === 'personal' && (
          <IMessageMock raw={EXAMPLES.personal.raw} cleaned={EXAMPLES.personal.outputs[level]} />
        )}
        {mode === 'mock' && bucket === 'work' && (
          <EmailMock raw={EXAMPLES.work.raw} cleaned={EXAMPLES.work.outputs[level]} />
        )}
        {mode === 'mock' && bucket === 'writing' && (
          <NotionMock raw={EXAMPLES.writing.raw} cleaned={EXAMPLES.writing.outputs[level]} />
        )}
      </div>
    </div>
  )
}

// ─── Resting state: abstract register-bubble showcase ───────────────

function RegisterBubbles() {
  const levels: Strictness[] = [3, 2, 1]
  // Generic dictation tied to no specific bucket — intentionally NOT
  // lunch-themed (that's Wispr Flow's example). A "send me the draft"
  // ask reads natural across all three registers.
  const examples: Record<Strictness, string> = {
    3: "Hi — when you have a moment, could you take a look at the draft I shared?",
    2: "Hey, when you get a sec, can you look at the draft I shared?",
    1: "hey can you check out the draft i sent when you get a sec",
  }
  return (
    <div className="flex flex-col gap-2 w-full max-w-[300px]">
      {levels.map((lvl) => {
        const style = BUBBLE_STYLES[lvl]
        return (
          <div key={lvl}>
            <div className="text-[9.5px] font-mono uppercase tracking-[0.16em] text-ink-45 mb-0.5 px-1">
              {LEVEL_LABEL[lvl]} · {LEVEL_REGISTER[lvl]}
            </div>
            <div className="rounded-[16px] px-3.5 py-2 text-[12px] leading-snug"
                 style={{ background: style.bg, color: style.fg }}>
              {examples[lvl]}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── App-specific mocks ─────────────────────────────────────────────

function MockChrome({ icon, label, children }: { icon?: BrandRef; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        {icon && <BrandIcon icon={icon} size={13} />}
        <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-ink-45">{label}</div>
      </div>
      <div className="bg-card rounded-[12px] border border-ink-08 shadow-sm overflow-hidden">
        {children}
      </div>
    </div>
  )
}

function IMessageMock({ raw, cleaned }: { raw: string; cleaned: string }) {
  const typed = useTypewriter(cleaned)
  return (
    <MockChrome icon={siImessage as BrandRef} label="iMessage">
      <div className="px-3 py-3">
        <div className="text-center text-[10px] text-ink-45 mb-2.5 font-mono">Today 2:14 PM</div>
        <div className="flex justify-start mb-2">
          <div className="bg-[#e9e9eb] text-ink text-[12.5px] px-3 py-1.5 rounded-[16px] rounded-bl-[4px] max-w-[78%] leading-snug">
            {raw}
          </div>
        </div>
        <div className="flex justify-end">
          <div className="bg-[#0b93f6] text-white text-[12.5px] px-3 py-1.5 rounded-[16px] rounded-br-[4px] max-w-[78%] leading-snug">
            {typed}
            <span className="inline-block w-[2px] h-[12px] bg-white/80 ml-0.5 align-text-bottom animate-pulse" />
          </div>
        </div>
      </div>
    </MockChrome>
  )
}

function EmailMock({ raw, cleaned }: { raw: string; cleaned: string }) {
  const typed = useTypewriter(cleaned)
  return (
    <MockChrome icon={siGmail as BrandRef} label="Gmail · Compose">
      <div className="px-4 py-2.5 border-b border-ink-08 bg-paper/40">
        <div className="text-[11px] text-ink-45">To: <span className="text-ink">alex@company.com</span></div>
        <div className="text-[11px] text-ink-45 mt-1">Subject: <span className="text-ink">Quick follow-up</span></div>
      </div>
      <div className="px-4 py-3 min-h-[120px]">
        <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-ink-45 mb-1.5">You said</div>
        <div className="text-[11.5px] text-ink-45 italic mb-3 leading-snug">"{raw}"</div>
        <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-ink-45 mb-1.5">OpenFlow types</div>
        <div className="text-[13px] text-ink leading-snug">
          {typed}
          <span className="inline-block w-[2px] h-[14px] bg-ink ml-0.5 align-text-bottom animate-pulse" />
        </div>
      </div>
    </MockChrome>
  )
}

function NotionMock({ raw, cleaned }: { raw: string; cleaned: string }) {
  const typed = useTypewriter(cleaned)
  return (
    <MockChrome icon={siNotion as BrandRef} label="Notion · Page">
      <div className="px-5 pt-4 pb-2 border-b border-ink-08">
        <div className="text-[15px] font-semibold leading-tight">Untitled</div>
      </div>
      <div className="px-5 py-4 min-h-[120px]">
        <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-ink-45 mb-1.5">You said</div>
        <div className="text-[11.5px] text-ink-45 italic mb-3 leading-snug">"{raw}"</div>
        <div className="text-[13px] text-ink leading-snug">
          {typed}
          <span className="inline-block w-[2px] h-[14px] bg-ink ml-0.5 align-text-bottom animate-pulse" />
        </div>
      </div>
    </MockChrome>
  )
}

function TerminalMock() {
  const typed = useTypewriter(CODE_EXAMPLE.output)
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <TerminalIcon size={13} className="text-ink-45" />
        <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-ink-45">Terminal · faithful</div>
      </div>
      <div className="bg-[#0E1018] rounded-[12px] border border-[#1F2330] shadow-sm overflow-hidden">
        {/* Mac-style traffic light chrome */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#1F2330]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
          <span className="ml-2 text-[10px] font-mono text-[#7C8696]">zsh — 80×24</span>
        </div>
        <div className="px-3 py-3 font-mono text-[11.5px] leading-[1.6]">
          <div className="text-[#7C8696] mb-1.5">you said: <span className="italic">"{CODE_EXAMPLE.raw}"</span></div>
          <div className="text-[#9DDC4E]">
            <span className="text-[#7C8696]">$ </span>
            <span className="text-white">{typed}</span>
            <span className="inline-block w-[6px] h-[12px] bg-[#9DDC4E] ml-0.5 align-text-bottom animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
