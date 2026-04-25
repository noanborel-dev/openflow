// Single source of truth for the paper + electric-blue palette.
// Consumed directly by renderer components AND by tailwind.config.js.
// The `volt` token is kept as an alias of the electric-blue accent so
// existing markup continues to work without a find-and-replace pass.
export const COLORS = {
  paper: '#FAFAF5',
  ink: '#0A0A0A',
  'ink-60': 'rgba(10,10,10,0.6)',
  'ink-45': 'rgba(10,10,10,0.45)',
  'ink-08': 'rgba(10,10,10,0.08)',
  card: '#FFFFFF',
  volt: '#2B7FFF',
  'volt-muted': 'rgba(43,127,255,0.25)',
  'volt-glow': 'rgba(43,127,255,0.6)',
  danger: '#E84A3A',
  ok: '#16A34A',
} as const

export const RADIUS = {
  input: '10px',
  card: '14px',
  pill: '999px',
} as const

export const FONT = {
  sans: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  display:
    '"Cormorant Garamond", "Playfair Display", Georgia, serif',
  mono: '"SF Mono", ui-monospace, "JetBrains Mono", Menlo, monospace',
} as const
