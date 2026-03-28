import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
      },
      animation: {
        'fade-in':     'fadeIn 0.2s ease-out',
        'slide-up':    'slideUp 0.3s ease-out',
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-up':    'floatUp 2.8s ease-out forwards',
        'count-up':    'countUp 1.5s ease-out forwards',
        'confetti':    'confetti 3s ease-out forwards',
        'bounce-in':   'bounceIn 0.5s ease-out',
        'scale-in':    'scaleIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn:   { from: { opacity: '0' },                 to: { opacity: '1' } },
        slideUp:  { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        floatUp:  {
          '0%':   { opacity: '1',   transform: 'translateY(0)    scale(1)' },
          '60%':  { opacity: '1',   transform: 'translateY(-80px) scale(1.15)' },
          '100%': { opacity: '0',   transform: 'translateY(-140px) scale(0.9)' },
        },
        countUp: {
          '0%':   { transform: 'translateY(20px)', opacity: '0' },
          '50%':  { transform: 'translateY(-5px)', opacity: '1' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceIn: {
          '0%':   { transform: 'scale(0.3)', opacity: '0' },
          '50%':  { transform: 'scale(1.1)' },
          '70%':  { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        scaleIn: {
          from: { transform: 'scale(0.9)', opacity: '0' },
          to:   { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
