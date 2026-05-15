import { useEffect, useState } from 'react'
import { BrandLogo } from '../../shared/ui/BrandLogo'
import type { Settings, Provider, LocalModelId } from '../../../shared/types'
import type { LocalModelProgress, LocalModelReadiness } from '../../global'
import { MODELS } from '../../../shared/constants'
import { Pill } from '../../shared/ui/Pill'
import { SectionHero } from '../../shared/ui/SectionHero'

interface LocalModelMeta {
  id: LocalModelId
  name: string
  speed: string
  size: string
  description: string
  recommended?: boolean
}

const LOCAL_MODEL_META: LocalModelMeta[] = [
  { id: 'base',            name: 'Fast',     speed: '~100 ms', size: '57 MB',  description: 'Tiny + ultra-fast. Multilingual. Some mistakes on technical terms.' },
  { id: 'small',           name: 'Balanced', speed: '~200 ms', size: '181 MB', description: 'Sub-300ms warm. Multilingual. Near-perfect for English dictation.', recommended: true },
  { id: 'large-v3-turbo',  name: 'Accurate', speed: '~1000 ms', size: '547 MB', description: 'Highest accuracy on non-English and technical terms. Slower.' },
]

interface ProviderInfo {
  value: Provider
  brand: 'openai' | 'anthropic' | 'groq' | 'local'
  name: string
  model: string
  description: string
  price: string
}

const PROVIDERS: ProviderInfo[] = [
  { value: 'local',     brand: 'local',     name: 'Local',     model: 'whisper-large-v3-turbo (on-device)', description: 'Runs on your Mac. Offline, free, no keys. ~547MB download.', price: 'free, offline' },
  { value: 'groq',      brand: 'groq',      name: 'Groq',      model: 'whisper-large-v3-turbo', description: 'Fastest cloud Whisper. Free tier covers most users.', price: 'free tier' },
  { value: 'openai',    brand: 'openai',    name: 'OpenAI',    model: 'whisper-1',    description: 'Industry-standard. Fast, accurate, cheap.',         price: '$0.006/min' },
  { value: 'anthropic', brand: 'anthropic', name: 'Anthropic', model: 'claude-haiku', description: 'Best for cleanup and rewriting (uses Groq for transcription).', price: '$0.004/min' },
]

export default function AIProviderTab() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [localReadiness, setLocalReadiness] = useState<LocalModelReadiness | null>(null)
  // Per-model download progress, keyed by model id. Each card looks up
  // its own state.
  const [localProgress, setLocalProgress] = useState<Record<string, LocalModelProgress>>({})
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({})

  function refreshStatus() {
    window.openflow.getLocalModelStatus().then((s) => {
      setLocalReadiness(s.readiness)
      setDownloaded(s.downloaded)
      const seed: Record<string, LocalModelProgress> = {}
      for (const p of s.progress) seed[p.modelId] = p
      setLocalProgress(seed)
    })
  }

  useEffect(() => {
    window.openflow.getSettings().then(setSettings)
    refreshStatus()
    const off = window.openflow.onLocalModelProgress((p) => {
      setLocalProgress((prev) => ({ ...prev, [p.modelId]: p }))
      if (p.status === 'done') {
        refreshStatus()
      }
    })
    return off
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
  // For Local, the key block is replaced by the model-management block
  // below (no cloud key needed for transcription, though Local still
  // delegates cleanup to whichever cloud key is configured).
  const keyField = (() => {
    if (provider === 'openai') return { name: 'OpenAI', value: settings.provider.openaiKey, set: (v: string) => save({ openaiKey: v }), placeholder: 'sk-…', help: 'platform.openai.com/api-keys' }
    if (provider === 'anthropic') return { name: 'Anthropic', value: settings.provider.anthropicKey, set: (v: string) => save({ anthropicKey: v }), placeholder: 'sk-ant-…', help: 'console.anthropic.com' }
    return { name: 'Groq', value: settings.provider.groqKey, set: (v: string) => save({ groqKey: v }), placeholder: 'gsk_…', help: 'console.groq.com' }
  })()

  return (
    <div className="max-w-[760px]">
      <SectionHero
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

      {provider === 'local' ? (
        <LocalModelPanel
          readiness={localReadiness}
          progress={localProgress}
          downloaded={downloaded}
          selectedModel={settings.provider.localModel}
          onSelectModel={(id) => save({ localModel: id })}
        />
      ) : (
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
      )}

      <p className="text-[10.5px] text-ink-45 mt-4 leading-relaxed">
        {provider === 'local'
          ? 'Audio never leaves your device. The model is stored in your user-data folder.'
          : 'Stored locally. Never sent to OpenFlow servers.'}
      </p>
    </div>
  )
}

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(0)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function LocalModelPanel({
  readiness,
  progress,
  downloaded,
  selectedModel,
  onSelectModel,
}: {
  readiness: LocalModelReadiness | null
  progress: Record<string, LocalModelProgress>
  downloaded: Record<string, boolean>
  selectedModel: LocalModelId
  onSelectModel: (id: LocalModelId) => void
}) {
  if (!readiness) {
    return <div className="bg-card border border-ink-08 rounded-[14px] px-4 py-4 text-[11px] text-ink-45">Loading model status…</div>
  }

  if (!readiness.ffmpeg) {
    return (
      <div className="bg-card border border-danger/40 rounded-[14px] px-4 py-4">
        <div className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-danger mb-1">ffmpeg not found</div>
        <p className="text-[11.5px] text-ink-60 leading-relaxed">
          Run <code className="font-mono">npm install</code> to pull <code className="font-mono">ffmpeg-static</code>, or reinstall OpenFlow.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-ink-45 mb-1">
        Local model · pick one
      </div>
      {LOCAL_MODEL_META.map((m) => (
        <LocalModelCard
          key={m.id}
          meta={m}
          selected={selectedModel === m.id}
          downloaded={!!downloaded[m.id]}
          progress={progress[m.id]}
          onSelect={() => onSelectModel(m.id)}
        />
      ))}
    </div>
  )
}

function LocalModelCard({
  meta,
  selected,
  downloaded,
  progress,
  onSelect,
}: {
  meta: LocalModelMeta
  selected: boolean
  downloaded: boolean
  progress: LocalModelProgress | undefined
  onSelect: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const downloading = progress?.status === 'starting' || progress?.status === 'downloading'
  const pct = (downloading && progress!.totalBytes > 0)
    ? Math.min(100, (progress!.receivedBytes / progress!.totalBytes) * 100)
    : 0

  async function startDownload(e: React.MouseEvent) {
    e.stopPropagation()
    setBusy(true)
    setError(null)
    const result = await window.openflow.downloadLocalModel(meta.id)
    setBusy(false)
    if (!result.ok) setError(result.error ?? 'Download failed')
  }

  async function uninstall(e: React.MouseEvent) {
    e.stopPropagation()
    setBusy(true)
    setError(null)
    await window.openflow.uninstallLocalModel(meta.id)
    setBusy(false)
  }

  function cancel(e: React.MouseEvent) {
    e.stopPropagation()
    window.openflow.cancelLocalModel()
  }

  // The whole card is clickable when downloaded — pick this model.
  // When not downloaded, clicking the card body is a no-op (the
  // Download button does the work). We use a <div> with role/onClick
  // rather than a <button> because a disabled <button> would swallow
  // child click events too, blocking the Download Pill inside.
  const canSelect = downloaded
  return (
    <div
      role={canSelect ? 'button' : undefined}
      tabIndex={canSelect ? 0 : -1}
      onClick={canSelect ? onSelect : undefined}
      onKeyDown={canSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') onSelect() } : undefined}
      className={[
        'w-full text-left bg-card border rounded-[14px] px-4 py-3.5 transition-all duration-150',
        selected
          ? 'border-ink ring-1 ring-ink shadow-sm'
          : canSelect
            ? 'border-ink-08 hover:border-ink-45 cursor-pointer'
            : 'border-ink-08',
      ].join(' ')}
    >
      <div className="flex items-center gap-3.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[13.5px] font-semibold">{meta.name}</span>
            <span className="text-[10.5px] font-mono text-ink-45">{meta.id}</span>
            {meta.recommended && (
              <span className="text-[9.5px] font-mono uppercase tracking-wider text-volt bg-volt-muted px-1.5 py-0.5 rounded">
                recommended
              </span>
            )}
          </div>
          <div className="text-[11px] text-ink-60 mt-0.5">{meta.description}</div>
          <div className="text-[10.5px] font-mono text-ink-45 mt-1.5">
            {meta.speed} · {meta.size}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {downloading ? (
            <>
              <div className="text-[10.5px] font-mono text-ink-45">{pct.toFixed(0)}%</div>
              <Pill onClick={cancel}>Cancel</Pill>
            </>
          ) : downloaded ? (
            <>
              {selected && <span className="text-[10.5px] font-mono text-ok">✓ active</span>}
              <Pill onClick={uninstall} disabled={busy}>
                {busy ? '…' : 'Uninstall'}
              </Pill>
            </>
          ) : (
            <Pill variant="primary" onClick={startDownload} disabled={busy}>
              {busy ? '…' : 'Download'}
            </Pill>
          )}
        </div>
        <span className={[
          'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
          selected ? 'bg-ink border-ink' : 'border-ink-08',
        ].join(' ')}>
          {selected && <span className="w-2 h-2 rounded-full bg-paper" />}
        </span>
      </div>
      {downloading && (
        <div className="h-1.5 bg-ink-08 rounded-full overflow-hidden mt-3">
          <div className="h-full bg-volt transition-[width] duration-200" style={{ width: `${pct}%` }} />
        </div>
      )}
      {error && (
        <p className="text-[11px] text-danger mt-2.5">✗ {error}</p>
      )}
    </div>
  )
}

// Visual diagram in the hero — recording pill → key. Stylized to evoke
// the data-flow story without rendering the actual indicator.
function AudioFlowDiagram({ apiKeyMasked }: { apiKeyMasked: string }) {
  return (
    <div className="flex items-center gap-3 w-full max-w-[300px]">
      <BrandPill />
      <span className="text-ink-45">→</span>
      <div className="flex-1 bg-[#0E1018] rounded-[8px] px-2.5 py-2 font-mono text-[10.5px] text-[#3D7E3D] truncate flex items-center gap-1.5">
        <span className="text-ink-45">$</span>
        <span className="truncate">{apiKeyMasked || 'sk-proj-aB3x••••••••sUgM'}</span>
        <span className="text-[#3D7E3D] shrink-0">✓</span>
      </div>
    </div>
  )
}

// The OpenFlow brand pill — same design as the tray-icon SVG
// (scripts/generate-tray-icon.sh). Charcoal liquid-glass gradient,
// red recording dot with halo, six cobalt waveform bars. No label.
// Rendered as inline SVG so it crisp at any size.
function BrandPill() {
  return (
    <svg viewBox="0 0 54 22" width="108" height="44" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' }}>
      <defs>
        <linearGradient id="bp-pill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#12141a"/>
          <stop offset="100%" stopColor="#0e1016"/>
        </linearGradient>
        <linearGradient id="bp-hi" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.34"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
        </linearGradient>
        <radialGradient id="bp-glow" cx="11" cy="11" r="7" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#e84a3a" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#e84a3a" stopOpacity="0"/>
        </radialGradient>
        <clipPath id="bp-clip">
          <rect x="0" y="0" width="54" height="22" rx="11"/>
        </clipPath>
      </defs>
      <rect x="0" y="0" width="54" height="22" rx="11" fill="url(#bp-pill)"/>
      <g clipPath="url(#bp-clip)">
        <rect x="0" y="0" width="54" height="12" fill="url(#bp-hi)"/>
      </g>
      <rect x="0.3" y="0.3" width="53.4" height="21.4" rx="10.7" fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="0.4"/>
      <circle cx="11" cy="11" r="7" fill="url(#bp-glow)"/>
      <circle cx="11" cy="11" r="3.0" fill="#e84a3a"/>
      <rect x="22"   y="7"   width="1.8" height="8"  rx="0.9" fill="#5a8fe8"/>
      <rect x="26.5" y="3"   width="1.8" height="16" rx="0.9" fill="#5a8fe8"/>
      <rect x="31"   y="9"   width="1.8" height="4"  rx="0.9" fill="#5a8fe8"/>
      <rect x="35.5" y="5"   width="1.8" height="12" rx="0.9" fill="#5a8fe8"/>
      <rect x="40"   y="7"   width="1.8" height="8"  rx="0.9" fill="#5a8fe8"/>
      <rect x="44.5" y="8.5" width="1.8" height="5"  rx="0.9" fill="#5a8fe8"/>
    </svg>
  )
}

function ProviderGlyph({ brand }: { brand: 'openai' | 'anthropic' | 'groq' | 'local' }) {
  if (brand === 'anthropic') return <BrandLogo brand="claude" size={22} />
  // OpenAI and Groq aren't in our brand-asset folder yet — stylized
  // monogram marks keep the provider row consistent without a hole.
  if (brand === 'openai') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2.4c-.95 0-1.85.22-2.65.61a4.78 4.78 0 0 0-3.7 6.4 4.78 4.78 0 0 0 0 6.18 4.78 4.78 0 0 0 3.7 6.4 4.78 4.78 0 0 0 6.18 1.42 4.78 4.78 0 0 0 6.4-3.7 4.78 4.78 0 0 0 0-6.18 4.78 4.78 0 0 0-3.7-6.4A4.78 4.78 0 0 0 12 2.4Z"
          stroke="#fff" strokeWidth="1.4" fill="none"/>
      </svg>
    )
  }
  if (brand === 'local') {
    // Stylized chip icon — evokes on-device compute.
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="6" y="6" width="12" height="12" rx="1.5" stroke="#fff" strokeWidth="1.4"/>
        <rect x="9" y="9" width="6" height="6" fill="#fff" opacity="0.9"/>
        <path d="M3 9h2M3 12h2M3 15h2M19 9h2M19 12h2M19 15h2M9 3v2M12 3v2M15 3v2M9 19v2M12 19v2M15 19v2" stroke="#fff" strokeWidth="1.2"/>
      </svg>
    )
  }
  return <span className="text-[15px] font-bold text-white" style={{ fontFamily: 'system-ui' }}>G</span>
}

function brandTileColor(brand: 'openai' | 'anthropic' | 'groq' | 'local'): string {
  if (brand === 'openai')    return '#0F1011'
  if (brand === 'anthropic') return '#D97757'
  if (brand === 'local')     return '#1B2233' // deep navy — "your machine"
  return '#F55036' // Groq orange
}

function maskKey(k: string): string {
  if (!k) return ''
  if (k.length <= 12) return k.replace(/./g, '•')
  return `${k.slice(0, 8)}${'•'.repeat(8)}${k.slice(-4)}`
}
