import { useEffect, useState } from 'react'
import { SectionHero } from '../../shared/ui/SectionHero'
import { BrandLogo } from '../../shared/ui/BrandLogo'

// AI tab — two mocks, both visual.
//
//   HERO: chat input morphs from rambly dictation to a clean prompt
//   when OpenFlow detects you're talking to a chatbot.
//
//   BODY: cycles through real app-UI mockups (iMessage thread, Gmail
//   compose, Notion page). Each cycle shows the rewrite happening
//   INSIDE that app's chrome — not as an abstract before/after card.

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
        {/* Chat input — the message being composed lives here. */}
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

// ─── Body cycle: real app UI mockups ───────────────────────────────

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
      <div className="grid grid-cols-[1fr_auto] gap-5 items-center px-5 py-5">
        <div key={s} className="animate-stepIn">
          {s === 'imessage' && <IMessageMock />}
          {s === 'gmail'    && <GmailMock />}
          {s === 'notion'   && <NotionMock />}
        </div>

        {/* Spoken instruction sits to the right of each app mock,
            consistent across cycles so the morph feels like the same
            primitive in three different contexts. */}
        <div className="flex flex-col items-center gap-2 min-w-[140px]">
          <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-ink-45">You say</div>
          <div className="bg-[#3F2570] text-[#F0E6FF] text-[11.5px] px-3 py-1.5 rounded-pill leading-snug text-center">
            {INSTRUCTIONS[s]}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 pb-3 pt-1">
        {ORDER.map((_, i) => (
          <span
            key={i}
            className={[
              'h-1 rounded-full transition-all duration-300',
              i === idx ? 'w-5 bg-ink' : 'w-1.5 bg-ink-08',
            ].join(' ')}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Per-app UI mockups ────────────────────────────────────────────
//
// Each mock simulates the actual app's chrome closely enough that
// users recognize it at a glance: bubble shapes for iMessage, To/Subject
// header for Gmail, page title + body for Notion. Within each mock the
// "before" text appears in the compose/edit surface with a violet
// selection highlight, then morphs to the cleaned version.

function IMessageMock() {
  return (
    <div className="w-full max-w-[340px] mx-auto">
      <style>{`
        @keyframes im-before-fade { 0%, 38% { opacity: 1; } 48%, 100% { opacity: 0; } }
        @keyframes im-after-fade  { 0%, 44% { opacity: 0; } 56%, 100% { opacity: 1; } }
        .im-before { animation: im-before-fade 5.6s ease-in-out infinite; }
        .im-after  { animation: im-after-fade  5.6s ease-in-out infinite; }
      `}</style>
      <div className="bg-[#f5f5f7] rounded-[14px] border border-ink-08 overflow-hidden shadow-sm">
        {/* iMessage status header */}
        <div className="px-3 py-2 text-center border-b border-ink-08/50">
          <div className="text-[10px] text-ink-45 font-medium">Alex</div>
        </div>
        {/* Thread */}
        <div className="px-3 py-3 space-y-1.5 min-h-[120px]">
          <div className="flex justify-start">
            <div className="bg-[#e9e9eb] text-ink text-[11.5px] px-3 py-1.5 rounded-[15px] rounded-bl-[4px] max-w-[80%] leading-snug">
              Dinner still on tonight?
            </div>
          </div>
          {/* Compose-area-style bubble showing the dictated draft */}
          <div className="flex justify-end">
            <div className="relative min-w-[200px] max-w-[80%]">
              <div className="im-before bg-[#0b93f6] text-white text-[11.5px] px-3 py-1.5 rounded-[15px] rounded-br-[4px] leading-snug">
                <span className="bg-white/25 rounded-[2px] px-0.5">I regret to inform you that I will be unable to attend tonight</span>
              </div>
              <div className="im-after absolute inset-0 bg-[#0b93f6] text-white text-[11.5px] px-3 py-1.5 rounded-[15px] rounded-br-[4px] leading-snug">
                yo can't make it tonight — rain check?
              </div>
            </div>
          </div>
        </div>
        {/* Compose bar */}
        <div className="px-3 py-2 border-t border-ink-08/50 bg-white/40 flex items-center gap-2">
          <div className="flex-1 bg-white border border-ink-08 rounded-pill h-6" />
          <div className="w-5 h-5 rounded-full bg-[#0b93f6] text-white text-[10px] flex items-center justify-center">↑</div>
        </div>
      </div>
    </div>
  )
}

function GmailMock() {
  return (
    <div className="w-full max-w-[360px] mx-auto">
      <style>{`
        @keyframes gm-before-fade { 0%, 38% { opacity: 1; } 48%, 100% { opacity: 0; } }
        @keyframes gm-after-fade  { 0%, 44% { opacity: 0; } 56%, 100% { opacity: 1; } }
        .gm-before { animation: gm-before-fade 5.6s ease-in-out infinite; }
        .gm-after  { animation: gm-after-fade  5.6s ease-in-out infinite; }
      `}</style>
      <div className="bg-white rounded-[8px] border border-ink-08 overflow-hidden shadow-sm">
        {/* Gmail compose chrome */}
        <div className="bg-[#404040] text-white text-[10.5px] px-3 py-1.5 flex items-center justify-between">
          <span>New Message</span>
          <span className="text-white/60">_ ⛶ ✕</span>
        </div>
        <div className="px-3 py-1.5 border-b border-ink-08/60 text-[10.5px] text-ink-60">
          To <span className="text-ink ml-1">alex@company.com</span>
        </div>
        <div className="px-3 py-1.5 border-b border-ink-08/60 text-[10.5px] text-ink-60">
          Subject <span className="text-ink ml-1">Meeting move</span>
        </div>
        {/* Body */}
        <div className="px-3 py-3 min-h-[100px] relative">
          <div className="gm-before text-[11.5px] leading-relaxed text-ink-60">
            <span className="bg-[#6B46C1]/22 text-ink rounded-[2px] px-0.5">yo so basically the meeting got moved to like 3pm tomorrow lmk if that works</span>
          </div>
          <div className="gm-after absolute inset-0 px-3 py-3 text-[11.5px] leading-relaxed text-ink">
            Heads up — the meeting is now at 3 PM tomorrow. Please let me know if that works.
          </div>
        </div>
        {/* Send button strip */}
        <div className="px-3 py-2 border-t border-ink-08/60 flex items-center gap-2">
          <div className="bg-[#1a73e8] text-white text-[11px] font-medium px-3 py-1 rounded">Send</div>
        </div>
      </div>
    </div>
  )
}

function NotionMock() {
  return (
    <div className="w-full max-w-[360px] mx-auto">
      <style>{`
        @keyframes nt-before-fade { 0%, 38% { opacity: 1; } 48%, 100% { opacity: 0; } }
        @keyframes nt-after-fade  { 0%, 44% { opacity: 0; } 56%, 100% { opacity: 1; } }
        .nt-before { animation: nt-before-fade 5.6s ease-in-out infinite; }
        .nt-after  { animation: nt-after-fade  5.6s ease-in-out infinite; }
      `}</style>
      <div className="bg-white rounded-[6px] border border-ink-08 overflow-hidden shadow-sm">
        {/* Notion page title */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center gap-2 text-[11px] text-ink-45 mb-2">
            <span>📁</span>
            <span>Engineering / Status</span>
          </div>
          <div className="text-[18px] font-bold leading-tight">Project blockers</div>
        </div>
        {/* Body */}
        <div className="px-5 py-3 min-h-[100px] relative">
          <div className="nt-before text-[11.5px] leading-relaxed text-ink-60">
            <span className="bg-[#6B46C1]/22 text-ink rounded-[2px] px-0.5">the project has three blockers right now design review pricing approval and the api migration</span>
          </div>
          <div className="nt-after absolute inset-0 px-5 py-3 text-[11.5px] leading-relaxed text-ink">
            <div className="mb-1">The project has three blockers:</div>
            <div className="pl-1 space-y-0.5 text-ink-60">
              <div>•  Design review</div>
              <div>•  Pricing approval</div>
              <div>•  API migration</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
