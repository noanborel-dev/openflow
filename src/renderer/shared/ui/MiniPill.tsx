// Faithful miniature of the actual OpenFlow indicator pill — charcoal
// liquid-glass background with the refractive top edge, red recording
// dot with glow, animated cobalt waveform bars, italic-serif state
// label. Used inside per-app mockups across the Settings tabs so users
// see what the pill looks like in context.

interface Props {
  state?: 'listening' | 'polishing' | 'done'
  /** Label override (default matches state). Used for "pasted" vs "done". */
  label?: string
}

export function MiniPill({ state = 'listening', label }: Props) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-pill text-white"
      style={{
        background: 'linear-gradient(180deg, rgba(18,20,26,0.92) 0%, rgba(14,16,22,0.88) 100%)',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.36), inset 0 -1px 0 rgba(0,0,0,0.4), ' +
          '0 6px 14px -6px rgba(0,0,0,0.55)',
      }}
    >
      <style>{`
        @keyframes mini-bar1 { 0%,100% { height: 4px; } 50% { height: 9px; } }
        @keyframes mini-bar2 { 0%,100% { height: 7px; } 50% { height: 2px; } }
        @keyframes mini-bar3 { 0%,100% { height: 9px; } 50% { height: 5px; } }
        @keyframes mini-bar4 { 0%,100% { height: 3px; } 50% { height: 8px; } }
        @keyframes mini-bar5 { 0%,100% { height: 6px; } 50% { height: 2px; } }
        .mini-pill-bar-1 { animation: mini-bar1 0.7s ease-in-out infinite; }
        .mini-pill-bar-2 { animation: mini-bar2 0.6s ease-in-out infinite; }
        .mini-pill-bar-3 { animation: mini-bar3 0.55s ease-in-out infinite; }
        .mini-pill-bar-4 { animation: mini-bar4 0.65s ease-in-out infinite; }
        .mini-pill-bar-5 { animation: mini-bar5 0.5s ease-in-out infinite; }
      `}</style>
      {state === 'listening' ? (
        <>
          <span
            className="w-1.5 h-1.5 rounded-full bg-[#E84A3A]"
            style={{ boxShadow: '0 0 6px rgba(232,74,58,0.7)' }}
          />
          <div className="flex items-end gap-[1.5px] h-2.5">
            <span className="mini-pill-bar-1 w-[1.5px] rounded-[0.5px] bg-[#5A8FE8]" />
            <span className="mini-pill-bar-2 w-[1.5px] rounded-[0.5px] bg-[#5A8FE8]" />
            <span className="mini-pill-bar-3 w-[1.5px] rounded-[0.5px] bg-[#5A8FE8]" />
            <span className="mini-pill-bar-4 w-[1.5px] rounded-[0.5px] bg-[#5A8FE8]" />
            <span className="mini-pill-bar-5 w-[1.5px] rounded-[0.5px] bg-[#5A8FE8]" />
          </div>
        </>
      ) : state === 'done' ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
          <svg width="10" height="10" viewBox="0 0 11 11" fill="none">
            <path d="M2 5.5L4.5 8L9 3" stroke="#5A8FE8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </>
      ) : (
        <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-white/30 border-t-[#5A8FE8] animate-spin" />
      )}
      <span
        className="text-[10px] leading-none ml-0.5"
        style={{
          fontStyle: 'italic',
          fontFamily: '"Instrument Serif", Georgia, serif',
          color: state === 'done' ? '#5A8FE8' : undefined,
        }}
      >
        {label ?? (state === 'done' ? 'pasted' : state)}
      </span>
    </div>
  )
}
