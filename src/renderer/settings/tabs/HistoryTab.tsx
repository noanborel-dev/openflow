import { useEffect, useMemo, useState } from 'react'
import type { DictationResult } from '../../../shared/types'
import { Pill } from '../../shared/ui/Pill'
import { SectionHero } from '../../shared/ui/SectionHero'

export default function HistoryTab() {
  const [items, setItems] = useState<DictationResult[] | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    window.yappr.getAllHistory().then(setItems)
  }, [])

  const filtered = useMemo(() => {
    if (!items) return []
    const q = filter.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (i) =>
        i.cleaned.toLowerCase().includes(q) ||
        i.transcript.toLowerCase().includes(q) ||
        i.appName.toLowerCase().includes(q),
    )
  }, [items, filter])

  const stats = useMemo(() => computeStats(items ?? []), [items])

  async function copy(item: DictationResult) {
    await navigator.clipboard.writeText(item.cleaned)
    setCopiedId(item.id)
    window.setTimeout(() => setCopiedId((id) => (id === item.id ? null : id)), 1200)
  }

  async function clearAll() {
    if (!confirm('Clear all transcription history? This cannot be undone.')) return
    await window.yappr.clearHistory()
    setItems([])
  }

  if (items === null) {
    return <div className="text-ink-45 text-sm">Loading…</div>
  }

  return (
    <div className="max-w-[760px]">
      <SectionHero
        label="DASHBOARD"
        accent="cobalt"
        headline={<>Every <em className="font-display italic">word</em>, kept.</>}
        body="The last 50 dictations are saved locally so you can re-copy what you said and see how you're using Yappr. Stays on this Mac — never synced anywhere."
        visual={<UsageSummary stats={stats} />}
      />

      <QuickFacts stats={stats} />

      <div className="bg-card border border-ink-08 rounded-[14px] px-4 py-4 mb-4 flex items-stretch gap-2">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search transcriptions…"
          className="flex-1 bg-paper border border-ink-08 rounded-[10px] px-3.5 py-2.5 text-[12.5px] focus:outline-none focus:border-volt focus:ring-2 focus:ring-volt-muted"
        />
        {items.length > 0 && (
          <Pill variant="secondary" onClick={clearAll}>
            Clear all
          </Pill>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-[11.5px] text-ink-45 px-2 py-8 text-center">
          No transcriptions yet. Dictations show up here as soon as you make them.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-[11.5px] text-ink-45 px-2 py-8 text-center">
          No matches for &ldquo;{filter}&rdquo;.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((item) => (
            <HistoryItem
              key={item.id}
              item={item}
              copied={copiedId === item.id}
              onCopy={() => copy(item)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryItem({
  item,
  copied,
  onCopy,
}: {
  item: DictationResult
  copied: boolean
  onCopy: () => void
}) {
  const when = formatRelativeTime(item.timestamp)
  return (
    <div className="bg-card border border-ink-08 rounded-[12px] px-4 py-3 flex items-start gap-3 group">
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] leading-relaxed whitespace-pre-wrap break-words">
          {item.cleaned}
        </div>
        <div className="text-[10px] text-ink-45 mt-1.5 flex items-center gap-2 flex-wrap">
          <span>{when}</span>
          <span className="opacity-40">·</span>
          <span>{item.appName}</span>
          <span className="opacity-40">·</span>
          <span className="capitalize">{item.appCategory}</span>
          <span className="opacity-40">·</span>
          <span>{wordCount(item.cleaned)} words</span>
        </div>
      </div>
      <button
        onClick={onCopy}
        aria-label="Copy to clipboard"
        className={`shrink-0 text-[11px] font-medium rounded-[8px] px-2.5 py-1.5 transition-colors border ${
          copied
            ? 'bg-ok/15 text-ok border-ok/30'
            : 'border-ink-08 text-ink-60 hover:text-ink hover:bg-ink-08 opacity-0 group-hover:opacity-100'
        }`}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}

interface Stats {
  total: number
  today: number
  thisWeek: number
  totalWords: number
  totalWordsThisWeek: number
  topApps: Array<{ name: string; count: number }>
  longestDictation: { words: number; preview: string } | null
  busiestHour: { hour: number; count: number } | null
  // Approximate minutes spent dictating, derived from word count at a
  // typical 150 wpm sustained dictation pace.
  approxMinutes: number
  // Consecutive days ending today with at least one dictation.
  streakDays: number
  // Distinct apps used this week.
  appsThisWeek: number
}

function computeStats(items: DictationResult[]): Stats {
  const dayMs = 24 * 60 * 60 * 1000
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const now = Date.now()
  const weekAgo = now - 7 * dayMs

  let today = 0
  let thisWeek = 0
  let totalWords = 0
  let totalWordsThisWeek = 0
  const byApp = new Map<string, number>()
  const appsThisWeekSet = new Set<string>()
  const byHour = new Map<number, number>()
  let longest: { words: number; preview: string } | null = null
  // Track unique days (yyyy-mm-dd in local time) with activity to
  // compute the streak.
  const activeDays = new Set<string>()

  for (const i of items) {
    const words = wordCount(i.cleaned)
    totalWords += words
    if (i.timestamp >= todayStart.getTime()) today++
    if (i.timestamp >= weekAgo) {
      thisWeek++
      totalWordsThisWeek += words
      appsThisWeekSet.add(i.appName)
    }
    byApp.set(i.appName, (byApp.get(i.appName) ?? 0) + 1)

    const d = new Date(i.timestamp)
    byHour.set(d.getHours(), (byHour.get(d.getHours()) ?? 0) + 1)
    activeDays.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)

    if (!longest || words > longest.words) {
      longest = { words, preview: i.cleaned.slice(0, 60) }
    }
  }

  const topApps = [...byApp.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  // Busiest hour: max-count entry from byHour.
  let busiestHour: { hour: number; count: number } | null = null
  for (const [hour, count] of byHour) {
    if (!busiestHour || count > busiestHour.count) busiestHour = { hour, count }
  }

  // Streak: walk back from today, day by day. Stop at the first gap.
  let streakDays = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  while (activeDays.has(`${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`)) {
    streakDays++
    cursor.setTime(cursor.getTime() - dayMs)
  }

  // ~150 wpm is a reasonable spoken-dictation pace.
  const approxMinutes = Math.round(totalWords / 150)

  return {
    total: items.length,
    today,
    thisWeek,
    totalWords,
    totalWordsThisWeek,
    topApps,
    longestDictation: longest,
    busiestHour,
    approxMinutes,
    streakDays,
    appsThisWeek: appsThisWeekSet.size,
  }
}

function UsageSummary({ stats }: { stats: Stats }) {
  const empty = stats.total === 0
  return (
    <div className="w-[320px] bg-white border border-ink-08 rounded-[14px] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-ink-45 font-medium">Lifetime</span>
        <span className="text-[10px] text-ink-45">{stats.total} dictations</span>
      </div>

      {/* Hero number: total words across all kept history. */}
      <div className="bg-paper border border-ink-08 rounded-[12px] px-4 py-3">
        <div className="text-[34px] font-display leading-none tracking-tight">
          {stats.totalWords.toLocaleString()}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-ink-45 mt-1.5 font-medium">
          words spoken {empty ? '— start dictating!' : `· ~${stats.approxMinutes} min of speech`}
        </div>
      </div>

      {/* Three short stat rows. */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Today" value={stats.today} />
        <StatCard label="This week" value={stats.thisWeek} />
        <StatCard label="Streak" value={stats.streakDays} suffix={stats.streakDays === 1 ? 'day' : 'days'} />
      </div>

      {stats.topApps.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-45 font-medium mb-1.5">Top apps</div>
          <div className="flex flex-col gap-1">
            {stats.topApps.map((a) => {
              const pct = Math.round((a.count / stats.total) * 100)
              return (
                <div key={a.name} className="text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-ink truncate">{a.name}</span>
                    <span className="text-ink-45 font-mono ml-2">{a.count}</span>
                  </div>
                  <div className="h-1 bg-ink-08 rounded-full mt-0.5 overflow-hidden">
                    <div
                      className="h-full bg-volt"
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Quick-fact strip — shows playful, derived metrics below the hero so
// the dashboard feels alive rather than just listing transcripts.
function QuickFacts({ stats }: { stats: Stats }) {
  if (stats.total === 0) return null
  const facts: Array<{ label: string; value: string; sub?: string }> = []

  if (stats.totalWordsThisWeek > 0) {
    facts.push({
      label: 'This week',
      value: stats.totalWordsThisWeek.toLocaleString(),
      sub: `words · across ${stats.appsThisWeek} app${stats.appsThisWeek === 1 ? '' : 's'}`,
    })
  }
  if (stats.busiestHour) {
    facts.push({
      label: 'Busiest hour',
      value: formatHour(stats.busiestHour.hour),
      sub: `${stats.busiestHour.count} dictation${stats.busiestHour.count === 1 ? '' : 's'} fired in this hour`,
    })
  }
  if (stats.longestDictation) {
    facts.push({
      label: 'Longest dictation',
      value: `${stats.longestDictation.words}`,
      sub: `words · "${stats.longestDictation.preview}${stats.longestDictation.preview.length >= 60 ? '…' : ''}"`,
    })
  }
  if (stats.approxMinutes > 0) {
    const hours = stats.approxMinutes / 60
    facts.push({
      label: 'Time saved',
      value: hours >= 1 ? `${hours.toFixed(1)}h` : `${stats.approxMinutes}m`,
      sub: 'vs. typing at 40 wpm',
    })
  }

  if (facts.length === 0) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
      {facts.map((f) => (
        <div
          key={f.label}
          className="bg-card border border-ink-08 rounded-[12px] px-3.5 py-3"
        >
          <div className="text-[10px] uppercase tracking-wider text-ink-45 font-medium">{f.label}</div>
          <div className="text-[20px] font-display leading-tight tracking-tight mt-1.5">
            {f.value}
          </div>
          {f.sub && (
            <div className="text-[10px] text-ink-45 mt-1 leading-snug truncate">{f.sub}</div>
          )}
        </div>
      ))}
    </div>
  )
}

function formatHour(h: number): string {
  if (h === 0) return '12 AM'
  if (h === 12) return '12 PM'
  if (h < 12) return `${h} AM`
  return `${h - 12} PM`
}

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string
  value: string | number
  suffix?: string
}) {
  return (
    <div className="bg-paper border border-ink-08 rounded-[10px] px-3 py-2">
      <div className="text-[18px] font-semibold leading-none">
        {value}
        {suffix && <span className="text-[10px] text-ink-45 font-normal ml-1">{suffix}</span>}
      </div>
      <div className="text-[9.5px] uppercase tracking-wider text-ink-45 mt-1">{label}</div>
    </div>
  )
}

function wordCount(s: string): number {
  const trimmed = s.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
