import { useEffect, useState } from 'react'
import { SectionHero } from '../../shared/ui/SectionHero'
import { BrandLogo, type BrandSlug } from '../../shared/ui/BrandLogo'

// Visual rebuild of the AI tab. The previous one was wall-of-text; this
// one leads with an interactive mock of the selection-rewrite flow and
// follows with three app-shaped before/after demos.

interface Example {
  brand: BrandSlug
  appLabel: string
  before: string
  instruction: string
  after: string
}

const EXAMPLES: Example[] = [
  {
    brand: 'imessage',
    appLabel: 'iMessage',
    before: "hey im running like 10 minutes late sorry about that",
    instruction: "make it more polite for my manager",
    after: "Apologies — running about 10 minutes behind. Be there shortly.",
  },
  {
    brand: 'gmail',
    appLabel: 'Gmail',
    before: "we should probably try to figure out a way to make the onboarding shorter",
    instruction: "make it shorter",
    after: "Let's shorten the onboarding.",
  },
  {
    brand: 'notion',
    appLabel: 'Notion',
    before: "build a button that opens a modal when clicked and shows the user their profile",
    instruction: "rewrite as a Claude Code prompt",
    after: "Add a Button component that, on click, opens a Modal displaying the user's profile.",
  },
]

export default function AITab() {
  return (
    <div className="max-w-[760px]">
      <SectionHero
        label="AI"
        accent="violet"
        headline={<>Talk to your <em className="font-display italic">selection.</em></>}
        body="Highlight any text, press your hotkey, and tell OpenFlow what to do. The selection is rewritten in place — anywhere on your Mac."
        visual={<SelectionMock />}
      />

      <div className="space-y-3">
        {EXAMPLES.map((ex, i) => <ExampleMock key={i} ex={ex} />)}
      </div>
    </div>
  )
}

// ─── Hero mock: animated selection → rewrite ────────────────────────

function SelectionMock() {
  // Cycle through three phases on a 4.8s loop:
  //   0–1.6s: text shown with selection highlighted
  //   1.6–3.2s: instruction bubble appears beside it
  //   3.2–4.8s: selection replaced with cleaned output
  // Pure CSS keyframes; no JS clock.
  return (
    <div className="relative w-[300px] h-[260px] bg-paper border border-ink-08 rounded-[14px] overflow-hidden">
      <style>{`
        @keyframes ai-sel-fade-out {
          0%, 33%   { opacity: 1; }
          40%       { opacity: 0; }
          100%      { opacity: 0; }
        }
        @keyframes ai-inst-fade {
          0%, 30%   { opacity: 0; transform: translateY(4px); }
          38%, 65%  { opacity: 1; transform: translateY(0); }
          75%, 100% { opacity: 0; transform: translateY(4px); }
        }
        @keyframes ai-out-fade {
          0%, 60%   { opacity: 0; }
          70%, 100% { opacity: 1; }
        }
        @keyframes ai-arrow-fade {
          0%, 30%   { opacity: 0; }
          40%, 65%  { opacity: 0.5; }
          75%, 100% { opacity: 0; }
        }
        .ai-sel-text  { animation: ai-sel-fade-out 4.8s ease-in-out infinite; }
        .ai-inst-bub  { animation: ai-inst-fade    4.8s ease-in-out infinite; }
        .ai-out-text  { animation: ai-out-fade     4.8s ease-in-out infinite; }
        .ai-arrow     { animation: ai-arrow-fade   4.8s ease-in-out infinite; }
      `}</style>

      {/* Window chrome */}
      <div className="px-3 py-2 border-b border-ink-08 bg-card flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-[#FF5F57]" />
        <span className="w-2 h-2 rounded-full bg-[#FEBC2E]" />
        <span className="w-2 h-2 rounded-full bg-[#28C840]" />
      </div>

      {/* Body — selection text fades out as cleaned text fades in */}
      <div className="relative px-4 py-4 h-[calc(100%-32px)]">
        {/* Phase 1+2: original text with selection highlight */}
        <div className="ai-sel-text absolute inset-x-4 top-4 text-[12.5px] leading-relaxed text-ink-60">
          we should probably try to figure out a way to{' '}
          <span className="bg-[#6B46C1]/30 text-ink rounded-[2px] px-0.5">make the onboarding shorter</span>
        </div>

        {/* Phase 3: cleaned text */}
        <div className="ai-out-text absolute inset-x-4 top-4 text-[12.5px] leading-relaxed text-ink font-medium">
          we should probably try to figure out a way to{' '}
          <span className="text-ink font-semibold">shorten the onboarding</span>.
        </div>

        {/* Spoken instruction bubble, mid-loop */}
        <div className="ai-inst-bub absolute bottom-4 right-4 max-w-[180px]">
          <div className="bg-[#3F2570] text-[#F0E6FF] text-[11.5px] px-3 py-1.5 rounded-[14px] rounded-br-[4px] leading-snug">
            "make it shorter"
          </div>
          <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-ink-45 text-right mt-1">you said</div>
        </div>

        {/* Subtle arrow during the transition window */}
        <div className="ai-arrow absolute left-4 bottom-6 text-[#6B46C1] text-[16px]">↻</div>
      </div>
    </div>
  )
}

// ─── Per-app before/after example mocks ────────────────────────────

function ExampleMock({ ex }: { ex: Example }) {
  return (
    <div className="bg-card border border-ink-08 rounded-[14px] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-ink-08 bg-paper/40">
        <BrandLogo brand={ex.brand} size={14} />
        <span className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-ink-45">
          {ex.appLabel}
        </span>
      </div>
      <div className="px-4 py-3.5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {/* BEFORE — selection-highlighted */}
        <div>
          <div className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-ink-45 mb-1.5">Selected</div>
          <div className="text-[12px] leading-snug text-ink-60">
            <span className="bg-[#6B46C1]/22 text-ink rounded-[2px] px-0.5 py-px">{ex.before}</span>
          </div>
        </div>

        {/* Spoken instruction in the middle */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="bg-[#3F2570] text-[#F0E6FF] text-[11px] px-2.5 py-1 rounded-pill leading-none">
            {ex.instruction}
          </div>
          <span className="text-ink-45 text-[14px]">↓</span>
        </div>

        {/* AFTER */}
        <div>
          <div className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-ink-45 mb-1.5">Rewritten</div>
          <div className="text-[12px] leading-snug text-ink font-medium">{ex.after}</div>
        </div>
      </div>
    </div>
  )
}
