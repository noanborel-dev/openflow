import { useEffect, useState } from 'react'
import { SectionHero } from '../../shared/ui/SectionHero'
import { BrandLogo } from '../../shared/ui/BrandLogo'

// AI tab — two visual mocks, both animated.
//
//   HERO: chat input morphs from rambly dictation to a clean prompt
//   when OpenFlow detects you're in a chatbot.
//
//   BODY: cycles through realistic mockups of iMessage / Gmail / Notion.
//   Each mock includes the actual app's sidebar / chrome / signature
//   elements so the user recognizes it at a glance.

export default function AITab() {
  return (
    <div className="max-w-[760px]">
      <SectionHero
        label="AI"
        accent="violet"
        headline={<>Prompts engineered from your <em className="font-display italic">voice.</em></>}
        body="When you're typing into Claude, ChatGPT, or Cursor, OpenFlow rewrites your speech as a clean prompt — not a transcript."
        visual={<ChatPromptMock />}
      />

      <div className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-ink-45 mb-3 px-1 mt-2">
        Or — highlight, speak, rewrite. Anywhere.
      </div>
      <AppMockCycle />
    </div>
  )
}

// ─── Hero: chat-input morph ────────────────────────────────────────

function ChatPromptMock() {
  return (
    <div className="relative w-[300px] h-[200px] bg-paper border border-ink-08 rounded-[14px] overflow-hidden flex flex-col">
      <style>{`
        @keyframes chat-raw-fade  { 0%, 32% { opacity: 1; } 42%, 100% { opacity: 0; } }
        @keyframes chat-clean-fade { 0%, 38% { opacity: 0; transform: translateY(3px); } 50%, 100% { opacity: 1; transform: translateY(0); } }
        @keyframes chat-caret { 0%, 49%, 100% { opacity: 1; } 50%, 99% { opacity: 0; } }
        .chat-raw   { animation: chat-raw-fade   5s ease-in-out infinite; }
        .chat-clean { animation: chat-clean-fade 5s ease-in-out infinite; }
        .chat-caret { animation: chat-caret      1s steps(2)      infinite; }
      `}</style>

      <div className="px-3 py-2 border-b border-ink-08 bg-card flex items-center gap-2">
        <BrandLogo brand="claude" size={14} />
        <span className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-ink-45">Claude</span>
      </div>

      <div className="flex-1 px-3 py-3 flex items-end">
        <div className="w-full bg-card border border-ink-08 rounded-[10px] px-3 py-2.5 min-h-[80px] relative">
          <div className="chat-raw text-[11.5px] leading-snug text-ink-60">
            hey um can you uh write me a function that handles you know negative numbers
          </div>
          <div className="chat-clean absolute inset-0 px-3 py-2.5 text-[12px] leading-snug text-ink font-medium">
            Write a function that handles negative numbers.
            <span className="chat-caret inline-block w-[2px] h-[12px] bg-ink ml-0.5 align-text-bottom" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Body cycle: realistic per-app mockups ─────────────────────────

type Scenario = 'imessage' | 'gmail' | 'notion'
const ORDER: Scenario[] = ['imessage', 'gmail', 'notion']

const INSTRUCTIONS: Record<Scenario, string> = {
  imessage: "make this casual",
  gmail:    "make it more formal",
  notion:   "turn into bullets",
}

function AppMockCycle() {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setIdx((i) => (i + 1) % ORDER.length), 5600)
    return () => window.clearInterval(id)
  }, [])
  const s = ORDER[idx]

  return (
    <div className="bg-card border border-ink-08 rounded-[14px] overflow-hidden">
      <div key={s} className="animate-stepIn">
        {s === 'imessage' && <IMessageMock instruction={INSTRUCTIONS.imessage} />}
        {s === 'gmail'    && <GmailMock    instruction={INSTRUCTIONS.gmail} />}
        {s === 'notion'   && <NotionMock   instruction={INSTRUCTIONS.notion} />}
      </div>

      <div className="flex items-center justify-center gap-1.5 pb-3 pt-1 border-t border-ink-08 bg-paper/40">
        {ORDER.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={[
              'h-1 rounded-full transition-all duration-300',
              i === idx ? 'w-5 bg-ink' : 'w-1.5 bg-ink-08 hover:bg-ink-45',
            ].join(' ')}
            aria-label={`Show ${ORDER[i]} example`}
          />
        ))}
      </div>
    </div>
  )
}

// Spoken-instruction bubble that pops in mid-cycle. Anchored absolutely
// over the mock so users see it pointing at the highlighted region.
function InstructionBubble({ text, side = 'right', y = '50%' }: {
  text: string; side?: 'left' | 'right'; y?: string
}) {
  return (
    <div
      className="absolute z-10"
      style={{ [side]: 12, top: y, transform: 'translateY(-50%)' }}
    >
      <style>{`
        @keyframes ai-bubble {
          0%, 25%   { opacity: 0; transform: translateY(calc(-50% + 8px)); }
          35%, 80%  { opacity: 1; transform: translateY(-50%); }
          90%, 100% { opacity: 0; transform: translateY(calc(-50% + 4px)); }
        }
        .ai-bubble { animation: ai-bubble 5.6s ease-in-out infinite; }
      `}</style>
      <div className="ai-bubble bg-[#3F2570] text-[#F0E6FF] text-[11px] px-3 py-1.5 rounded-pill leading-snug shadow-lg whitespace-nowrap">
        <span className="text-[#F0E6FF]/60 mr-1.5 text-[9px] font-mono uppercase tracking-wider">you say</span>
        "{text}"
      </div>
    </div>
  )
}

// Within-mock fade keyframes — same timing across all three mocks so
// users learn the rhythm: ~38% before fades out, after fades in.
const FADE_STYLES = `
  @keyframes ai-before { 0%, 38% { opacity: 1; } 48%, 100% { opacity: 0; } }
  @keyframes ai-after  { 0%, 44% { opacity: 0; } 56%, 100% { opacity: 1; } }
  .ai-before { animation: ai-before 5.6s ease-in-out infinite; }
  .ai-after  { animation: ai-after  5.6s ease-in-out infinite; }
`

// ─── iMessage mock — sidebar conversation list + thread ────────────

function IMessageMock({ instruction }: { instruction: string }) {
  return (
    <div className="relative grid grid-cols-[170px_1fr] h-[300px] bg-[#f5f5f7]">
      <style>{FADE_STYLES}</style>

      {/* Sidebar: conversation list */}
      <div className="border-r border-ink-08/70 bg-[#ececec] flex flex-col">
        <div className="px-2.5 pt-2 pb-1.5">
          <div className="bg-white rounded-[6px] h-[20px] flex items-center px-2 text-[9px] text-ink-45">🔍 Search</div>
        </div>
        <div className="flex-1 overflow-hidden">
          <Conv name="Trev Smith" preview="Gotcha covered!" time="Yesterday" color="#f59e0b" />
          <Conv name="Antonio Manriquez" preview="Is your mind blown?" time="Sunday" color="#94a3b8" />
          <Conv name="Hiker Neighbors" preview="Reacted ❤️ to 'Guess who…'" time="Sunday" color="#94a3b8" />
          <Conv name="Orkun" preview="Looking forward to Friday!" time="Sunday" color="#fb923c" selected />
          <Conv name="Xiaomeng Zhong" preview="Now you've got me thinking…" time="Sunday" color="#3b82f6" />
        </div>
      </div>

      {/* Thread */}
      <div className="relative flex flex-col bg-white">
        {/* Conversation header */}
        <div className="px-3 py-2 border-b border-ink-08/50 flex flex-col items-center">
          <div className="w-7 h-7 rounded-full bg-[#fb923c] mb-0.5" />
          <div className="text-[10.5px] font-medium leading-none">Orkun ›</div>
        </div>
        {/* Bubbles */}
        <div className="flex-1 px-3 py-2.5 space-y-1.5 overflow-hidden">
          <div className="flex justify-end">
            <div className="bg-[#34c759] text-white text-[11px] px-3 py-1.5 rounded-[14px] rounded-br-[4px] max-w-[75%] leading-snug">
              Family game night Friday — could we borrow your puzzles, please?
            </div>
          </div>
          <div className="flex justify-start">
            <div className="bg-[#e9e9eb] text-ink text-[11px] px-3 py-1.5 rounded-[14px] rounded-bl-[4px] max-w-[75%] leading-snug">
              Of course! I'll drop a few off after work.
            </div>
          </div>
          {/* The draft (what's morphing) — still in the conversation
              as the most recent sent bubble, with a violet selection
              halo to signal it's the one being rewritten. */}
          <div className="flex justify-end">
            <div className="relative min-w-[210px] max-w-[80%]">
              <div className="ai-before bg-[#34c759] text-white text-[11px] px-3 py-1.5 rounded-[14px] rounded-br-[4px] leading-snug ring-2 ring-[#6B46C1]/50">
                I regret to inform you that I will be unable to attend tonight
              </div>
              <div className="ai-after absolute inset-0 bg-[#34c759] text-white text-[11px] px-3 py-1.5 rounded-[14px] rounded-br-[4px] leading-snug">
                yo can't make it tonight — rain check?
              </div>
            </div>
          </div>
        </div>
        {/* Compose bar */}
        <div className="px-3 py-1.5 border-t border-ink-08/50 bg-white flex items-center gap-2">
          <span className="text-[#007aff] text-[14px] leading-none">+</span>
          <div className="flex-1 bg-white border border-ink-08 rounded-pill h-5 text-[9.5px] text-ink-45 flex items-center px-2">iMessage</div>
          <span className="text-ink-45 text-[12px]">🎙</span>
        </div>

        <InstructionBubble text={instruction} side="right" y="60%" />
      </div>
    </div>
  )
}

function Conv({ name, preview, time, color, selected }: {
  name: string; preview: string; time: string; color: string; selected?: boolean
}) {
  return (
    <div className={[
      'px-2 py-1.5 flex items-start gap-2',
      selected ? 'bg-[#0a84ff] text-white rounded-[6px] mx-1' : '',
    ].join(' ')}>
      <div className="w-6 h-6 rounded-full shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-1">
          <span className={['text-[10px] font-semibold truncate', selected ? 'text-white' : 'text-ink'].join(' ')}>{name}</span>
          <span className={['text-[8.5px] shrink-0', selected ? 'text-white/75' : 'text-ink-45'].join(' ')}>{time}</span>
        </div>
        <div className={['text-[9px] truncate', selected ? 'text-white/85' : 'text-ink-60'].join(' ')}>{preview}</div>
      </div>
    </div>
  )
}

// ─── Gmail mock — sidebar + floating compose ───────────────────────

function GmailMock({ instruction }: { instruction: string }) {
  return (
    <div className="relative h-[300px] bg-[#f6f8fc]">
      <style>{FADE_STYLES}</style>

      {/* Top bar */}
      <div className="px-3 py-1.5 border-b border-ink-08/60 bg-white flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <BrandLogo brand="gmail" size={16} />
          <span className="text-[12px] font-medium text-ink-60 tracking-tight">Gmail</span>
        </div>
        <div className="flex-1 max-w-[280px] bg-[#eaf1fb] rounded-[6px] h-5 flex items-center px-2 text-[9px] text-ink-45">
          🔍  Search mail
        </div>
      </div>

      <div className="grid grid-cols-[100px_1fr] h-[calc(100%-30px)]">
        {/* Sidebar */}
        <div className="bg-white border-r border-ink-08/50 py-2 px-2 space-y-0.5 text-[10px]">
          <div className="bg-[#c2e7ff] text-[#001d35] font-medium rounded-pill px-2.5 py-1 inline-flex items-center gap-1 text-[10.5px]">
            <span>+</span> Compose
          </div>
          <SideRow label="Inbox" count="21,333" active />
          <SideRow label="Starred" />
          <SideRow label="Snoozed" />
          <SideRow label="Sent" />
          <SideRow label="Drafts" count="146" />
        </div>

        {/* Email list (dimmed background) */}
        <div className="relative px-2 py-1.5">
          <EmailRow sender="Seeking Alpha" preview="Top income ideas. One day…" time="9:56 AM" />
          <EmailRow sender="Ideabrowser" preview="Idea of the Day: Lego brick scanner…" time="9:52 AM" />
          <EmailRow sender="Daniel … Daniel 5" preview="Fwd: IMPORT JEEPCJ7" time="8:25 AM" />
          <EmailRow sender="Marriott Bonvoy" preview="Earn double points this summer" time="Mon" />
          <EmailRow sender="AI Automation Hub" preview="This week in AI infra" time="Mon" />

          {/* Floating Compose window */}
          <div className="absolute bottom-2 right-2 w-[260px] bg-white rounded-t-[6px] shadow-[0_-2px_8px_rgba(0,0,0,0.12)] border border-ink-08 overflow-hidden">
            <div className="bg-[#404040] text-white text-[10px] px-2.5 py-1 flex items-center justify-between">
              <span>New Message</span>
              <span className="text-white/60 text-[10px] flex gap-1.5">— ⛶ ✕</span>
            </div>
            <div className="px-2.5 py-1 border-b border-ink-08/40 text-[10px] text-ink-45 flex items-center gap-1">
              <span>To</span><span className="text-ink">alex@company.com</span>
            </div>
            <div className="px-2.5 py-1 border-b border-ink-08/40 text-[10px] text-ink-45 flex items-center gap-1">
              <span>Subject</span><span className="text-ink">Meeting move</span>
            </div>
            <div className="px-2.5 py-2 min-h-[64px] relative">
              <div className="ai-before text-[10.5px] leading-snug text-ink-60">
                <span className="bg-[#6B46C1]/22 text-ink rounded-[2px] px-0.5">yo so basically the meeting got moved to like 3pm tomorrow lmk if that works</span>
              </div>
              <div className="ai-after absolute inset-0 px-2.5 py-2 text-[10.5px] leading-snug text-ink">
                Heads up — the meeting is now at 3 PM tomorrow. Please let me know if that works.
              </div>
            </div>
            <div className="px-2.5 py-1.5 border-t border-ink-08/40 flex items-center gap-1.5">
              <div className="bg-[#0b57d0] text-white text-[10px] font-medium px-2.5 py-0.5 rounded">Send</div>
            </div>
          </div>
        </div>
      </div>

      <InstructionBubble text={instruction} side="left" y="58%" />
    </div>
  )
}

function SideRow({ label, count, active }: { label: string; count?: string; active?: boolean }) {
  return (
    <div className={[
      'flex items-center justify-between px-2 py-0.5 rounded-pill',
      active ? 'bg-[#fce7f3] text-[#a8204e] font-medium' : 'text-ink-60',
    ].join(' ')}>
      <span>{label}</span>
      {count && <span className="text-[9px]">{count}</span>}
    </div>
  )
}

function EmailRow({ sender, preview, time }: { sender: string; preview: string; time: string }) {
  return (
    <div className="flex items-center gap-1.5 py-1 border-b border-ink-08/30 text-[9.5px]">
      <div className="w-3 h-3 rounded border border-ink-08" />
      <span className="font-semibold text-ink truncate w-[60px] shrink-0">{sender}</span>
      <span className="text-ink-60 truncate flex-1">{preview}</span>
      <span className="text-ink-45 shrink-0">{time}</span>
    </div>
  )
}

// ─── Notion mock — sidebar + page ──────────────────────────────────

function NotionMock({ instruction }: { instruction: string }) {
  return (
    <div className="relative grid grid-cols-[150px_1fr] h-[300px] bg-white">
      <style>{FADE_STYLES}</style>

      {/* Sidebar */}
      <div className="border-r border-ink-08/60 bg-[#f7f6f3] py-2 px-1.5 text-[10px] flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 px-1.5 py-1 text-ink-60">
          <div className="w-3.5 h-3.5 bg-ink rounded text-paper text-[8px] flex items-center justify-center font-bold">A</div>
          <span className="font-medium">Acme Inc.</span>
          <span className="text-[8px] ml-auto">⌃</span>
        </div>
        <NotionRow icon="🔍" label="Quick Find" />
        <NotionRow icon="⏱" label="All Updates" />
        <NotionRow icon="⚙" label="Settings & Members" />
        <div className="text-[8px] text-ink-45 font-semibold uppercase tracking-wider px-1.5 mt-2 mb-0.5">Workspace</div>
        <NotionRow icon="🏠" label="Acme Home" active />
        <NotionRow icon="📋" label="Applicant Tracker" />
        <NotionRow icon="🚗" label="Roadmap" />
        <NotionRow icon="📝" label="Meeting Notes" />
        <NotionRow icon="📘" label="Task List" />
      </div>

      {/* Page */}
      <div className="relative px-5 py-3 overflow-hidden">
        <div className="text-[10px] text-ink-45 mb-1.5 flex items-center gap-1">
          <span>🏠</span><span>Acme Home / Engineering</span>
        </div>
        <div className="text-[22px] font-bold leading-tight mb-3">Project blockers</div>
        <div className="relative">
          <div className="ai-before text-[11px] leading-relaxed text-ink-60">
            <span className="bg-[#6B46C1]/22 text-ink rounded-[2px] px-0.5">the project has three blockers right now design review pricing approval and the api migration</span>
          </div>
          <div className="ai-after absolute inset-0 text-[11px] leading-relaxed text-ink">
            <div className="mb-1.5">The project has three blockers:</div>
            <div className="pl-2 space-y-0.5">
              <div>•&nbsp; Design review</div>
              <div>•&nbsp; Pricing approval</div>
              <div>•&nbsp; API migration</div>
            </div>
          </div>
        </div>

        <InstructionBubble text={instruction} side="right" y="62%" />
      </div>
    </div>
  )
}

function NotionRow({ icon, label, active }: { icon: string; label: string; active?: boolean }) {
  return (
    <div className={[
      'flex items-center gap-1.5 px-1.5 py-1 rounded text-[10px]',
      active ? 'bg-[#e7e5e0] text-ink font-medium' : 'text-ink-60',
    ].join(' ')}>
      <span className="text-[10px]">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  )
}
