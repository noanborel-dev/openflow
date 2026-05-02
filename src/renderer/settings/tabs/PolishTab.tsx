import { useEffect, useState } from 'react'
import { siGmail, siImessage, siNotion } from 'simple-icons'
import type { CategoryStrictness, Settings, Strictness } from '../../../shared/types'
import { Card, Row } from '../../shared/ui/Card'

interface BrandRef { title: string; hex: string; path: string }

function BrandIcon({ icon, size = 20 }: { icon: BrandRef; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label={icon.title}>
      <path d={icon.path} fill={`#${icon.hex}`} />
    </svg>
  )
}

type Bucket = keyof CategoryStrictness

const META: Record<Bucket, { title: string; sub: string; icon: BrandRef }> = {
  personal: {
    title: 'Personal messaging',
    sub: 'iMessage · WhatsApp · Telegram',
    icon: siImessage as BrandRef,
  },
  work: {
    title: 'Work messaging',
    sub: 'Slack · Discord · Gmail · Outlook',
    icon: siGmail as BrandRef,
  },
  writing: {
    title: 'Writing & AI',
    sub: 'Notion · Google Docs · Claude · ChatGPT',
    icon: siNotion as BrandRef,
  },
}

const LEVEL_LABEL: Record<Strictness, string> = { 1: 'Light', 2: 'Balanced', 3: 'Strict' }
const LEVEL_BLURB: Record<Strictness, string> = {
  1: 'Strip filler. Keep your voice.',
  2: 'Polish wording. Drop verbal padding.',
  3: 'Restructure into clean prose.',
}
const ORDER: Bucket[] = ['personal', 'work', 'writing']

export default function PolishTab() {
  const [strictness, setStrictness] = useState<CategoryStrictness | null>(null)

  useEffect(() => {
    window.openflow.getSettings().then((s: Settings) => setStrictness(s.strictness))
  }, [])

  function setLevel(bucket: Bucket, lvl: Strictness) {
    if (!strictness) return
    const next = { ...strictness, [bucket]: lvl }
    setStrictness(next)
    window.openflow.setSettings({ strictness: next })
  }

  if (!strictness) return <div className="text-ink-45 text-sm">Loading…</div>

  return (
    <div className="max-w-[520px] space-y-4">
      <p className="text-[12px] text-ink-60 leading-relaxed">
        Pick how aggressively OpenFlow rewrites your dictation in each context.
        Code/terminal apps always stay faithful — words are never dropped there.
      </p>

      <Card>
        {ORDER.map((bucket, i) => {
          const meta = META[bucket]
          const current = strictness[bucket]
          return (
            <Row key={bucket} className={i === ORDER.length - 1 ? '!border-b-0' : ''}>
              <div className="w-7 flex justify-center shrink-0">
                <BrandIcon icon={meta.icon} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold leading-tight">{meta.title}</div>
                <div className="text-[10.5px] text-ink-45 mt-0.5">{meta.sub}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                {([1, 2, 3] as Strictness[]).map((lvl) => {
                  const selected = current === lvl
                  return (
                    <button
                      key={lvl}
                      onClick={() => setLevel(bucket, lvl)}
                      title={LEVEL_BLURB[lvl]}
                      className={[
                        'px-2.5 py-1 rounded-pill text-[11px] font-medium transition-all duration-150',
                        selected
                          ? 'bg-ink text-paper'
                          : 'text-ink-60 hover:text-ink',
                      ].join(' ')}
                    >
                      {LEVEL_LABEL[lvl]}
                    </button>
                  )
                })}
              </div>
            </Row>
          )
        })}
      </Card>
    </div>
  )
}
