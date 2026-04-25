import React from 'react'
import { useTranslation } from 'react-i18next'
import type { EmoteRarity } from '@red-handed/shared'

/**
 * Single emote card used in the shop grid and the profile loadout picker.
 * Same visual language everywhere so a purchased emote looks identical on
 * every surface it appears on — builds recognition and trust ("the legendary
 * I bought on web is the legendary I see in-game").
 */

const RARITY_STYLE: Record<
  EmoteRarity,
  { border: string; bg: string; badge: string; ring: string }
> = {
  free: {
    border: 'border-neutral-700',
    bg:     'bg-neutral-900',
    badge:  'text-neutral-400 bg-neutral-800',
    ring:   '',
  },
  common: {
    border: 'border-sky-700/50',
    bg:     'bg-sky-950/30',
    badge:  'text-sky-300 bg-sky-900/60',
    ring:   'ring-1 ring-sky-500/20',
  },
  rare: {
    border: 'border-indigo-600/50',
    bg:     'bg-indigo-950/40',
    badge:  'text-indigo-300 bg-indigo-900/60',
    ring:   'ring-1 ring-indigo-500/30',
  },
  epic: {
    border: 'border-fuchsia-600/60',
    bg:     'bg-fuchsia-950/40',
    badge:  'text-fuchsia-300 bg-fuchsia-900/60',
    ring:   'ring-2 ring-fuchsia-500/30',
  },
  legendary: {
    border: 'border-amber-500/70',
    bg:     'bg-gradient-to-br from-amber-950/40 via-rose-950/30 to-purple-950/40',
    badge:  'text-amber-200 bg-amber-900/60',
    ring:   'ring-2 ring-amber-400/40',
  },
}

type Props = {
  emoji: string
  name: string
  rarity: EmoteRarity
  price: number
  owned: boolean
  equipped?: boolean
  /** Fully blocks clicks (used for already-owned / free tiles). */
  disabled?: boolean
  /**
   * Visually dim the tile but keep it clickable. Used for "can't afford
   * right now" — the server is authoritative so we still let the click
   * through and surface the real error instead of silently swallowing it.
   */
  dimmed?: boolean
  busy?: boolean
  onClick?: () => void
  /** Show a "Buy" CTA when not owned; hide when this is a loadout picker. */
  showPrice?: boolean
}

export const EmoteTile: React.FC<Props> = ({
  emoji, name, rarity, price, owned, equipped, disabled, dimmed, busy, onClick, showPrice = true,
}) => {
  const { t } = useTranslation()
  const r = RARITY_STYLE[rarity]
  const label = rarity === 'free' ? 'FREE' : rarity.toUpperCase()
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={[
        'relative p-3 rounded-xl border text-center transition-all',
        r.border, r.bg, r.ring,
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : dimmed
          ? 'opacity-70 hover:opacity-100 hover:scale-[1.02] active:scale-[0.98]'
          : 'hover:scale-[1.02] active:scale-[0.98]',
      ].join(' ')}
    >
      {equipped && (
        // Compact check-mark glyph instead of the word "EQUIPPED" — on narrow
        // mobile tiles the longer label collided with the right-side rarity
        // pill. The visible ✓ + sr-only label keeps a11y intact.
        <span
          aria-label={t('emote.equipped', 'Equipped')}
          title={t('emote.equipped', 'Equipped')}
          className="absolute top-1.5 left-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold leading-none shadow-sm"
        >
          <span aria-hidden="true">✓</span>
          <span className="sr-only">{t('emote.equipped', 'Equipped')}</span>
        </span>
      )}
      <span
        className={[
          'absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full',
          r.badge,
        ].join(' ')}
      >
        {label}
      </span>
      <div className="flex items-center justify-center h-14">
        <span className="text-4xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]">{emoji}</span>
      </div>
      <p className="text-[11px] font-semibold text-white truncate mt-1">{name}</p>
      {showPrice && (
        <p className="text-[11px] mt-1">
          {owned ? (
            <span className="text-emerald-400 font-semibold">{t('emote.owned', 'Owned')}</span>
          ) : rarity === 'free' ? (
            <span className="text-neutral-400">—</span>
          ) : (
            <span className="text-amber-300 font-semibold">⭐ {price.toLocaleString()}</span>
          )}
        </p>
      )}
      {busy && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl text-xs font-bold text-white">
          …
        </span>
      )}
    </button>
  )
}
