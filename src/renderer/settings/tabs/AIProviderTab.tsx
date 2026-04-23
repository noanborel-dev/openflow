import { useEffect, useState } from 'react'
import type { Settings, Provider } from '../../../shared/types'

declare global {
  interface Window {
    openflow: {
      getSettings: () => Promise<Settings>
      setSettings: (p: Partial<Settings>) => Promise<void>
      testProvider: (provider: string, key: string) => Promise<{ ok: boolean; error?: string }>
      getHistory: () => Promise<unknown>
      requestMicPermission: () => Promise<boolean>
      openAccessibilitySettings: () => Promise<void>
      onStateChange: (cb: (state: string) => void) => () => void
    }
  }
}

export default function AIProviderTab() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)

  useEffect(() => {
    window.openflow.getSettings().then(setSettings)
  }, [])

  if (!settings) return <div className="text-white/50 text-sm">Loading…</div>

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

  return (
    <div className="space-y-6 max-w-md">
      <h2 className="text-lg font-semibold">AI Provider</h2>

      <div className="space-y-1.5">
        <label className="text-xs text-white/50 uppercase tracking-wider">Provider</label>
        <select
          value={provider}
          onChange={(e) => save({ provider: e.target.value as Provider })}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="groq">Groq — recommended (fastest, cheapest)</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic (needs Groq key for transcription)</option>
        </select>
      </div>

      {(provider === 'groq' || provider === 'anthropic') && (
        <div className="space-y-1.5">
          <label className="text-xs text-white/50 uppercase tracking-wider">
            Groq API Key{' '}
            <a
              className="normal-case text-blue-400"
              onClick={() => window.open('https://console.groq.com', '_blank')}
              style={{ cursor: 'pointer' }}
            >
              Get free key ↗
            </a>
          </label>
          <input
            type="password"
            value={settings.provider.groqKey}
            onChange={(e) => save({ groqKey: e.target.value })}
            placeholder="gsk_…"
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-white/30"
          />
        </div>
      )}

      {provider === 'openai' && (
        <div className="space-y-1.5">
          <label className="text-xs text-white/50 uppercase tracking-wider">OpenAI API Key</label>
          <input
            type="password"
            value={settings.provider.openaiKey}
            onChange={(e) => save({ openaiKey: e.target.value })}
            placeholder="sk-…"
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-white/30"
          />
        </div>
      )}

      {provider === 'anthropic' && (
        <div className="space-y-1.5">
          <label className="text-xs text-white/50 uppercase tracking-wider">Anthropic API Key</label>
          <input
            type="password"
            value={settings.provider.anthropicKey}
            onChange={(e) => save({ anthropicKey: e.target.value })}
            placeholder="sk-ant-…"
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-white/30"
          />
        </div>
      )}

      <button
        onClick={testKey}
        disabled={testing}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
      >
        {testing ? 'Testing…' : 'Test Connection'}
      </button>

      {testResult && (
        <div
          className={`text-sm p-3 rounded-lg ${
            testResult.ok
              ? 'bg-green-600/20 text-green-400'
              : 'bg-red-600/20 text-red-400'
          }`}
        >
          {testResult.ok ? '✓ Connected successfully' : `✗ ${testResult.error}`}
        </div>
      )}
    </div>
  )
}
