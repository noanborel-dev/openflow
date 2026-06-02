import { useEffect, useState } from 'react'
import type { Settings } from '../../../shared/types'
import { Pill } from '../../shared/ui/Pill'
import { SectionHero } from '../../shared/ui/SectionHero'

export default function DictionaryTab() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    window.yappr.getSettings().then(setSettings)
  }, [])

  if (!settings) return <div className="text-ink-45 text-sm">Loading…</div>

  const terms = settings.userDictionary ?? []

  async function persist(next: string[]) {
    if (!settings) return
    await window.yappr.setSettings({ userDictionary: next })
    setSettings({ ...settings, userDictionary: next })
  }

  function add() {
    const t = draft.trim()
    if (!t) return
    if (terms.some(x => x.toLowerCase() === t.toLowerCase())) {
      setDraft('')
      return
    }
    persist([...terms, t])
    setDraft('')
  }

  function remove(idx: number) {
    persist(terms.filter((_, i) => i !== idx))
  }

  return (
    <div className="max-w-[760px]">
      <SectionHero
        label="DICTIONARY"
        accent="cobalt"
        headline={<>Names &amp; <em className="font-display italic">jargon</em>, recognized.</>}
        body="Add words Yappr should always get right. Built-in terms (Claude, GitHub, OAuth, etc.) are already covered — add the names, products, or jargon Whisper keeps mishearing."
        visual={<DictionaryExample />}
      />

      <div className="bg-card border border-ink-08 rounded-[14px] px-4 py-4 mb-4">
        <div className="flex items-stretch gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            placeholder="Add a word…"
            className="flex-1 bg-paper border border-ink-08 rounded-[10px] px-3.5 py-2.5 text-[12.5px] focus:outline-none focus:border-volt focus:ring-2 focus:ring-volt-muted"
          />
          <Pill variant="primary" onClick={add} disabled={!draft.trim()}>
            + Add word
          </Pill>
        </div>
      </div>

      {terms.length === 0 ? (
        <div className="text-[11.5px] text-ink-45 px-2">
          No custom terms yet. Built-ins still apply.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {terms.map((t, i) => (
            <div
              key={`${t}-${i}`}
              className="bg-card border border-ink-08 rounded-[12px] px-4 py-3 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold truncate">{t}</div>
              </div>
              <button
                onClick={() => remove(i)}
                aria-label={`Remove ${t}`}
                className="w-6 h-6 inline-flex items-center justify-center text-ink-45 hover:text-ink hover:bg-ink-08 rounded-full transition-colors leading-none"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10.5px] text-ink-45 mt-5 leading-relaxed">
        Limit ~30–50 terms — Whisper caps the prompt at 224 tokens.
      </p>
    </div>
  )
}

// Hero visual — a live-transcription mock showing how Yappr correctly
// recognizes dictionary terms. Cycles through three transcripts every
// 4.5s. Within each transcript, the "without" version (left side, with
// red-strikethrough mistranscriptions) cross-fades into the "with"
// version (clean text with cobalt-underlined dictionary hits).
import { MiniPill } from '../../shared/ui/MiniPill'

interface TranscriptSample {
  /** What Whisper might output without dictionary biasing — common
   *  mishearings of brand names. */
  without: Array<{ text: string; wrong?: boolean }>
  /** Cleaned with dictionary — the wrong segments map to the right
   *  ones, dictionary hits get a cobalt underline. */
  with: Array<{ text: string; hit?: boolean }>
}

const TRANSCRIPTS: TranscriptSample[] = [
  {
    without: [
      { text: 'send to ' },
      { text: 'Anthrope', wrong: true },
      { text: ' about ' },
      { text: 'Cloud', wrong: true },
      { text: ' Sonnet' },
    ],
    with: [
      { text: 'Send to ' },
      { text: 'Anthropic', hit: true },
      { text: ' about ' },
      { text: 'Claude', hit: true },
      { text: ' Sonnet.' },
    ],
  },
  {
    without: [
      { text: 'push to ' },
      { text: 'Get Hub', wrong: true },
      { text: ' and run ' },
      { text: 'koob control', wrong: true },
    ],
    with: [
      { text: 'Push to ' },
      { text: 'GitHub', hit: true },
      { text: ' and run ' },
      { text: 'kubectl', hit: true },
      { text: '.' },
    ],
  },
  {
    without: [
      { text: 'update the ' },
      { text: 'OH-auth', wrong: true },
      { text: ' flow in ' },
      { text: 'next JS', wrong: true },
    ],
    with: [
      { text: 'Update the ' },
      { text: 'OAuth', hit: true },
      { text: ' flow in ' },
      { text: 'Next.js', hit: true },
      { text: '.' },
    ],
  },
]

function DictionaryExample() {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setIdx((i) => (i + 1) % TRANSCRIPTS.length), 4500)
    return () => window.clearInterval(id)
  }, [])
  const t = TRANSCRIPTS[idx]
  return (
    <div className="relative w-[300px] h-[200px] rounded-[14px] overflow-hidden bg-white border border-ink-08 flex flex-col">
      <style>{`
        @keyframes dict-without { 0%, 38% { opacity: 1; } 48%, 100% { opacity: 0; } }
        @keyframes dict-with    { 0%, 44% { opacity: 0; } 56%, 100% { opacity: 1; } }
        @keyframes dict-hit     { 0%, 56% { background-color: rgba(43,127,255,0); } 62%, 80% { background-color: rgba(43,127,255,0.18); } 92%, 100% { background-color: rgba(43,127,255,0); } }
        .dict-without { animation: dict-without 4.5s ease-in-out infinite; }
        .dict-with    { animation: dict-with    4.5s ease-in-out infinite; }
        .dict-hit     { animation: dict-hit     4.5s ease-in-out infinite; }
      `}</style>

      {/* Window chrome with mini pill */}
      <div className="px-3 py-2 border-b border-ink-08 bg-card flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-[8px] h-[8px] rounded-full bg-[#FF5F57]" />
          <span className="w-[8px] h-[8px] rounded-full bg-[#FEBC2E]" />
          <span className="w-[8px] h-[8px] rounded-full bg-[#28C840]" />
        </div>
        <MiniPill state="listening" />
      </div>

      <div key={idx} className="flex-1 px-4 py-4 relative animate-stepIn">
        {/* "Without dictionary" — red strikethroughs on misheard parts */}
        <div className="dict-without text-[12.5px] leading-relaxed text-ink-60">
          {t.without.map((seg, i) => (
            <span key={i} className={seg.wrong ? 'line-through decoration-[#C94A2A] text-[#C94A2A]/85' : ''}>
              {seg.text}
            </span>
          ))}
        </div>

        {/* "With dictionary" — dictionary hits get a cobalt highlight pulse */}
        <div className="dict-with absolute inset-0 px-4 py-4 text-[12.5px] leading-relaxed text-ink font-medium">
          {t.with.map((seg, i) => (
            <span
              key={i}
              className={seg.hit ? 'dict-hit rounded-[2px] px-0.5 underline decoration-[#2B7FFF] decoration-2 underline-offset-2' : ''}
            >
              {seg.text}
            </span>
          ))}
        </div>
      </div>

      <div className="px-3 py-1.5 border-t border-ink-08 bg-paper/40 flex items-center gap-1.5">
        {TRANSCRIPTS.map((_, i) => (
          <span
            key={i}
            className={[
              'h-1 rounded-full transition-all duration-300',
              i === idx ? 'w-4 bg-ink' : 'w-1 bg-ink-08',
            ].join(' ')}
          />
        ))}
      </div>
    </div>
  )
}
