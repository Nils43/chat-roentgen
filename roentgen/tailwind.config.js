/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Bubblegum Pink base — receipts edition
        bg: {
          DEFAULT: '#FF90BB',
          raised: '#FFFFFF',
          surface: '#FFFFFF',
        },
        ink: {
          DEFAULT: '#0A0A0A',
          muted: 'rgba(10, 10, 10, 0.72)',
          faint: 'rgba(10, 10, 10, 0.48)',
        },
        // Person A: solid black
        a: {
          DEFAULT: '#0A0A0A',
          dim: 'rgba(10, 10, 10, 0.7)',
          deep: '#000000',
          glow: 'rgba(10, 10, 10, 0.15)',
        },
        // Person B: yellow (always on black bg or with black border for legibility)
        b: {
          DEFAULT: '#FFE234',
          dim: '#E0C42E',
          deep: '#7a6800',
          glow: 'rgba(255, 226, 52, 0.35)',
        },
        // Pop accents — kept playful for chaos energy
        pop: {
          yellow: '#FFE234',
          acid: '#ECFD38',
          pink: '#FF90BB',
          deep: '#0A0A0A',
          white: '#FFFFFF',
          sky: '#7CC9FF',
          purple: '#C084FF',
        },
        line: '#0A0A0A',
      },
      backgroundImage: {
        'pop-hero': 'linear-gradient(135deg, #FFE234 0%, #FF90BB 60%, #0A0A0A 100%)',
        'pop-cool': 'linear-gradient(135deg, #FFE234 0%, #FFFFFF 100%)',
        'pop-warm': 'linear-gradient(135deg, #FFE234 0%, #FF90BB 100%)',
        'pop-fresh': 'linear-gradient(135deg, #FFFFFF 0%, #FFE234 100%)',
        'pop-candy': 'linear-gradient(135deg, #FF90BB 0%, #FFE234 100%)',
        'halftone': 'radial-gradient(rgba(10,10,10,0.5) 1px, transparent 1.5px)',
      },
      boxShadow: {
        // hard cut-and-paste shadow — Bauhaus block
        'sticker': '4px 4px 0 #0A0A0A',
        'sticker-warm': '4px 4px 0 #0A0A0A',
        'sticker-cool': '6px 6px 0 #0A0A0A',
        'pill-glow': '2px 2px 0 #0A0A0A',
        'cut': '4px 4px 0 #0A0A0A',
        'cut-lg': '6px 6px 0 #0A0A0A',
        'cut-xl': '8px 8px 0 #0A0A0A',
      },
      fontFamily: {
        mono: ['"Courier Prime"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
        // serif role now plays "display headline" — Bebas Neue
        serif: ['"Bebas Neue"', '"Instrument Serif"', 'sans-serif'],
        sans: ['"Courier Prime"', 'system-ui', 'sans-serif'],
        display: ['"Bebas Neue"', 'sans-serif'],
        body: ['"Courier Prime"', 'monospace'],
      },
      animation: {
        'count-up': 'countUp 0.6s ease-out',
        'fade-in': 'fadeIn 0.8s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'pulse-soft': 'pulseSoft 2.5s ease-in-out infinite',
        'pop-in': 'popIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'wobble': 'wobble 2.6s ease-in-out infinite',
        'float-slow': 'floatSlow 6s ease-in-out infinite',
        'float-med': 'floatSlow 4.2s ease-in-out infinite',
        'shimmer': 'shimmer 3s linear infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
        'spin-slow': 'spin 14s linear infinite',
      },
      keyframes: {
        countUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pulseSoft: { '0%, 100%': { opacity: '0.6' }, '50%': { opacity: '1' } },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.7) rotate(-3deg)' },
          '60%': { opacity: '1', transform: 'scale(1.04) rotate(1deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0)' },
        },
        wobble: { '0%, 100%': { transform: 'rotate(-4deg)' }, '50%': { transform: 'rotate(4deg)' } },
        floatSlow: { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-8px)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        gradientShift: { '0%, 100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
      },
    },
  },
  plugins: [],
}
