import { useState } from 'react'
import { SectionHero } from '../../shared/ui/SectionHero'
import { BrandLogo } from '../../shared/ui/BrandLogo'

// "Tour" tab — a reference page for what OpenFlow does, organized like
// the onboarding but persistent and revisitable from Settings. Each
// feature gets a card with a visual mock + a one-line "how to use it".
// No state mutation here; users tweak actual settings from their own
// tabs. This is read-only discovery.

export default function TourTab() {
  return (
    <div className="max-w-[760px] space-y-5">
      <SectionHero
        label="TOUR"
        accent="cobalt"
        headline={<>Everything OpenFlow <em className="font-display italic">does.</em></>}
        body="A quick visual reference for the things that are easy to forget. Each section here has its own dedicated settings tab if you want to change anything."
      />

      <HotkeyCard />
      <PolishCard />
      <AICard />
      <PrivacyCard />
    </div>
  )
}

// ─── Hotkey card ────────────────────────────────────────────────────

function HotkeyCard() {
  return (
    <FeatureCard title="One key, three behaviors" tabHint="Hotkey tab">
      <div className="grid grid-cols-3 gap-3 mb-3">
        <GestureCard label="Tap" desc="Toggle recording on; tap again to stop." pattern="tap" />
        <GestureCard label="Hold" desc="Record while held. Release to stop." pattern="hold" />
        <GestureCard label="Double-tap" desc="Paste your most recent dictation again." pattern="double" />
      </div>
      <p className="text-[11.5px] text-ink-60 leading-relaxed">
        Bound to <span className="font-mono text-ink bg-paper border border-ink-08 px-1.5 py-0.5 rounded text-[10.5px]">⌃ Ctrl</span> by default. Change it in the Hotkey tab.
      </p>
    </FeatureCard>
  )
}

function GestureCard({ label, desc, pattern }: { label: string; desc: string; pattern: 'tap' | 'hold' | 'double' }) {
  return (
    <div className="bg-paper/60 border border-ink-08 rounded-[12px] px-3 py-3">
      <div className="flex items-center justify-center mb-2 h-8">
        <KeyDotPattern pattern={pattern} />
      </div>
      <div className="text-[12px] font-semibold leading-tight">{label}</div>
      <div className="text-[10.5px] text-ink-60 mt-0.5 leading-snug">{desc}</div>
    </div>
  )
}

// Simple piano-roll visualization of each gesture's timing — no
// expensive looping animation, just a static depiction. Easier to read
// than the onboarding's animated keycap because users glance at this
// rather than learn it.
function KeyDotPattern({ pattern }: { pattern: 'tap' | 'hold' | 'double' }) {
  if (pattern === 'tap') {
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-[#5A8FE8]" />
        <div className="w-12 h-px bg-ink-08" />
      </div>
    )
  }
  if (pattern === 'hold') {
    return (
      <div className="flex items-center gap-1">
        <div className="w-12 h-1.5 rounded-full bg-[#5A8FE8]" />
        <div className="w-2 h-px bg-ink-08" />
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-1.5 h-1.5 rounded-full bg-[#5A8FE8]" />
      <div className="w-2 h-px bg-ink-08" />
      <div className="w-1.5 h-1.5 rounded-full bg-[#5A8FE8]" />
      <div className="w-6 h-px bg-ink-08" />
    </div>
  )
}

// ─── Polish card ────────────────────────────────────────────────────

function PolishCard() {
  const [active, setActive] = useState<'imessage' | 'gmail' | 'notion'>('imessage')
  return (
    <FeatureCard title="Polish per context" tabHint="Polish tab">
      <p className="text-[11.5px] text-ink-60 leading-relaxed mb-3">
        Hover an app to see how the same dictation comes out in each context. Casual to friends, formal to clients, balanced in your notes.
      </p>
      <div className="flex items-center gap-2 mb-3">
        {(['imessage', 'gmail', 'notion'] as const).map((brand) => (
          <button
            key={brand}
            onMouseEnter={() => setActive(brand)}
            onClick={() => setActive(brand)}
            className={[
              'flex items-center gap-2 px-3 py-1.5 rounded-pill border transition-colors text-[11.5px]',
              active === brand ? 'border-ink bg-card' : 'border-ink-08 bg-paper/40 hover:border-ink-45',
            ].join(' ')}
          >
            <BrandLogo brand={brand} size={14} />
            <span className="font-medium">{LABEL[brand]}</span>
          </button>
        ))}
      </div>
      <div className="bg-paper/60 border border-ink-08 rounded-[12px] px-4 py-3.5 min-h-[110px]">
        <div className="text-[9.5px] font-mono uppercase tracking-[0.16em] text-ink-45 mb-1">You said</div>
        <div className="text-[11.5px] text-ink-45 italic mb-3 leading-snug">"{SAMPLES[active].raw}"</div>
        <div className="text-[9.5px] font-mono uppercase tracking-[0.16em] text-ink-45 mb-1">OpenFlow typed</div>
        <div key={active} className="text-[13px] text-ink leading-snug font-medium">
          {SAMPLES[active].out}
        </div>
      </div>
    </FeatureCard>
  )
}

const LABEL: Record<'imessage' | 'gmail' | 'notion', string> = {
  imessage: 'iMessage',
  gmail: 'Gmail',
  notion: 'Notion',
}
const SAMPLES: Record<'imessage' | 'gmail' | 'notion', { raw: string; out: string }> = {
  imessage: {
    raw: "yo um did you get the package i sent like the one with the book",
    out: "yo did you get the package I sent? the one with the book",
  },
  gmail: {
    raw: "hey just wanted to follow up on the proposal um can you let me know if you got a chance to look at it",
    out: "Hi — following up on the proposal. Could you let me know once you've had a chance to review it?",
  },
  notion: {
    raw: "so the main idea is that um we want users to feel like the app is responding to them and like adapting",
    out: "The core idea: users should feel the app responds and adapts to them.",
  },
}

// ─── AI rewrite card ────────────────────────────────────────────────

function AICard() {
  return (
    <FeatureCard title="Rewrite anything you select" tabHint="AI tab">
      <p className="text-[11.5px] text-ink-60 leading-relaxed mb-3">
        Highlight text in any app, press your hotkey, and tell OpenFlow what to do. The selection gets rewritten in place.
      </p>
      <div className="bg-paper/60 border border-ink-08 rounded-[12px] px-4 py-3">
        <div className="text-[11.5px] text-ink-45 italic mb-2">"we should probably try to figure out a way to make the onboarding shorter"</div>
        <div className="flex items-baseline gap-2 mb-1">
          <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#6B46C1]">You say</div>
          <div className="text-[11.5px] font-medium text-ink">"make it shorter"</div>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-ink-45 text-[11px] mt-0.5">→</span>
          <div className="text-[12.5px] text-ink leading-snug font-medium">Shorten the onboarding.</div>
        </div>
      </div>
    </FeatureCard>
  )
}

// ─── Privacy card ───────────────────────────────────────────────────

function PrivacyCard() {
  return (
    <FeatureCard title="Your audio doesn't pass through us" tabHint="Provider · About tabs">
      <p className="text-[11.5px] text-ink-60 leading-relaxed">
        OpenFlow doesn't proxy anything. Audio goes directly from your mic to whichever provider you've configured (Groq, OpenAI, Anthropic) using your own API key. We never see your audio, transcripts, or keys on any server we control.
      </p>
    </FeatureCard>
  )
}

// ─── Shared card chrome ────────────────────────────────────────────

function FeatureCard({
  title, tabHint, children,
}: { title: string; tabHint: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-ink-08 rounded-[14px] px-5 py-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[15px] font-semibold leading-tight">{title}</h3>
        <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-ink-45">→ {tabHint}</span>
      </div>
      {children}
    </div>
  )
}
