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
        // ── Base entrance / exit ──────────────────────────────────────
        'fade-in':      'fadeIn 0.2s ease-out',
        'fade-in-slow': 'fadeIn 0.6s ease-out',
        'slide-up':     'slideUp 0.3s ease-out',
        'slide-down':   'slideDown 0.3s ease-out',
        'slide-left':   'slideLeft 0.35s cubic-bezier(0.16,1,0.3,1)',
        'slide-right':  'slideRight 0.35s cubic-bezier(0.16,1,0.3,1)',
        'pulse-slow':   'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-up':     'floatUp 2.8s ease-out forwards',
        'count-up':     'countUp 1.5s ease-out forwards',
        'confetti':     'confetti 3s ease-out forwards',
        'bounce-in':    'bounceIn 0.5s ease-out',
        'scale-in':     'scaleIn 0.3s ease-out',
        'shimmer':      'shimmer 1.5s ease-in-out forwards',
        'shimmer-slow': 'shimmer 3s linear infinite',

        // ── Achievement / unlock bursts ───────────────────────────────
        'burst-pop':      'burstPop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'radial-glow':    'radialGlow 0.8s ease-out forwards',
        'star-fly':       'starFly 1.1s ease-out forwards',
        'burst-label':    'burstLabel 1.1s ease-out forwards',
        'coin-tick':      'coinTick 0.6s ease-out',
        'rainbow-border': 'rainbowShift 3s linear infinite',

        // ── Game-feel (Duolingo / Clash style) ────────────────────────
        // Juicy entrance with squash-and-stretch
        'pop-in':         'popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'pop-in-soft':    'popIn 0.6s cubic-bezier(0.25, 1.2, 0.5, 1.1) both',
        'card-flip':      'cardFlip 0.8s cubic-bezier(0.68,-0.55,0.27,1.55) forwards',
        'card-flip-slow': 'cardFlip 1.2s cubic-bezier(0.68,-0.55,0.27,1.55) forwards',
        'flip-in':        'flipIn 0.7s cubic-bezier(0.68,-0.55,0.27,1.55) both',
        'stamp-in':       'stampIn 0.55s cubic-bezier(0.68,-0.55,0.27,1.55) both',

        // Elimination / death
        'death-fall':     'deathFall 1.2s cubic-bezier(0.45,0.05,0.55,0.95) forwards',
        'death-fade':     'deathFade 2s ease-out forwards',
        'desaturate':     'desaturate 1.2s ease-out forwards',

        // Emphasis / feedback
        'shake':          'shake 0.5s cubic-bezier(.36,.07,.19,.97) both',
        'wobble':         'wobble 0.8s ease-in-out',
        'jelly':          'jelly 0.6s ease-out',
        'tada':           'tada 0.9s ease-out',
        'heartbeat':      'heartbeat 1.4s ease-in-out infinite',
        'breathe':        'breathe 2.8s ease-in-out infinite',
        'glow-pulse':     'glowPulse 2s ease-in-out infinite',
        'ring-pulse':     'ringPulse 1.6s ease-out infinite',
        'urgent-pulse':   'urgentPulse 0.8s ease-in-out infinite',

        // Particles / celebration
        'confetti-rain':  'confettiRain 2.2s linear forwards',
        'sparkle':        'sparkle 1.2s ease-out forwards',
        'ray-spin':       'raySpin 7s linear infinite',
        'ring-out':       'ringOut 1.4s cubic-bezier(0.16,1,0.3,1) forwards',
        'screen-flash':   'screenFlash 0.5s ease-out forwards',

        // Arrivals
        'float-soft':     'floatSoft 3.5s ease-in-out infinite',
        'tilt-idle':      'tiltIdle 4s ease-in-out infinite',

        // ── Reward reveal (3D card flip + coin rain) ──────────────────
        'card-flip-in':   'cardFlipIn 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'card-flip-hero': 'cardFlipHero 1.1s cubic-bezier(0.34, 1.4, 0.5, 1) forwards',
        'coin-rain':      'coinRain 1.8s ease-in forwards',
        'coin-spin':      'coinSpin 1.4s linear infinite',
        'sheen-sweep':    'sheenSweep 2.4s ease-in-out 0.6s infinite',
      },
      keyframes: {
        fadeIn:   { from: { opacity: '0' },                 to: { opacity: '1' } },
        slideUp:  { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideDown:{ from: { opacity: '0', transform: 'translateY(-12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideLeft:{ from: { opacity: '0', transform: 'translateX(24px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        slideRight:{ from: { opacity: '0', transform: 'translateX(-24px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
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

        // ── Game-feel keyframes ───────────────────────────────────────
        popIn: {
          '0%':   { opacity: '0', transform: 'scale(0.3) translateY(10px)' },
          '55%':  { opacity: '1', transform: 'scale(1.12) translateY(-4px)' },
          '75%':  { transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        cardFlip: {
          '0%':   { transform: 'perspective(900px) rotateY(0deg) scale(0.95)' },
          '50%':  { transform: 'perspective(900px) rotateY(90deg) scale(1.05)' },
          '100%': { transform: 'perspective(900px) rotateY(180deg) scale(1)' },
        },
        flipIn: {
          '0%':   { opacity: '0', transform: 'perspective(900px) rotateX(-90deg) translateY(-40px)' },
          '60%':  { opacity: '1', transform: 'perspective(900px) rotateX(20deg) translateY(6px)' },
          '100%': { opacity: '1', transform: 'perspective(900px) rotateX(0deg) translateY(0)' },
        },
        stampIn: {
          '0%':   { opacity: '0', transform: 'scale(3) rotate(-18deg)', filter: 'blur(6px)' },
          '60%':  { opacity: '1', transform: 'scale(0.92) rotate(-6deg)', filter: 'blur(0)' },
          '80%':  { transform: 'scale(1.06) rotate(-10deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(-8deg)', filter: 'blur(0)' },
        },
        deathFall: {
          '0%':   { opacity: '1', transform: 'translateY(0) rotate(0deg) scale(1)', filter: 'grayscale(0)' },
          '30%':  { transform: 'translateY(-8px) rotate(-6deg) scale(1.02)' },
          '100%': { opacity: '0.15', transform: 'translateY(80px) rotate(30deg) scale(0.7)', filter: 'grayscale(1)' },
        },
        deathFade: {
          '0%':   { opacity: '1', filter: 'grayscale(0) brightness(1)' },
          '100%': { opacity: '0.5', filter: 'grayscale(1) brightness(0.6)' },
        },
        desaturate: {
          '0%':   { filter: 'grayscale(0) brightness(1)' },
          '100%': { filter: 'grayscale(1) brightness(0.55)' },
        },
        shake: {
          '10%,90%':  { transform: 'translate3d(-1px,0,0)' },
          '20%,80%':  { transform: 'translate3d(2px,0,0)' },
          '30%,50%,70%': { transform: 'translate3d(-6px,0,0)' },
          '40%,60%':  { transform: 'translate3d(6px,0,0)' },
        },
        wobble: {
          '0%':   { transform: 'translateX(0)' },
          '15%':  { transform: 'translateX(-12px) rotate(-4deg)' },
          '30%':  { transform: 'translateX(10px)  rotate(3deg)' },
          '45%':  { transform: 'translateX(-8px) rotate(-3deg)' },
          '60%':  { transform: 'translateX(6px)  rotate(2deg)' },
          '75%':  { transform: 'translateX(-3px) rotate(-1deg)' },
          '100%': { transform: 'translateX(0)' },
        },
        jelly: {
          '0%,100%': { transform: 'scale(1,1)' },
          '25%':     { transform: 'scale(1.12,0.88)' },
          '50%':     { transform: 'scale(0.92,1.08)' },
          '75%':     { transform: 'scale(1.04,0.96)' },
        },
        tada: {
          '0%':   { transform: 'scale(1) rotate(0)' },
          '10%,20%': { transform: 'scale(0.92) rotate(-3deg)' },
          '30%,50%,70%,90%': { transform: 'scale(1.1) rotate(3deg)' },
          '40%,60%,80%':     { transform: 'scale(1.1) rotate(-3deg)' },
          '100%': { transform: 'scale(1) rotate(0)' },
        },
        heartbeat: {
          '0%,100%': { transform: 'scale(1)' },
          '14%':     { transform: 'scale(1.1)' },
          '28%':     { transform: 'scale(1)' },
          '42%':     { transform: 'scale(1.1)' },
          '70%':     { transform: 'scale(1)' },
        },
        breathe: {
          '0%,100%': { transform: 'scale(1)',     opacity: '0.95' },
          '50%':     { transform: 'scale(1.04)',  opacity: '1' },
        },
        glowPulse: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(139,92,246,0.55), 0 0 24px 0 rgba(139,92,246,0.15)' },
          '50%':     { boxShadow: '0 0 0 10px rgba(139,92,246,0), 0 0 40px 6px rgba(139,92,246,0.35)' },
        },
        ringPulse: {
          '0%':   { transform: 'scale(0.85)', opacity: '0.9' },
          '100%': { transform: 'scale(1.6)',  opacity: '0' },
        },
        urgentPulse: {
          '0%,100%': { transform: 'scale(1)',    boxShadow: '0 0 0 0 rgba(239,68,68,0.55)' },
          '50%':     { transform: 'scale(1.06)', boxShadow: '0 0 0 14px rgba(239,68,68,0)' },
        },
        confettiRain: {
          '0%':   { transform: 'translateY(-120vh) rotate(0deg)', opacity: '1' },
          '80%':  { opacity: '1' },
          '100%': { transform: 'translateY(120vh) rotate(720deg)', opacity: '0' },
        },
        sparkle: {
          '0%':   { transform: 'translate(-50%,-50%) scale(0) rotate(0deg)', opacity: '0' },
          '30%':  { opacity: '1' },
          '100%': { transform: 'translate(-50%,-50%) scale(1.4) rotate(240deg)', opacity: '0' },
        },
        raySpin: {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        ringOut: {
          '0%':   { transform: 'scale(0.2)',  opacity: '1',   borderWidth: '6px' },
          '100%': { transform: 'scale(3.2)',  opacity: '0',   borderWidth: '1px' },
        },
        screenFlash: {
          '0%,100%': { opacity: '0' },
          '20%':     { opacity: '0.55' },
        },
        floatSoft: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-6px)' },
        },
        tiltIdle: {
          '0%,100%': { transform: 'rotate(-2deg)' },
          '50%':     { transform: 'rotate(2deg)' },
        },

        // ── Reward reveal keyframes ───────────────────────────────────
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
        sheenSweep: {
          '0%':   { transform: 'translateX(-120%) skewX(-18deg)', opacity: '0' },
          '20%':  { opacity: '0.6' },
          '100%': { transform: 'translateX(220%) skewX(-18deg)',  opacity: '0' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
