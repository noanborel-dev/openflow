import type { ReactNode } from 'react'

// Section accent palette — each settings tab has its own subtle accent
// color used for the eyebrow label and decorative gradients in the hero.
// Picked to harmonize with the cream paper aesthetic without screaming.
export const SECTION_COLORS = {
  green:  { eyebrow: '#3D7E3D', bg: 'rgba(61, 126, 61, 0.06)' },
  violet: { eyebrow: '#6B46C1', bg: 'rgba(107, 70, 193, 0.06)' },
  coral:  { eyebrow: '#C94A2A', bg: 'rgba(201, 74, 42, 0.06)' },
  cobalt: { eyebrow: '#2B7FFF', bg: 'rgba(43, 127, 255, 0.06)' },
} as const

export type SectionAccent = keyof typeof SECTION_COLORS

interface Props {
  number: string         // "01"
  label: string          // "POLISH"
  accent: SectionAccent
  headline: ReactNode    // can include <span class="italic">…</span>
  body: ReactNode
  visual?: ReactNode     // right-side illustration / preview
}

export function SectionHero({ number, label, accent, headline, body, visual }: Props) {
  const c = SECTION_COLORS[accent]
  return (
    <div
      className="relative bg-card border border-ink-08 rounded-[16px] overflow-hidden mb-5"
      style={{
        backgroundImage:
          `radial-gradient(circle at 0% 0%, ${c.bg}, transparent 55%), ` +
          `radial-gradient(circle at 100% 100%, ${c.bg}, transparent 60%)`,
      }}
    >
      <div className="grid gap-7 px-7 py-7" style={{ gridTemplateColumns: visual ? '1.05fr 1fr' : '1fr' }}>
        <div>
          <div
            className="text-[10.5px] font-mono uppercase tracking-[0.18em] mb-3"
            style={{ color: c.eyebrow }}
          >
            <span className="opacity-70">{number}</span>{'  ·  '}{label}
          </div>
          <h2 className="font-display text-[30px] leading-[1.1] tracking-tight mb-3 text-ink">
            {headline}
          </h2>
          <p className="text-[12.5px] text-ink-60 leading-relaxed max-w-[42ch]">
            {body}
          </p>
        </div>
        {visual && (
          <div className="flex items-center justify-center">
            {visual}
          </div>
        )}
      </div>
    </div>
  )
}
