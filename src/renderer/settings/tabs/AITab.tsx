import { useEffect, useState } from 'react'
import { SectionHero } from '../../shared/ui/SectionHero'
import { BrandLogo, type BrandSlug } from '../../shared/ui/BrandLogo'

// AI tab — two visual mocks, both animated.
//
//   HERO: when OpenFlow knows you're typing into a chatbot (Claude,
//   ChatGPT, Cursor chat, Perplexity), it rewrites your rambly speech
//   as a clean prompt instead of preserving every "um". Mock shows
//   a Claude-style chat input doing the morph.
//
//   BODY: when you have ANY text selected in ANY app and press the
//   hotkey, the selection gets rewritten in place. Mock cycles
//   through iMessage / Gmail / Notion scenarios on a 5.4s clock so
//   users see the same primitive work across contexts.

export default function AITab() {
  return (
    <div className="max-w-[760px]">
      <SectionHero
        label="WHEN OPENFLOW SEES A CHATBOT"
        accent="violet"
        headline={<>Prompts, not <em className="font-display italic">transcripts.</em></>}
        body="Dictate into Claude, ChatGPT, Cursor chat, or any AI surface and OpenFlow restructures your speech as a clean prompt. The 'ums' and false starts go away. The intent stays."
        visual={<ChatPromptMock />}
      />

      <div className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-ink-45 mb-3 px-1 mt-2">
        Or — rewrite anything you select, anywhere
      </div>
      <SelectionRewriteCycle />
    </div>
  )
}

// ─── Hero mock: chatbot prompt engineering ─────────────────────────

function ChatPromptMock() {
  // Single-scenario loop. 0–35%: rambly dictation appears with fillers
  // crossed out. 40%–100%: cleaned prompt fades in. Loops on 5.0s.
  return (
    <div className="relative w-[300px] h-[260px] bg-paper border border-ink-08 rounded-[14px] overflow-hidden flex flex-col">
      <style>{`
        @keyframes ai-prompt-raw-fade {
          0%, 30%   { opacity: 1; }
          40%       { opacity: 0; }
          100%      { opacity: 0; }
        }
        @keyframes ai-prompt-clean-fade {
          0%, 35%   { opacity: 0; transform: translateY(4px); }
          50%, 100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes ai-prompt-caret {
          0%, 40%, 100% { opacity: 1; }
          20%, 60%      { opacity: 0; }
        }
        .ai-prompt-raw   { animation: ai-prompt-raw-fade   5s ease-in-out infinite; }
        .ai-prompt-clean { animation: ai-prompt-clean-fade 5s ease-in-out infinite; }
        .ai-prompt-caret { animation: ai-prompt-caret      1s linear      infinite; }
      `}</style>

      {/* Chat surface chrome */}
      <div className="px-3 py-2 border-b border-ink-08 bg-card flex items-center gap-2">
        <BrandLogo brand="claude" size={14} />
        <span className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-ink-45">Claude</span>
      </div>

      {/* Prior assistant turn — sets context */}
      <div className="px-3 py-2.5 flex-1 overflow-hidden">
        <div className="bg-card border border-ink-08 rounded-[8px] px-3 py-2 text-[10.5px] text-ink-60 leading-snug mb-3">
          How can I help you today?
        </div>

        {/* User's pending message — the dictated content */}
        <div className="relative">
          {/* Raw version with filler strikethroughs */}
          <div className="ai-prompt-raw text-[11.5px] leading-snug text-ink-60">
            <span className="line-through text-[#C94A2A]/70 decoration-[#C94A2A]/70">hey um</span>{' '}
            can you{' '}
            <span className="line-through text-[#C94A2A]/70 decoration-[#C94A2A]/70">uh</span>{' '}
            write me a function that takes an array and{' '}
            <span className="line-through text-[#C94A2A]/70 decoration-[#C94A2A]/70">you know</span>{' '}
            handles negative numbers
          </div>
          {/* Cleaned, prompt-engineered version */}
          <div className="ai-prompt-clean absolute inset-0 text-[12px] leading-snug text-ink font-medium">
            Write a function that takes an array and handles negative numbers.
            <span className="ai-prompt-caret inline-block w-[2px] h-[12px] bg-ink ml-0.5 align-text-bottom" />
          </div>
        </div>
      </div>

      {/* Send-button chrome strip */}
      <div className="px-3 py-2 border-t border-ink-08 bg-card flex items-center justify-end gap-2">
        <span className="text-[9px] font-mono text-ink-45">Enter to send</span>
        <span className="w-5 h-5 rounded bg-ink text-paper text-[10px] font-bold flex items-center justify-center">↑</span>
      </div>
    </div>
  )
}

// ─── Body mock: selection rewrite cycling through 3 apps ───────────

interface Scenario {
  brand: BrandSlug
  appLabel: string
  /** Header chrome for the mocked app (To/Subject for Gmail, etc.). null = no chrome */
  chrome: 'imessage' | 'gmail' | 'notion'
  before: string
  instruction: string
  after: string
}

const SCENARIOS: Scenario[] = [
  {
    brand: 'imessage',
    appLabel: 'iMessage',
    chrome: 'imessage',
    before: "i regret to inform you that i will be unable to attend the dinner this evening",
    instruction: "make this casual, like im texting a friend",
    after: "hey can't make dinner tonight — rain check?",
  },
  {
    brand: 'gmail',
    appLabel: 'Gmail',
    chrome: 'gmail',
    before: "yo so basically the meeting got moved to like 3pm tomorrow lmk if that works",
    instruction: "make it more formal",
    after: "Heads up — the meeting is now at 3 PM tomorrow. Please let me know if that works.",
  },
  {
    brand: 'notion',
    appLabel: 'Notion',
    chrome: 'notion',
    before: "the project has three blockers right now design review pricing approval and the api migration",
    instruction: "turn into bullets",
    after: "The project has three blockers:\n• Design review\n• Pricing approval\n• API migration",
  },
]

function SelectionRewriteCycle() {
  // Step through scenarios on a 5.4s timer. Within each scenario the
  // before → instruction → after sequence is driven by a sub-phase
  // counter that ticks every 1.8s.
  const [scenarioIdx, setScenarioIdx] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => {
      setScenarioIdx((i) => (i + 1) % SCENARIOS.length)
    }, 5400)
    return () => window.clearInterval(id)
  }, [])

  const s = SCENARIOS[scenarioIdx]

  return (
    <div className="bg-card border border-ink-08 rounded-[14px] overflow-hidden">
      {/* App-chrome strip — brand swaps when scenario advances */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-ink-08 bg-paper/40 transition-colors duration-300">
        <BrandLogo brand={s.brand} size={14} />
        <span className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-ink-45">
          {s.appLabel}
        </span>
      </div>

      {/* Re-keyed body so the within-card animation replays each cycle */}
      <div key={scenarioIdx} className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-5 min-h-[200px] animate-stepIn">
        {/* Selected — purple highlight */}
        <div>
          <div className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-ink-45 mb-2">Selected</div>
          <div className="text-[12.5px] leading-snug text-ink-60">
            <span className="bg-[#6B46C1]/22 text-ink rounded-[2px] px-0.5 py-px">{s.before}</span>
          </div>
        </div>

        {/* Spoken instruction */}
        <div className="flex flex-col items-center gap-2 px-2">
          <div className="bg-[#3F2570] text-[#F0E6FF] text-[11px] px-2.5 py-1.5 rounded-pill leading-snug max-w-[130px] text-center">
            {s.instruction}
          </div>
          <span className="text-ink-45 text-[16px]">↓</span>
        </div>

        {/* Result */}
        <div>
          <div className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-ink-45 mb-2">Rewritten</div>
          <div className="text-[12.5px] leading-snug text-ink font-medium whitespace-pre-line">{s.after}</div>
        </div>
      </div>

      {/* Cycle dots so users know the mock is rotating, not stuck */}
      <div className="flex items-center justify-center gap-1.5 pb-3 pt-1">
        {SCENARIOS.map((_, i) => (
          <span
            key={i}
            className={[
              'h-1 rounded-full transition-all duration-300',
              i === scenarioIdx ? 'w-5 bg-ink' : 'w-1.5 bg-ink-08',
            ].join(' ')}
          />
        ))}
      </div>
    </div>
  )
}
