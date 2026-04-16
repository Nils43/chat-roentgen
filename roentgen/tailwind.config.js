/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0d10',
          raised: '#12171c',
          surface: '#1a2028',
        },
        ink: {
          DEFAULT: '#f5f2ea',
          muted: '#8b95a1',
          faint: '#4a5561',
        },
        // Person A: kühles Mint — Analyse, Monitor
        a: {
          DEFAULT: '#7fe0c4',
          dim: '#4ba893',
          deep: '#1f4a3f',
          glow: '#7fe0c433',
        },
        // Person B: warmes Korall — emotional
        b: {
          DEFAULT: '#ff9a8b',
          dim: '#c77565',
          deep: '#5c2d25',
          glow: '#ff9a8b33',
        },
        line: '#2a323c',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        serif: ['"Instrument Serif"', '"Newsreader"', 'Georgia', 'serif'],
        sans: ['"Space Grotesk"', '"Inter"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'count-up': 'countUp 0.6s ease-out',
        'fade-in': 'fadeIn 0.8s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'pulse-soft': 'pulseSoft 2.5s ease-in-out infinite',
      },
      keyframes: {
        countUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
