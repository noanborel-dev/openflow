import { useEffect, useState } from 'react'
import type { Settings, Provider } from '../../../shared/types'
import { MODELS } from '../../../shared/constants'
import { Card, Row } from '../../shared/ui/Card'
import { Pill } from '../../shared/ui/Pill'

const PROVIDER_OPTIONS: { value: Provider; label: string; hint: string }[] = [
  { value: 'groq',      label: 'Groq · Whisper',        hint: 'Recommended — fast & free tier' },
  { value: 'openai',    label: 'OpenAI',                hint: 'Whisper + GPT-4o-mini cleanup' },
  { value: 'anthropic', label: 'Anthropic (+ Groq key)',hint: 'Claude cleanup, Groq transcription' },
]

export default function AIProviderTab() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)

  useEffect(() => {
    window.openflow.getSettings().then(setSettings)
  }, [])

  if (!settings) return <div className="text-ink-45 text-sm">Loading…</div>

  const { provider } = settings.provider

  async function save(partial: Partial<Settings['provider']>) {
    if (!settings) return
    const updated = { ...settings.provider, ...partial }
    await window.openflow.setSettings({ provider: updated })
    setSettings({ ...settings, provider: updated })
    setTestResult(null)
  }

  async function testKey() {
    if (!settings) return
    setTesting(true)
    setTestResult(null)
    const key =
      provider === 'groq' ? settings.provider.groqKey
      : provider === 'openai' ? settings.provider.openaiKey
      : settings.provider.anthropicKey
    const result = await window.openflow.testProvider(provider, key)
    setTestResult(result)
    setTesting(false)
  }

  const needsGroqKey = provider === 'groq' || provider === 'anthropic'

  return (
    <div className="max-w-md space-y-3">
      <Card>
        {PROVIDER_OPTIONS.map((opt, i) => {
          const on = opt.value === provider
          return (
            <Row key={opt.value} className={i === PROVIDER_OPTIONS.length - 1 ? '' : ''}>
              <button
                onClick={() => save({
                  provider: opt.value,
                  transcriptionModel: MODELS[opt.value].transcription,
                  cleanupModel: MODELS[opt.value].cleanup,
                })}
                className="flex items-center gap-3 w-full text-left"
              >
                <span className={`w-4 h-4 rounded-full border ${on ? 'border-ink bg-ink' : 'border-ink-08'} flex items-center justify-center`}>
                  {on && <span className="w-1.5 h-1.5 rounded-full bg-volt" />}
                </span>
                <span className="flex-1">
                  <div className="text-[12.5px] font-medium">{opt.label}</div>
                  <div className="text-[10.5px] text-ink-45 mt-0.5">{opt.hint}</div>
                </span>
              </button>
            </Row>
          )
        })}
      </Card>

      {needsGroqKey && (
        <Card>
          <Row>
            <div className="flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-45 mb-1.5">
                Groq API Key
              </div>
              <input
                type="password"
                value={settings.provider.groqKey}
                onChange={(e) => save({ groqKey: e.target.value })}
                placeholder="gsk_…"
                className="w-full bg-paper border border-ink-08 rounded-input px-3 py-2 text-[12.5px] font-mono focus:outline-none focus:border-volt focus:ring-2 focus:ring-volt-muted"
              />
              <a
                onClick={() => window.open('https://console.groq.com', '_blank')}
                className="text-[11px] text-ink-45 hover:text-ink mt-2 inline-block cursor-pointer"
              >
                Get a free Groq key ↗
              </a>
            </div>
          </Row>
        </Card>
      )}

      {provider === 'openai' && (
        <Card>
          <Row>
            <div className="flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-45 mb-1.5">
                OpenAI API Key
              </div>
              <input
                type="password"
                value={settings.provider.openaiKey}
                onChange={(e) => save({ openaiKey: e.target.value })}
                placeholder="sk-…"
                className="w-full bg-paper border border-ink-08 rounded-input px-3 py-2 text-[12.5px] font-mono focus:outline-none focus:border-volt focus:ring-2 focus:ring-volt-muted"
              />
            </div>
          </Row>
        </Card>
      )}

      {provider === 'anthropic' && (
        <Card>
          <Row>
            <div className="flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-45 mb-1.5">
                Anthropic API Key
              </div>
              <input
                type="password"
                value={settings.provider.anthropicKey}
                onChange={(e) => save({ anthropicKey: e.target.value })}
                placeholder="sk-ant-…"
                className="w-full bg-paper border border-ink-08 rounded-input px-3 py-2 text-[12.5px] font-mono focus:outline-none focus:border-volt focus:ring-2 focus:ring-volt-muted"
              />
            </div>
          </Row>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Pill variant="primary" onClick={testKey} disabled={testing}>
          {testing ? 'Testing…' : 'Test connection'}
        </Pill>
        {testResult && (
          <span className={`text-[12px] ${testResult.ok ? 'text-ok' : 'text-danger'}`}>
            {testResult.ok ? '✓ Connected' : `✗ ${testResult.error}`}
          </span>
        )}
      </div>
    </div>
  )
}
