// The OpenFlow wordmark: charcoal pill, red recording dot, italic serif
// "OpenFlow" text. Mirrors the actual indicator pill the user sees in
// the wild, just static (no breathing, no waveform). Four canonical
// sizes so it stays legible from hero down to favicon.

const SIZES = {
  hero:    { px: 30, dot: 9,  padX: 22, padY: 9,  gap: 12 },
  button:  { px: 18, dot: 6,  padX: 14, padY: 6,  gap: 9  },
  inline:  { px: 14, dot: 5,  padX: 10, padY: 4.5,gap: 7  },
  favicon: { px: 11, dot: 4,  padX: 8,  padY: 3.5,gap: 5  },
} as const

type Size = keyof typeof SIZES

interface Props {
  size?: Size
  /** Hide the recording dot — useful for read-only contexts where the
      dot reads as a typo rather than a brand cue. */
  withoutDot?: boolean
}

export function Wordmark({ size = 'button', withoutDot }: Props) {
  const s = SIZES[size]
  return (
    <span
      className="inline-flex items-center rounded-pill text-white relative"
      style={{
        background: 'linear-gradient(180deg, #0E1018 0%, #08090E 100%)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.18), ' +
          'inset 0 -1px 0 rgba(0,0,0,0.45), ' +
          '0 1px 2px rgba(0,0,0,0.12)',
        padding: `${s.padY}px ${s.padX}px`,
        gap: `${s.gap}px`,
      }}
    >
      {!withoutDot && (
        <span
          aria-hidden
          className="rounded-full shrink-0"
          style={{
            width: s.dot,
            height: s.dot,
            background: '#E84A3A',
            boxShadow: `0 0 ${Math.max(2, s.dot - 2)}px rgba(232,74,58,0.55)`,
          }}
        />
      )}
      <span
        className="leading-none"
        style={{
          fontFamily: '"Instrument Serif", "Cormorant Garamond", Georgia, serif',
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: s.px,
          letterSpacing: '-0.005em',
          textShadow: '0 1px 2px rgba(0,0,0,0.35)',
        }}
      >
        OpenFlow
      </span>
    </span>
  )
}
