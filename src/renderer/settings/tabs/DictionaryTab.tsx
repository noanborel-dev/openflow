import { useEffect, useState } from 'react'
import type { Settings } from '../../../shared/types'
import { Pill } from '../../shared/ui/Pill'
import { SectionHero } from '../../shared/ui/SectionHero'

export default function DictionaryTab() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    window.openflow.getSettings().then(setSettings)
  }, [])

  if (!settings) return <div className="text-ink-45 text-sm">Loading…</div>

  const terms = settings.userDictionary ?? []

  async function persist(next: string[]) {
    if (!settings) return
    await window.openflow.setSettings({ userDictionary: next })
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
        number="04"
        label="DICTIONARY"
        accent="cobalt"
        headline={<>Names &amp; <em className="font-display italic">jargon</em>, recognized.</>}
        body="Add words OpenFlow should always get right. Built-in terms (Claude, GitHub, OAuth, etc.) are already covered — add the names, products, or jargon Whisper keeps mishearing."
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

// Floating example card in the hero, showing how a dictionary entry
// looks once it's been recognized in real transcripts.
function DictionaryExample() {
  return (
    <div className="bg-paper border border-ink-08 rounded-[12px] px-4 py-3.5 w-full max-w-[260px] shadow-sm">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[14px] font-semibold">Anthropic</span>
        <span className="text-[9.5px] font-mono uppercase tracking-[0.14em] bg-[rgba(43,127,255,0.1)] text-[#2B7FFF] px-2 py-0.5 rounded-full">
          company
        </span>
      </div>
      <div className="text-[11px] font-mono text-ink-60 mb-3">an-THROW-pic</div>
      <div className="text-[10.5px] text-ink-45">
        recognized in 12 transcripts this week
      </div>
    </div>
  )
}
