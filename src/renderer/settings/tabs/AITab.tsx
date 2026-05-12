import { SectionHero } from '../../shared/ui/SectionHero'

// Discovery / explainer for the rewrite-selection feature shipped in
// commit 5b9424f. The actual behavior is on by default — there are no
// settings to flip here yet. The tab exists to make the feature
// discoverable: most users won't try "select text + press hotkey + speak
// instruction" unless they're told it's a thing.

interface Example {
  before: string
  instruction: string
  after: string
}

const EXAMPLES: Example[] = [
  {
    before: "we should probably try to figure out a way to make the onboarding shorter",
    instruction: '"make it shorter"',
    after: "Shorten the onboarding.",
  },
  {
    before: "build a button that opens a modal when clicked and shows the user their profile",
    instruction: '"rewrite as a Claude Code prompt"',
    after: "Add a Button component that, on click, opens a Modal displaying the user's profile.",
  },
  {
    before: "hey i'm running like 10 minutes late sorry about that",
    instruction: '"make it more polite for my manager"',
    after: "Apologies — running about 10 minutes behind. Be there shortly.",
  },
]

export default function AITab() {
  return (
    <div className="max-w-[760px]">
      <SectionHero
        label="AI"
        accent="violet"
        headline={<>Talk to your <em className="font-display italic">selection.</em></>}
        body="Highlight any text anywhere, press your hotkey, and tell OpenFlow what to do with it. The selection gets rewritten and pastes back over the original."
        visual={<HowItWorks />}
      />

      <div className="mb-5">
        <div className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-ink-45 mb-3 px-1">
          What you can ask for
        </div>
        <div className="space-y-2.5">
          {EXAMPLES.map((ex, i) => <ExampleCard key={i} ex={ex} />)}
        </div>
      </div>

      <div className="bg-card border border-ink-08 rounded-[14px] px-5 py-4 text-[12px] text-ink-60 leading-relaxed">
        <div className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-ink-45 mb-2">
          How it works
        </div>
        <p className="mb-2">
          When you press the hotkey, OpenFlow checks whether you have any text selected. If you do (5+ characters), it switches into <span className="text-ink font-medium">rewrite mode</span>: your dictation is treated as an instruction, the LLM rewrites your selection to match, and the result pastes over what you had highlighted.
        </p>
        <p className="m-0">
          No selection? You get normal dictation — same as always. The mode switch happens automatically. The instruction goes to your configured provider's cleanup model (Groq Llama 3.1, OpenAI GPT-4o-mini, or Anthropic Claude Haiku) — your audio still goes straight to your provider, never proxied through us.
        </p>
      </div>
    </div>
  )
}

function ExampleCard({ ex }: { ex: Example }) {
  return (
    <div className="bg-card border border-ink-08 rounded-[12px] px-4 py-3.5">
      <div className="text-[11.5px] text-ink-45 italic mb-1.5">"{ex.before}"</div>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#6B46C1]">You say</div>
        <div className="text-[12px] font-medium text-ink">{ex.instruction}</div>
      </div>
      <div className="flex items-start gap-2">
        <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-ink-45 mt-1">→</div>
        <div className="text-[13px] text-ink leading-snug font-medium">{ex.after}</div>
      </div>
    </div>
  )
}

function HowItWorks() {
  // Three-step strip — select → say → done. CSS-only, no animation
  // needed; the surrounding card already breathes via the section
  // accent gradient.
  return (
    <div className="flex flex-col gap-2 w-full max-w-[280px]">
      <Step n={1} label="Highlight any text" />
      <Step n={2} label="Press your hotkey + speak" />
      <Step n={3} label="Selection is rewritten" />
    </div>
  )
}

function Step({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-full bg-[#6B46C1] text-white font-mono text-[11px] flex items-center justify-center shrink-0">
        {n}
      </div>
      <div className="text-[12.5px] text-ink leading-snug">{label}</div>
    </div>
  )
}
