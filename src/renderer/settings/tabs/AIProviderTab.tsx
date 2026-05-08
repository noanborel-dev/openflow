import { useEffect, useState } from 'react'
import { siAnthropic } from 'simple-icons'
import type { Settings, Provider } from '../../../shared/types'
import { MODELS } from '../../../shared/constants'
import { Pill } from '../../shared/ui/Pill'
import { SectionHero } from '../../shared/ui/SectionHero'

interface BrandRef { title: string; hex: string; path: string }

function BrandIcon({ icon, size = 20, fill }: { icon: BrandRef; size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label={icon.title}>
      <path d={icon.path} fill={fill ?? `#${icon.hex}`} />
    </svg>
  )
}

interface ProviderInfo {
  value: Provider
  brand: 'openai' | 'anthropic' | 'groq'
  name: string
  model: string
  description: string
  price: string
}

const PROVIDERS: ProviderInfo[] = [
  { value: 'groq',      brand: 'groq',      name: 'Groq',      model: 'whisper-large-v3-turbo', description: 'Fastest cloud Whisper. Free tier covers most users.', price: 'free tier' },
  { value: 'openai',    brand: 'openai',    name: 'OpenAI',    model: 'whisper-1',    description: 'Industry-standard. Fast, accurate, cheap.',         price: '$0.006/min' },
  { value: 'anthropic', brand: 'anthropic', name: 'Anthropic', model: 'claude-haiku', description: 'Best for cleanup and rewriting (uses Groq for transcription).', price: '$0.004/min' },
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

  // Which key field to show under the cards. Anthropic still needs the
  // Groq key for transcription, so we surface both rather than hide one.
  const keyField = (() => {
    if (provider === 'openai') return { name: 'OpenAI', value: settings.provider.openaiKey, set: (v: string) => save({ openaiKey: v }), placeholder: 'sk-…', help: 'platform.openai.com/api-keys' }
    if (provider === 'anthropic') return { name: 'Anthropic', value: settings.provider.anthropicKey, set: (v: string) => save({ anthropicKey: v }), placeholder: 'sk-ant-…', help: 'console.anthropic.com' }
    return { name: 'Groq', value: settings.provider.groqKey, set: (v: string) => save({ groqKey: v }), placeholder: 'gsk_…', help: 'console.groq.com' }
  })()

  return (
    <div className="max-w-[760px]">
      <SectionHero
        number="03"
        label="PROVIDER"
        accent="coral"
        headline={<>Audio goes <em className="font-display italic">straight</em> through.</>}
        body="Bring your own keys. OpenFlow never proxies — your audio goes straight to your provider. Keys live in macOS Keychain (eventually) and are never sent to OpenFlow servers."
        visual={<AudioFlowDiagram apiKeyMasked={maskKey(keyField.value)} />}
      />

      {/* Provider cards */}
      <div className="space-y-2.5 mb-5">
        {PROVIDERS.map((p) => {
          const selected = p.value === provider
          return (
            <button
              key={p.value}
              onClick={() => save({
                provider: p.value,
                transcriptionModel: MODELS[p.value].transcription,
                cleanupModel: MODELS[p.value].cleanup,
              })}
              className={[
                'w-full text-left bg-card border rounded-[14px] px-4 py-3.5 transition-all duration-150',
                selected
                  ? 'border-ink ring-1 ring-ink shadow-sm'
                  : 'border-ink-08 hover:border-ink-45',
              ].join(' ')}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
                     style={{ background: brandTileColor(p.brand) }}>
                  <ProviderGlyph brand={p.brand} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13.5px] font-semibold">{p.name}</span>
                    <span className="text-[10.5px] font-mono text-ink-45">{p.model}</span>
                  </div>
                  <div className="text-[11px] text-ink-60 mt-0.5">{p.description}</div>
                </div>
                <span className="text-[11px] font-mono text-ink-45 mr-2">{p.price}</span>
                <span className={[
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                  selected ? 'bg-ink border-ink' : 'border-ink-08',
                ].join(' ')}>
                  {selected && <span className="w-2 h-2 rounded-full bg-paper" />}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* API key field */}
      <div className="bg-card border border-ink-08 rounded-[14px] px-4 py-4">
        <div className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-ink-45 mb-2">
          {keyField.name} API Key
        </div>
        <div className="flex items-stretch gap-2">
          <input
            type="password"
            value={keyField.value}
            onChange={(e) => keyField.set(e.target.value)}
            placeholder={keyField.placeholder}
            className="flex-1 bg-paper border border-ink-08 rounded-[10px] px-3 py-2.5 text-[12.5px] font-mono focus:outline-none focus:border-volt focus:ring-2 focus:ring-volt-muted"
          />
          <Pill variant="primary" onClick={testKey} disabled={testing || !keyField.value}>
            {testing ? '…' : 'Test'}
          </Pill>
        </div>
        <div className="flex items-center justify-between mt-2.5">
          <a
            onClick={() => window.open(`https://${keyField.help}`, '_blank')}
            className="text-[10.5px] text-ink-45 hover:text-ink cursor-pointer"
          >
            Get a key at {keyField.help} ↗
          </a>
          {testResult && (
            <span className={`text-[11px] font-medium ${testResult.ok ? 'text-ok' : 'text-danger'}`}>
              {testResult.ok ? '✓ Connected' : `✗ ${testResult.error}`}
            </span>
          )}
        </div>
      </div>

      <p className="text-[10.5px] text-ink-45 mt-4 leading-relaxed">
        Stored locally. Never sent to OpenFlow servers.
      </p>
    </div>
  )
}

// Visual diagram in the hero — recording pill → key. Stylized to evoke
// the data-flow story without rendering the actual indicator.
function AudioFlowDiagram({ apiKeyMasked }: { apiKeyMasked: string }) {
  return (
    <div className="flex items-center gap-3 w-full max-w-[300px]">
      {/* tiny pill mock */}
      <div className="bg-[#0E1018] rounded-pill px-3 py-2 inline-flex items-center gap-2 shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-[#E84A3A]" />
        <div className="flex items-end gap-[2px] h-[12px]">
          <span className="w-[2px] h-2 rounded bg-[#5A8FE8]" />
          <span className="w-[2px] h-3 rounded bg-[#5A8FE8]" />
          <span className="w-[2px] h-[8px] rounded bg-[#5A8FE8]" />
          <span className="w-[2px] h-[10px] rounded bg-[#5A8FE8]" />
          <span className="w-[2px] h-[6px] rounded bg-[#5A8FE8]" />
        </div>
      </div>
      <span className="text-ink-45">→</span>
      <div className="flex-1 bg-[#0E1018] rounded-[8px] px-2.5 py-2 font-mono text-[10.5px] text-[#3D7E3D] truncate flex items-center gap-1.5">
        <span className="text-ink-45">$</span>
        <span className="truncate">{apiKeyMasked || 'sk-proj-aB3x••••••••sUgM'}</span>
        <span className="text-[#3D7E3D] shrink-0">✓</span>
      </div>
    </div>
  )
}

function ProviderGlyph({ brand }: { brand: 'openai' | 'anthropic' | 'groq' }) {
  if (brand === 'anthropic') return <BrandIcon icon={siAnthropic as BrandRef} fill="#fff" />
  // OpenAI and Groq aren't in simple-icons (trademark removals). Stylized
  // monogram marks keep the row consistent without a missing-icon hole.
  if (brand === 'openai') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2.4c-.95 0-1.85.22-2.65.61a4.78 4.78 0 0 0-3.7 6.4 4.78 4.78 0 0 0 0 6.18 4.78 4.78 0 0 0 3.7 6.4 4.78 4.78 0 0 0 6.18 1.42 4.78 4.78 0 0 0 6.4-3.7 4.78 4.78 0 0 0 0-6.18 4.78 4.78 0 0 0-3.7-6.4A4.78 4.78 0 0 0 12 2.4Z"
          stroke="#fff" strokeWidth="1.4" fill="none"/>
      </svg>
    )
  }
  return <span className="text-[15px] font-bold text-white" style={{ fontFamily: 'system-ui' }}>G</span>
}

function brandTileColor(brand: 'openai' | 'anthropic' | 'groq'): string {
  if (brand === 'openai')    return '#0F1011'
  if (brand === 'anthropic') return '#D97757'
  return '#F55036' // Groq orange
}

function maskKey(k: string): string {
  if (!k) return ''
  if (k.length <= 12) return k.replace(/./g, '•')
  return `${k.slice(0, 8)}${'•'.repeat(8)}${k.slice(-4)}`
}
