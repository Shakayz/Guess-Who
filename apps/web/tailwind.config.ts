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
        'shimmer':     'shimmer 1.5s ease-in-out forwards',
        'shimmer-slow': 'shimmer 3s linear infinite',
        // Achievement claim-burst animations
        'burst-pop':     'burstPop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'radial-glow':   'radialGlow 0.8s ease-out forwards',
        'star-fly':      'starFly 1.1s ease-out forwards',
        'burst-label':   'burstLabel 1.1s ease-out forwards',
        'coin-tick':     'coinTick 0.6s ease-out',
        'rainbow-border': 'rainbowShift 3s linear infinite',
        // Modern reward reveal animations
        'card-flip-in':  'cardFlipIn 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'card-flip-hero':'cardFlipHero 1.1s cubic-bezier(0.34, 1.4, 0.5, 1) forwards',
        'coin-rain':     'coinRain 1.8s ease-in forwards',
        'coin-spin':     'coinSpin 1.4s linear infinite',
        'glow-pulse':    'glowPulse 2.6s ease-in-out infinite',
        'sheen-sweep':   'sheenSweep 2.4s ease-in-out 0.6s infinite',
        'pop-in':        'popIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      },
      keyframes: {
        fadeIn:   { from: { opacity: '0' },                 to: { opacity: '1' } },
        slideUp:  { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shimmer:  {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
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
        burstPop: {
          '0%':   { transform: 'scale(1)' },
          '35%':  { transform: 'scale(1.18)' },
          '55%':  { transform: 'scale(0.96)' },
          '100%': { transform: 'scale(1)' },
        },
        radialGlow: {
          '0%':   { opacity: '0',   transform: 'translate(-50%, -50%) scale(0.4)' },
          '30%':  { opacity: '0.9', transform: 'translate(-50%, -50%) scale(1.2)' },
          '100%': { opacity: '0',   transform: 'translate(-50%, -50%) scale(2.4)' },
        },
        starFly: {
          '0%':   { opacity: '0',   transform: 'translate(-50%, -50%) scale(0.4) rotate(0deg)' },
          '15%':  { opacity: '1' },
          '100%': { opacity: '0',   transform: 'translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.2) rotate(360deg)' },
        },
        burstLabel: {
          '0%':   { opacity: '0', transform: 'translate(-50%, 0)' },
          '20%':  { opacity: '1' },
          '100%': { opacity: '0', transform: 'translate(-50%, -80px)' },
        },
        coinTick: {
          '0%':   { transform: 'translateY(0) scale(1)', color: '#fde68a' },
          '20%':  { transform: 'translateY(-6px) scale(1.25)', color: '#fbbf24' },
          '100%': { transform: 'translateY(0) scale(1)', color: '#fcd34d' },
        },
        rainbowShift: {
          '0%':   { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        cardFlipIn: {
          '0%':   { opacity: '0', transform: 'perspective(900px) rotateY(-90deg) scale(0.85)' },
          '55%':  { opacity: '1', transform: 'perspective(900px) rotateY(18deg)  scale(1.03)' },
          '80%':  {                transform: 'perspective(900px) rotateY(-6deg)  scale(0.99)' },
          '100%': { opacity: '1', transform: 'perspective(900px) rotateY(0deg)   scale(1)' },
        },
        cardFlipHero: {
          '0%':   { opacity: '0', transform: 'perspective(1200px) rotateX(70deg) rotateY(-30deg) scale(0.7)' },
          '45%':  { opacity: '1', transform: 'perspective(1200px) rotateX(-8deg) rotateY(10deg)  scale(1.06)' },
          '70%':  {                transform: 'perspective(1200px) rotateX(3deg)  rotateY(-3deg) scale(0.99)' },
          '100%': { opacity: '1', transform: 'perspective(1200px) rotateX(0deg)  rotateY(0deg)  scale(1)' },
        },
        coinRain: {
          '0%':   { opacity: '0', transform: 'translate(var(--cx,0), -10px) rotate(0deg)  scale(0.6)' },
          '12%':  { opacity: '1' },
          '100%': { opacity: '0', transform: 'translate(var(--cx,0), 220px) rotate(540deg) scale(1.1)' },
        },
        coinSpin: {
          '0%':   { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(360deg)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 22px 2px rgba(251,191,36,0.25), 0 0 60px -10px rgba(251,191,36,0.35) inset' },
          '50%':      { boxShadow: '0 0 44px 6px rgba(251,191,36,0.55), 0 0 90px -10px rgba(251,191,36,0.55) inset' },
        },
        sheenSweep: {
          '0%':   { transform: 'translateX(-120%) skewX(-18deg)', opacity: '0' },
          '20%':  { opacity: '0.6' },
          '100%': { transform: 'translateX(220%) skewX(-18deg)',  opacity: '0' },
        },
        popIn: {
          '0%':   { opacity: '0', transform: 'scale(0.3) translateY(8px)' },
          '60%':  { opacity: '1', transform: 'scale(1.12) translateY(-2px)' },
          '100%': { opacity: '1', transform: 'scale(1)   translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
