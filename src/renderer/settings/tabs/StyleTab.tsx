import { SectionHero } from '../../shared/ui/SectionHero'

// Style is informational for now — three example bubbles showing how the
// same dictation gets rendered for different contexts. The actual register
// is driven by the Polish setting per bucket; this tab makes the result
// concrete so users understand what they're choosing.

interface RegisterExample {
  label: string
  output: string
  bg: string
  fg: string
}

const REGISTERS: RegisterExample[] = [
  {
    label: 'Formal',
    output: 'Hey, are you free for lunch tomorrow?',
    bg: '#E5E1F0',
    fg: '#1F1B2E',
  },
  {
    label: 'Casual',
    output: "Hey are you free for lunch tomorrow? Let's do 12 if that works",
    bg: '#F5DCDA',
    fg: '#2A1A18',
  },
  {
    label: 'Very-casual',
    output: 'hey are you free for lunch tomorrow lets do 12 if that works',
    bg: '#3F2570',
    fg: '#F0E6FF',
  },
]

export default function StyleTab() {
  return (
    <div className="max-w-[760px]">
      <SectionHero
        number="02"
        label="STYLE"
        accent="violet"
        headline={<>One voice, <em className="font-display italic">three</em> registers.</>}
        body="Same content, calibrated to context. Casual to clients, very-casual to roommates, formal in email."
        visual={<BubbleStack />}
      />

      <div className="bg-card border border-ink-08 rounded-[14px] px-5 py-5">
        <div className="text-[12px] text-ink-60 leading-relaxed">
          Each context in <b className="text-ink">Polish</b> picks a register automatically. iMessage and Slack DMs go very-casual; Slack channels and Gmail get casual to formal; Notion and Google Docs go formal. There's nothing to configure here — this is what the polish levels look like in practice.
        </div>
      </div>
    </div>
  )
}

function BubbleStack() {
  return (
    <div className="flex flex-col gap-2 w-full max-w-[300px]">
      {REGISTERS.map((r) => (
        <div
          key={r.label}
          className="rounded-[18px] px-4 py-2.5 text-[12.5px] leading-snug"
          style={{ background: r.bg, color: r.fg }}
        >
          {r.output}
        </div>
      ))}
      <div className="text-right text-[9.5px] font-mono uppercase tracking-[0.18em] text-ink-45 mt-1">
        FORMAL  ·  CASUAL  ·  <span style={{ color: '#6B46C1' }}>VERY-CASUAL</span>
      </div>
    </div>
  )
}
