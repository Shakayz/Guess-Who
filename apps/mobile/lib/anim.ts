import { Easing } from 'react-native-reanimated'

// Cubic-bezier curves ported from apps/web/tailwind.config.ts so motion on
// mobile matches the web's "game feel" curves exactly. RN Reanimated's
// Easing.bezier takes the same four control points as CSS cubic-bezier().
export const CURVES = {
  // overshoot-back-settle (Duolingo / Clash style)
  bounce: Easing.bezier(0.34, 1.56, 0.64, 1),
  // stronger overshoot for stamps and card flips
  whipBack: Easing.bezier(0.68, -0.55, 0.27, 1.55),
  // smooth decel used for slide-ins
  smoothOut: Easing.bezier(0.16, 1, 0.3, 1),
  // classic ease-out
  easeOut: Easing.bezier(0.25, 1, 0.5, 1),
  // shake curve
  shake: Easing.bezier(0.36, 0.07, 0.19, 0.97),
  // soft pop curve
  softPop: Easing.bezier(0.25, 1.2, 0.5, 1.1),
}

// Canonical durations so animations feel consistent across screens.
export const DURATION = {
  fadeIn: 200,
  fadeInSlow: 600,
  slide: 300,
  popIn: 500,
  bounceIn: 500,
  cardFlip: 800,
  cardFlipIn: 900,
  cardFlipHero: 1100,
  stampIn: 550,
  shake: 500,
  jelly: 600,
  tada: 900,
  deathFall: 1200,
  shimmer: 1500,
  heartbeat: 1400,
  breathe: 2800,
  glowPulse: 2000,
  urgentPulse: 800,
  floatSoft: 3500,
  tiltIdle: 4000,
  coinRain: 1800,
  confettiRain: 2200,
  screenFlash: 500,
}

// Brand colors in rgba form for shadow/glow math
export const GLOW = {
  brandSolid: 'rgba(139,92,246,0.55)',
  brandDiffuse: 'rgba(139,92,246,0.15)',
  brandOuter: 'rgba(139,92,246,0.35)',
  dangerSolid: 'rgba(239,68,68,0.55)',
  goldSolid: 'rgba(251,191,36,0.75)',
}
