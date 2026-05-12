import { useEffect, useState } from 'react'
import { SectionHero } from '../../shared/ui/SectionHero'
import { BrandLogo } from '../../shared/ui/BrandLogo'
import { MiniPill } from '../../shared/ui/MiniPill'

// AI tab — two visual mocks.
//
//   HERO: chat-input morph for AI-context prompt engineering.
//
//   BODY: cycles through realistic app mockups (iMessage / Gmail /
//   Notion). Each shows the full screen-recording moment:
//     1. cursor drags across text → native blue selection appears
//     2. OpenFlow indicator pill fades in at the bottom in
//        "listening" state with a live-style waveform
//     3. spoken instruction bubble appears
//     4. selected text fades to the rewritten version
//     5. pill fades out

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

// ─── Hero: chat-input morph cycling through three AI surfaces ─────

type ChatProvider = 'claude' | 'chatgpt' | 'cursor'
const PROVIDER_ORDER: ChatProvider[] = ['claude', 'chatgpt', 'cursor']

const PROVIDER_SCRIPTS: Record<ChatProvider, { raw: string; clean: string }> = {
  claude: {
    raw: "hey um can you uh write me a function that handles you know negative numbers",
    clean: "Write a function that handles negative numbers.",
  },
  chatgpt: {
    raw: "so like help me draft a quick email saying i'm gonna be late to the meeting tomorrow",
    clean: "Draft a brief email noting I'll be late to tomorrow's meeting.",
  },
  cursor: {
    raw: "okay can you refactor this so that it uses async await instead of all the promise chaining",
    clean: "Refactor to use async/await instead of promise chaining.",
  },
}

function ChatPromptMock() {
  // Each provider mock holds for 5s. The internal morph (raw → clean)
  // runs once per provider, then the cycle advances. Same 300×200 outer
  // frame so the hero footprint never changes.
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setIdx((i) => (i + 1) % PROVIDER_ORDER.length), 5000)
    return () => window.clearInterval(id)
  }, [])
  const p = PROVIDER_ORDER[idx]
  return (
    <div className="relative w-[300px] h-[200px] rounded-[14px] overflow-hidden">
      <style>{`
        @keyframes chat-raw-fade  { 0%, 32% { opacity: 1; } 42%, 100% { opacity: 0; } }
        @keyframes chat-clean-fade { 0%, 38% { opacity: 0; transform: translateY(3px); } 50%, 100% { opacity: 1; transform: translateY(0); } }
        @keyframes chat-caret { 0%, 49%, 100% { opacity: 1; } 50%, 99% { opacity: 0; } }
        .chat-raw   { animation: chat-raw-fade   5s ease-in-out infinite; }
        .chat-clean { animation: chat-clean-fade 5s ease-in-out infinite; }
        .chat-caret { animation: chat-caret      1s steps(2)      infinite; }
      `}</style>
      <div key={p} className="w-full h-full animate-stepIn">
        {p === 'claude'  && <ClaudeMock  {...PROVIDER_SCRIPTS.claude}  />}
        {p === 'chatgpt' && <ChatGPTMock {...PROVIDER_SCRIPTS.chatgpt} />}
        {p === 'cursor'  && <CursorMock  {...PROVIDER_SCRIPTS.cursor}  />}
      </div>
    </div>
  )
}

// Claude — warm cream background, rust-orange Send button, serif vibe.
function ClaudeMock({ raw, clean }: { raw: string; clean: string }) {
  return (
    <div className="w-full h-full bg-[#F2EEE5] border border-[#E5DDD0] flex flex-col rounded-[14px] overflow-hidden">
      <div className="px-3 py-2 border-b border-[#E5DDD0] bg-[#F8F5EE] flex items-center gap-2">
        <BrandLogo brand="claude" size={16} />
        <span className="text-[11px] font-medium text-[#3D3929] tracking-tight">Claude</span>
      </div>
      <div className="flex-1 px-3 py-3 flex items-end">
        <div className="w-full bg-white border border-[#E5DDD0] rounded-[12px] px-3 py-2.5 min-h-[80px] relative shadow-sm">
          <div className="chat-raw text-[11.5px] leading-snug text-[#8A8576]">{raw}</div>
          <div className="chat-clean absolute inset-0 px-3 py-2.5 text-[12px] leading-snug text-[#1F1B11] font-medium">
            {clean}<span className="chat-caret inline-block w-[2px] h-[12px] bg-[#1F1B11] ml-0.5 align-text-bottom" />
          </div>
          <div className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-[#C96442] text-white text-[10px] flex items-center justify-center font-bold">↑</div>
        </div>
      </div>
    </div>
  )
}

// ChatGPT — clean white with a soft gray composer, round black send button.
function ChatGPTMock({ raw, clean }: { raw: string; clean: string }) {
  return (
    <div className="w-full h-full bg-white border border-ink-08 flex flex-col rounded-[14px] overflow-hidden">
      <div className="px-3 py-2 border-b border-ink-08 bg-white flex items-center gap-2">
        <BrandLogo brand="chatgpt" size={16} />
        <span className="text-[11px] font-semibold text-ink tracking-tight">ChatGPT</span>
      </div>
      <div className="flex-1 px-3 py-3 flex items-end">
        <div className="w-full bg-[#F4F4F4] rounded-[18px] px-3 py-2.5 min-h-[80px] relative">
          <div className="chat-raw text-[11.5px] leading-snug text-[#888]">{raw}</div>
          <div className="chat-clean absolute inset-0 px-3 py-2.5 text-[12px] leading-snug text-[#0D0D0D] font-medium">
            {clean}<span className="chat-caret inline-block w-[2px] h-[12px] bg-[#0D0D0D] ml-0.5 align-text-bottom" />
          </div>
          <div className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-[#0D0D0D] text-white text-[10px] flex items-center justify-center font-bold">↑</div>
        </div>
      </div>
    </div>
  )
}

// Cursor — dark IDE theme, mono-leaning chat panel sliding in from the right.
function CursorMock({ raw, clean }: { raw: string; clean: string }) {
  return (
    <div className="w-full h-full bg-[#1E1E1E] border border-[#2D2D2D] flex flex-col rounded-[14px] overflow-hidden">
      <div className="px-3 py-2 border-b border-[#2D2D2D] bg-[#252526] flex items-center gap-2">
        <BrandLogo brand="cursor" size={14} />
        <span className="text-[11px] font-medium text-[#CCCCCC] tracking-tight">Cursor</span>
        <span className="ml-auto text-[9px] font-mono text-[#7A7A7A]">chat</span>
      </div>
      <div className="flex-1 px-3 py-3 flex items-end">
        <div className="w-full bg-[#2A2A2A] border border-[#3A3A3A] rounded-[10px] px-3 py-2.5 min-h-[80px] relative font-mono">
          <div className="chat-raw text-[11px] leading-snug text-[#7A7A7A]">{raw}</div>
          <div className="chat-clean absolute inset-0 px-3 py-2.5 text-[11.5px] leading-snug text-[#E4E4E4] font-medium">
            {clean}<span className="chat-caret inline-block w-[2px] h-[12px] bg-[#E4E4E4] ml-0.5 align-text-bottom" />
          </div>
          <div className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-[#4A9EFF] text-white text-[10px] flex items-center justify-center font-bold">↑</div>
        </div>
      </div>
    </div>
  )
}

// ─── Body: cycling realistic app mockups ──────────────────────────

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
    const id = window.setInterval(() => setIdx((i) => (i + 1) % ORDER.length), 6400)
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

      <div className="flex items-center justify-center gap-1.5 pb-3 pt-2 border-t border-ink-08 bg-paper/40">
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

// ─── Shared bits ───────────────────────────────────────────────────

// macOS-style window controls. Order: close / minimize / zoom.
function TrafficLights() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-[10px] h-[10px] rounded-full bg-[#FF5F57]" />
      <span className="w-[10px] h-[10px] rounded-full bg-[#FEBC2E]" />
      <span className="w-[10px] h-[10px] rounded-full bg-[#28C840]" />
    </div>
  )
}

// macOS pointer-arrow cursor sprite. Positioned absolutely by the
// parent mock and animated via the shared keyframes below.
function MacCursor() {
  return (
    <svg width="14" height="20" viewBox="0 0 14 20" className="drop-shadow-md pointer-events-none">
      <path
        d="M1.5,1 L1.5,15.2 L5,12.2 L7,17 L9,16.2 L7,11.4 L12.2,11.4 Z"
        fill="white"
        stroke="black"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// MiniPill is now exported from shared/ui/MiniPill for reuse across tabs.

// All app mocks share this animation timeline so they read as the same
// flow at different surfaces:
//
//   0–15%   app at rest
//   15–30%  cursor drags across text, native-blue selection grows
//   30–55%  cursor fades, OpenFlow pill enters listening, instruction
//           bubble pops in, raw text starts to fade
//   55–75%  cleaned text fades in
//   75–95%  pill switches to polishing → fades out, instruction fades
//   95–100% hold final
//
// 6.4s total per cycle.
const TIMELINE_STYLES = `
  @keyframes mock-cursor {
    0%, 8%      { opacity: 0; transform: translate(0%, 0); }
    13%         { opacity: 1; transform: translate(0%, 0); }
    27%         { opacity: 1; transform: translate(100%, 0); }
    32%, 100%   { opacity: 0; transform: translate(100%, 0); }
  }
  @keyframes mock-selection {
    0%, 12%     { transform: scaleX(0); }
    27%         { transform: scaleX(1); }
    62%         { transform: scaleX(1); opacity: 1; }
    68%, 100%   { transform: scaleX(1); opacity: 0; }
  }
  @keyframes mock-before {
    0%, 50%     { opacity: 1; }
    62%, 100%   { opacity: 0; }
  }
  @keyframes mock-after  {
    0%, 58%     { opacity: 0; }
    70%, 100%   { opacity: 1; }
  }
  @keyframes mock-pill {
    0%, 28%     { opacity: 0; transform: translateY(8px); }
    35%, 78%    { opacity: 1; transform: translateY(0); }
    85%, 100%   { opacity: 0; transform: translateY(4px); }
  }
  @keyframes mock-instr {
    0%, 32%     { opacity: 0; transform: translateY(6px); }
    40%, 70%    { opacity: 1; transform: translateY(0); }
    78%, 100%   { opacity: 0; transform: translateY(4px); }
  }
  @keyframes mock-bar1 { 0%,100% { height: 4px; } 50% { height: 9px; } }
  @keyframes mock-bar2 { 0%,100% { height: 7px; } 50% { height: 2px; } }
  @keyframes mock-bar3 { 0%,100% { height: 9px; } 50% { height: 5px; } }
  @keyframes mock-bar4 { 0%,100% { height: 3px; } 50% { height: 8px; } }
  @keyframes mock-bar5 { 0%,100% { height: 6px; } 50% { height: 2px; } }

  .mock-cursor    { animation: mock-cursor 6.4s ease-in-out infinite; }
  .mock-selection { animation: mock-selection 6.4s ease-in-out infinite; transform-origin: left center; }
  .mock-before    { animation: mock-before 6.4s ease-in-out infinite; }
  .mock-after     { animation: mock-after 6.4s ease-in-out infinite; }
  .mock-pill      { animation: mock-pill 6.4s ease-in-out infinite; }
  .mock-instr     { animation: mock-instr 6.4s ease-in-out infinite; }
  .mini-bar-1 { animation: mock-bar1 0.7s ease-in-out infinite; }
  .mini-bar-2 { animation: mock-bar2 0.6s ease-in-out infinite; }
  .mini-bar-3 { animation: mock-bar3 0.55s ease-in-out infinite; }
  .mini-bar-4 { animation: mock-bar4 0.65s ease-in-out infinite; }
  .mini-bar-5 { animation: mock-bar5 0.5s ease-in-out infinite; }
`

// ─── iMessage mock ─────────────────────────────────────────────────

function IMessageMock({ instruction }: { instruction: string }) {
  return (
    <div className="relative bg-[#f2f2f7] h-[320px] overflow-hidden">
      <style>{TIMELINE_STYLES}</style>

      {/* macOS window chrome */}
      <div className="px-3 py-2 bg-[#ececec] border-b border-ink-08/60 flex items-center gap-3">
        <TrafficLights />
      </div>

      <div className="grid grid-cols-[170px_1fr] h-[calc(100%-80px)]">
        {/* Sidebar */}
        <div className="border-r border-ink-08/60 bg-[#f6f6f6] flex flex-col">
          <div className="px-2.5 pt-2 pb-1.5">
            <div className="bg-white rounded-[6px] h-[20px] flex items-center px-2 text-[9px] text-ink-45 shadow-[0_0_0_0.5px_rgba(0,0,0,0.1)]">
              <span className="text-[9px]">🔍</span>
              <span className="ml-1.5">Search</span>
            </div>
          </div>
          <Conv name="Trev Smith" preview="Gotcha covered!" time="Yesterday" color="#f59e0b" />
          <Conv name="Antonio Manriquez" preview="Is your mind blown?" time="Sunday" color="#94a3b8" />
          <Conv name="Hiker Neighbors" preview="Reacted ❤️ to 'Guess who…'" time="Sunday" color="#a78bfa" />
          <Conv name="Orkun" preview="Looking forward to Friday!" time="Sunday" color="#fb923c" selected />
          <Conv name="Xiaomeng Zhong" preview="Got me thinking about…" time="Sunday" color="#3b82f6" />
          <Conv name="Aileen & Rich" preview="Hope the little ones…" time="Saturday" color="#64748b" />
        </div>

        {/* Thread */}
        <div className="relative flex flex-col bg-white">
          <div className="px-3 py-1.5 border-b border-ink-08/40 flex flex-col items-center bg-white/85 backdrop-blur-sm">
            <div className="w-6 h-6 rounded-full bg-[#fb923c] mb-0.5" />
            <div className="text-[10px] font-medium leading-none flex items-center gap-0.5">Orkun <span className="text-ink-45">›</span></div>
          </div>

          <div className="flex-1 px-3 py-2.5 space-y-1.5 overflow-hidden">
            <div className="flex justify-end">
              <div className="bg-[#34c759] text-white text-[11px] px-2.5 py-1.5 rounded-[15px] rounded-br-[4px] max-w-[80%] leading-snug shadow-sm">
                Like a jigsaw puzzle?
              </div>
            </div>
            <div className="flex justify-start">
              <div className="bg-[#e9e9eb] text-ink text-[11px] px-2.5 py-1.5 rounded-[15px] rounded-bl-[4px] max-w-[80%] leading-snug">
                Oh! I forgot you collect puzzles 🧩
              </div>
            </div>
            {/* The bubble being rewritten */}
            <div className="flex justify-end">
              <div className="relative max-w-[80%]">
                <div className="bg-[#34c759] text-white text-[11px] px-2.5 py-1.5 rounded-[15px] rounded-br-[4px] leading-snug shadow-sm">
                  <span className="mock-before">
                    {/* Native-blue selection layer behind the text */}
                    <span
                      className="mock-selection absolute inset-x-2.5 inset-y-1.5 rounded-[2px]"
                      style={{ background: 'rgba(0,122,255,0.42)' }}
                    />
                    <span className="relative">I regret to inform you that I will be unable to attend tonight</span>
                  </span>
                  <span className="mock-after absolute inset-0 px-2.5 py-1.5">yo can't make it tonight — rain check?</span>
                </div>
                {/* Cursor parked at the end of the selection during the drag */}
                <div className="mock-cursor absolute left-2 top-1.5">
                  <MacCursor />
                </div>
              </div>
            </div>
          </div>

          <div className="px-3 py-1.5 border-t border-ink-08/40 bg-white flex items-center gap-2">
            <span className="text-[#007aff] text-[14px] leading-none">+</span>
            <div className="flex-1 bg-white border border-ink-08/80 rounded-pill h-5 flex items-center px-2 text-[9.5px] text-ink-45">iMessage</div>
            <span className="text-ink-45 text-[12px]">🎙</span>
          </div>

        </div>
      </div>

      {/* OpenFlow pill — always pinned to bottom-center of the mock,
          regardless of which app is showing. Instruction floats above. */}
      <div className="mock-pill absolute left-1/2 -translate-x-1/2 bottom-4 pointer-events-none">
        <MiniPill />
      </div>
      <div className="mock-instr absolute left-1/2 -translate-x-1/2 bottom-[52px] pointer-events-none">
        <div className="bg-[#1c1c1e]/90 text-white text-[10px] px-2.5 py-1 rounded-pill whitespace-nowrap shadow-lg">
          "{instruction}"
        </div>
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

// ─── Gmail mock ────────────────────────────────────────────────────

function GmailMock({ instruction }: { instruction: string }) {
  return (
    <div className="relative h-[320px] bg-[#f6f8fc] overflow-hidden">
      <style>{TIMELINE_STYLES}</style>

      {/* Browser window chrome */}
      <div className="px-3 py-2 bg-[#ececec] border-b border-ink-08/60 flex items-center gap-3">
        <TrafficLights />
        <div className="flex-1 bg-white border border-ink-08 rounded-[6px] h-5 max-w-[320px] flex items-center px-2.5 text-[9.5px] text-ink-45">
          🔒 mail.google.com/mail/u/0/#inbox
        </div>
      </div>

      {/* Gmail top bar */}
      <div className="px-3 py-1.5 border-b border-ink-08/60 bg-white flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <BrandLogo brand="gmail" size={16} />
          <span className="text-[12px] font-medium text-ink-60 tracking-tight">Gmail</span>
        </div>
        <div className="flex-1 max-w-[260px] bg-[#eaf1fb] rounded-[6px] h-5 flex items-center px-2 text-[9px] text-ink-45">
          🔍  Search mail
        </div>
        <div className="w-5 h-5 rounded-full bg-[#1a73e8]" />
      </div>

      <div className="grid grid-cols-[110px_1fr] h-[calc(100%-72px)]">
        {/* Sidebar */}
        <div className="bg-white border-r border-ink-08/40 py-2 px-1.5 space-y-0.5 text-[10px]">
          <div className="bg-[#c2e7ff] text-[#001d35] font-medium rounded-pill px-2.5 py-1 inline-flex items-center gap-1 text-[10.5px] shadow-sm">
            <span>✏️</span> Compose
          </div>
          <SideRow label="Inbox" count="21,333" active />
          <SideRow label="Starred" />
          <SideRow label="Snoozed" />
          <SideRow label="Important" />
          <SideRow label="Sent" />
          <SideRow label="Drafts" count="146" />
        </div>

        {/* Mail list with the floating compose composer over it */}
        <div className="relative px-2 py-1.5 bg-[#f6f8fc]">
          <EmailRow sender="Seeking Alpha" preview="Top income ideas. One day…" time="9:56 AM" />
          <EmailRow sender="Ideabrowser" preview="Idea of the Day: Lego brick scanner…" time="9:52 AM" />
          <EmailRow sender="Daniel 5" preview="Fwd: IMPORT JEEPCJ7" time="8:25 AM" />
          <EmailRow sender="Marriott Bonvoy" preview="Earn double points this summer" time="Mon" />

          {/* Floating compose */}
          <div className="absolute bottom-2 right-2 w-[280px] bg-white rounded-t-[8px] shadow-[0_-2px_12px_rgba(0,0,0,0.16)] border border-ink-08 overflow-hidden">
            <div className="bg-[#404040] text-white text-[10px] px-2.5 py-1 flex items-center justify-between">
              <span className="font-medium">New Message</span>
              <span className="text-white/60 text-[10px] flex gap-1.5">— ⛶ ✕</span>
            </div>
            <div className="px-2.5 py-1 border-b border-ink-08/40 text-[10px] flex items-center gap-1">
              <span className="text-ink-45">To</span>
              <span className="text-ink">alex@company.com</span>
            </div>
            <div className="px-2.5 py-1 border-b border-ink-08/40 text-[10px] flex items-center gap-1">
              <span className="text-ink-45">Subject</span>
              <span className="text-ink">Meeting move</span>
            </div>
            <div className="px-2.5 py-2 min-h-[70px] relative">
              <div className="mock-before relative text-[10.5px] leading-snug text-ink">
                <span
                  className="mock-selection absolute top-[1px] bottom-[1px] left-0 right-0 rounded-[2px]"
                  style={{ background: 'rgba(0,122,255,0.32)' }}
                />
                <span className="relative">yo so basically the meeting got moved to like 3pm tomorrow lmk if that works</span>
              </div>
              <div className="mock-after absolute inset-0 px-2.5 py-2 text-[10.5px] leading-snug text-ink">
                Heads up — the meeting is now at 3 PM tomorrow. Please let me know if that works.
              </div>

              <div className="mock-cursor absolute left-1 top-1">
                <MacCursor />
              </div>
            </div>
            <div className="px-2.5 py-1.5 border-t border-ink-08/40 flex items-center gap-1.5">
              <div className="bg-[#0b57d0] text-white text-[10px] font-medium px-2.5 py-0.5 rounded">Send</div>
            </div>
          </div>

        </div>
      </div>

      {/* Pill + instruction pinned to bottom-center of the mock. */}
      <div className="mock-pill absolute left-1/2 -translate-x-1/2 bottom-4 pointer-events-none">
        <MiniPill />
      </div>
      <div className="mock-instr absolute left-1/2 -translate-x-1/2 bottom-[52px] pointer-events-none">
        <div className="bg-[#1c1c1e]/90 text-white text-[10px] px-2.5 py-1 rounded-pill whitespace-nowrap shadow-lg">
          "{instruction}"
        </div>
      </div>
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
    <div className="flex items-center gap-1.5 py-1 border-b border-ink-08/30 bg-white px-1.5 text-[9.5px]">
      <div className="w-3 h-3 rounded border border-ink-08" />
      <span className="text-yellow-500 text-[10px]">☆</span>
      <span className="font-semibold text-ink truncate w-[60px] shrink-0">{sender}</span>
      <span className="text-ink-60 truncate flex-1">{preview}</span>
      <span className="text-ink-45 shrink-0">{time}</span>
    </div>
  )
}

// ─── Notion mock ───────────────────────────────────────────────────

function NotionMock({ instruction }: { instruction: string }) {
  return (
    <div className="relative h-[320px] bg-white overflow-hidden">
      <style>{TIMELINE_STYLES}</style>

      {/* Browser-style chrome with the notion.so address */}
      <div className="px-3 py-2 bg-[#ececec] border-b border-ink-08/60 flex items-center gap-3">
        <TrafficLights />
        <div className="flex-1 bg-white border border-ink-08 rounded-[6px] h-5 max-w-[260px] flex items-center px-2.5 text-[9.5px] text-ink-45">
          🔒 notion.so
        </div>
        <div className="bg-white border border-ink-08 rounded text-[9.5px] px-2 py-0.5 flex items-center gap-1">
          <span className="text-[10px]">N</span>
          <span>🏠 Acme Home</span>
        </div>
      </div>

      <div className="grid grid-cols-[155px_1fr] h-[calc(100%-32px)]">
        {/* Sidebar */}
        <div className="border-r border-ink-08/60 bg-[#f7f6f3] py-2 px-1.5 text-[10px] flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 px-1.5 py-1 text-ink-60">
            <div className="w-3.5 h-3.5 bg-ink rounded text-paper text-[8px] flex items-center justify-center font-bold">A</div>
            <span className="font-medium text-[10.5px]">Acme Inc.</span>
            <span className="text-[8px] ml-auto">⇅</span>
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
          <div className="text-[8px] text-ink-45 font-semibold uppercase tracking-wider px-1.5 mt-2 mb-0.5">Shared</div>
          <div className="text-[8px] text-ink-45 font-semibold uppercase tracking-wider px-1.5 mt-1 mb-0.5">Private</div>
        </div>

        {/* Page */}
        <div className="relative px-5 py-3 overflow-hidden">
          <div className="text-[10px] text-ink-45 mb-1 flex items-center gap-1">
            <span>🏠</span><span>Acme Home / Engineering</span>
          </div>
          <div className="text-[22px] font-bold leading-tight mb-3">Project blockers</div>

          <div className="relative">
            <div className="mock-before relative text-[11px] leading-relaxed text-ink">
              <span
                className="mock-selection absolute top-[1px] bottom-[1px] left-0 right-0 rounded-[2px]"
                style={{ background: 'rgba(0,122,255,0.32)' }}
              />
              <span className="relative">the project has three blockers right now design review pricing approval and the api migration</span>
            </div>
            <div className="mock-after absolute inset-0 text-[11px] leading-relaxed text-ink">
              <div className="mb-1.5">The project has three blockers:</div>
              <div className="pl-2 space-y-0.5 text-ink-60">
                <div>•&nbsp; Design review</div>
                <div>•&nbsp; Pricing approval</div>
                <div>•&nbsp; API migration</div>
              </div>
            </div>

            <div className="mock-cursor absolute left-1 top-0.5">
              <MacCursor />
            </div>
          </div>

        </div>
      </div>

      {/* Pill + instruction pinned to bottom-center of the mock. */}
      <div className="mock-pill absolute left-1/2 -translate-x-1/2 bottom-4 pointer-events-none">
        <MiniPill />
      </div>
      <div className="mock-instr absolute left-1/2 -translate-x-1/2 bottom-[52px] pointer-events-none">
        <div className="bg-[#1c1c1e]/90 text-white text-[10px] px-2.5 py-1 rounded-pill whitespace-nowrap shadow-lg">
          "{instruction}"
        </div>
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
