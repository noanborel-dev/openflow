const COLORS = {
  paper: '#FAFAF5',
  ink: '#0A0A0A',
  'ink-60': 'rgba(10,10,10,0.6)',
  'ink-45': 'rgba(10,10,10,0.45)',
  'ink-08': 'rgba(10,10,10,0.08)',
  card: '#FFFFFF',
  volt: '#D4FF3D',
  'volt-muted': 'rgba(212,255,61,0.25)',
  danger: '#E84A3A',
  ok: '#16A34A',
}
const RADIUS = { input: '10px', card: '14px', pill: '999px' }
const FONT = {
  sans: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  display: '"Cormorant Garamond", "Playfair Display", Georgia, serif',
  mono: '"SF Mono", ui-monospace, "JetBrains Mono", Menlo, monospace',
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        paper: COLORS.paper,
        ink: COLORS.ink,
        'ink-60': COLORS['ink-60'],
        'ink-45': COLORS['ink-45'],
        'ink-08': COLORS['ink-08'],
        card: COLORS.card,
        volt: COLORS.volt,
        'volt-muted': COLORS['volt-muted'],
        danger: COLORS.danger,
        ok: COLORS.ok,
      },
      borderRadius: {
        input: RADIUS.input,
        card: RADIUS.card,
        pill: RADIUS.pill,
      },
      fontFamily: {
        sans: [FONT.sans],
        display: [FONT.display],
        mono: [FONT.mono],
      },
    },
  },
  plugins: [],
}
