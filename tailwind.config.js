const COLORS = {
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
        'volt-glow': COLORS['volt-glow'],
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
      keyframes: {
        stepIn: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        heroPop: {
          '0%':   { opacity: '0', transform: 'translateY(14px) rotate(-1deg)' },
          '60%':  { opacity: '1' },
          '100%': { opacity: '1', transform: 'translateY(0) rotate(0)' },
        },
        checkPop: {
          '0%':   { opacity: '0', transform: 'scale(0.5)' },
          '60%':  { opacity: '1', transform: 'scale(1.15)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        voltPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(43,127,255,0.0)' },
          '50%':      { boxShadow: '0 0 0 6px rgba(43,127,255,0.18)' },
        },
        bgDrift: {
          '0%':   { transform: 'translate(-10%, -10%) scale(1)' },
          '50%':  { transform: 'translate(10%, 6%) scale(1.15)' },
          '100%': { transform: 'translate(-10%, -10%) scale(1)' },
        },
      },
      animation: {
        stepIn:    'stepIn 380ms cubic-bezier(0.22,1,0.36,1) both',
        heroPop:   'heroPop 700ms cubic-bezier(0.22,1,0.36,1) both',
        checkPop:  'checkPop 380ms cubic-bezier(0.34,1.56,0.64,1) both',
        voltPulse: 'voltPulse 1.6s ease-in-out infinite',
        bgDrift:   'bgDrift 22s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
