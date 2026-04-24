import React, { memo, useMemo } from 'react'
import { getEmoteById, type EmoteRarity, type EmoteAnimation, type EmoteParticle } from '@red-handed/shared'

/**
 * In-game floating reaction. The emoji glyph is only the base layer — every
 * emote gets a rarity-tinted halo, an entrance animation keyed off the
 * catalog's `animation` field, and an optional particle burst. The effect
 * stack is what gives the feature its "AAA emote" feel without needing
 * bespoke artwork for each item.
 *
 * Tuning:
 *   - Lifetime is hard-coded to 2.8s on the game page (see GamePage.tsx),
 *     this component only owns the in-flight visuals.
 *   - Particles mount once and self-cleanup via CSS keyframes + pointer-events
 *     none. We render at most 10 particles per emote to keep perf predictable
 *     with many concurrent emotes on screen.
 */

type Props = {
  emoteId?: string
  // Legacy fallback so floating emotes from old clients (emoji-only payloads)
  // still render something reasonable while the id-based path rolls out.
  emoji?: string
  username: string
  x: number
}

const HALO_BY_RARITY: Record<EmoteRarity, { ring: string; glow: string; label: string }> = {
  free:      { ring: 'from-neutral-500/30 to-neutral-700/0',       glow: 'rgba(120,120,140,0.25)', label: '' },
  common:    { ring: 'from-sky-400/50 to-sky-700/0',               glow: 'rgba(56,189,248,0.35)',  label: '' },
  rare:      { ring: 'from-blue-400/60 to-indigo-700/0',           glow: 'rgba(99,102,241,0.45)',  label: 'RARE' },
  epic:      { ring: 'from-fuchsia-400/70 to-purple-700/0',        glow: 'rgba(217,70,239,0.55)',  label: 'EPIC' },
  legendary: { ring: 'from-amber-300 via-yellow-400 to-rose-500',  glow: 'rgba(251,191,36,0.7)',   label: 'LEGENDARY' },
}

const ANIM_CLASS: Record<EmoteAnimation, string> = {
  pop:    'emote-pop',
  bounce: 'emote-bounce',
  spin:   'emote-spin',
  shake:  'emote-shake',
  drift:  'emote-drift',
}

const PARTICLE_GLYPHS: Record<EmoteParticle, string[]> = {
  none:      [],
  sparkle:   ['✨', '⭐', '✨'],
  hearts:    ['❤️', '💖', '💕'],
  fire:      ['🔥', '💢', '🔥'],
  stars:     ['⭐', '🌟', '✨'],
  tears:     ['💧', '💦'],
  confetti:  ['🎉', '🎊', '✨'],
  lightning: ['⚡', '⚡'],
  bubbles:   ['💭', '○'],
  money:     ['💵', '💰', '💸'],
  skull:     ['💀', '☠️'],
}

const FloatingEmoteImpl: React.FC<Props> = ({ emoteId, emoji, username, x }) => {
  const emote = emoteId ? getEmoteById(emoteId) : undefined
  const rarity: EmoteRarity = emote?.rarity ?? 'free'
  const animation: EmoteAnimation = emote?.animation ?? 'pop'
  const particle: EmoteParticle = emote?.particle ?? 'none'
  const glyph = emote?.emoji ?? emoji ?? '❔'
  const halo = HALO_BY_RARITY[rarity]

  // Pick which particles to render once, on mount — re-picking on every
  // render would make them jitter on React reflows.
  const particles = useMemo(() => {
    const pool = PARTICLE_GLYPHS[particle]
    if (pool.length === 0) return [] as { g: string; dx: number; dy: number; d: number; s: number }[]
    const count = rarity === 'legendary' ? 10 : rarity === 'epic' ? 7 : rarity === 'rare' ? 5 : 4
    return Array.from({ length: count }, (_, i) => ({
      g: pool[i % pool.length],
      dx: (Math.random() - 0.5) * 120,
      dy: -40 - Math.random() * 80,
      d: Math.random() * 0.3,
      s: 0.6 + Math.random() * 0.8,
    }))
  }, [particle, rarity])

  return (
    <div
      className="pointer-events-none absolute bottom-20 z-50 flex flex-col items-center animate-float-up"
      style={{ left: `${x}%` }}
    >
      {/* Halo / rarity ring behind the glyph. Legendaries get an animated
          rotating gradient; everyone else is a static radial glow. */}
      <div className="relative">
        <div
          className={[
            'absolute inset-0 -z-10 rounded-full',
            rarity === 'legendary' ? 'emote-halo-spin' : '',
          ].join(' ')}
          style={{
            background:
              rarity === 'legendary'
                ? `conic-gradient(from 0deg, #fbbf24, #f472b6, #60a5fa, #34d399, #fbbf24)`
                : `radial-gradient(circle, ${halo.glow} 0%, transparent 65%)`,
            filter: rarity === 'legendary' ? 'blur(6px)' : 'blur(8px)',
            width: '72px',
            height: '72px',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: rarity === 'legendary' ? 0.75 : 1,
          }}
          aria-hidden
        />
        {/* Glyph — the entrance animation comes from ANIM_CLASS[animation]. */}
        <span
          className={[
            'text-4xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] inline-block',
            ANIM_CLASS[animation],
          ].join(' ')}
        >
          {glyph}
        </span>
        {/* Particles radiate outwards from the glyph. CSS handles fade-out. */}
        {particles.map((p, i) => (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 pointer-events-none emote-particle"
            style={{
              ['--dx' as any]: `${p.dx}px`,
              ['--dy' as any]: `${p.dy}px`,
              ['--delay' as any]: `${p.d}s`,
              ['--scale' as any]: p.s,
              fontSize: '16px',
            }}
          >
            {p.g}
          </span>
        ))}
      </div>

      <span className="text-[10px] text-white/80 font-semibold mt-1.5 bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm">
        {username}
      </span>
    </div>
  )
}

export const FloatingEmote = memo(FloatingEmoteImpl)
