import { useEffect, useState } from 'react'
import type { Settings } from '../../../shared/types'
import { Card, Row } from '../../shared/ui/Card'
import { Pill } from '../../shared/ui/Pill'

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
    <div className="max-w-md space-y-3">
      <p className="text-[12px] text-ink-60 leading-relaxed">
        Add names, brands, or jargon Whisper keeps mistranscribing. These are sent
        as context with each request to bias spelling.
        Built-ins (Claude, ChatGPT, GitHub, etc.) are already included.
      </p>

      <Card>
        <Row>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            placeholder="e.g. Astro, my-team-name, kubectl"
            className="flex-1 bg-paper border border-ink-08 rounded-input px-3 py-2 text-[12.5px] focus:outline-none focus:border-volt focus:ring-2 focus:ring-volt-muted"
          />
          <Pill variant="primary" onClick={add} disabled={!draft.trim()}>
            Add
          </Pill>
        </Row>
        {terms.length > 0 && (
          <Row>
            <div className="flex flex-wrap gap-1.5 flex-1">
              {terms.map((t, i) => (
                <span
                  key={`${t}-${i}`}
                  className="inline-flex items-center gap-1.5 bg-paper border border-ink-08 rounded-pill px-2.5 py-1 text-[11px] font-mono"
                >
                  {t}
                  <button
                    onClick={() => remove(i)}
                    className="text-ink-45 hover:text-ink leading-none"
                    aria-label={`Remove ${t}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </Row>
        )}
      </Card>

      <p className="text-[10.5px] text-ink-45">
        Limit ~30–50 terms — Whisper caps the prompt at 224 tokens.
      </p>
    </div>
  )
}
