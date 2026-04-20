import React from 'react'

// Small crown chip surfaced next to a premium user's name in the NavBar,
// profile pages and lobbies. Single source of truth for premium visual
// styling so a future tweak (e.g. animated glow) lands everywhere at once.
export function PremiumBadge({
  size = 'sm',
  title = 'Premium',
}: { size?: 'xs' | 'sm' | 'md'; title?: string }) {
  const cls =
    size === 'xs'
      ? 'text-[10px] px-1 py-0 gap-0.5'
      : size === 'md'
        ? 'text-sm px-2 py-0.5 gap-1'
        : 'text-[11px] px-1.5 py-0.5 gap-0.5'
  return (
    <span
      title={title}
      aria-label={title}
      className={[
        'inline-flex items-center rounded-full font-bold whitespace-nowrap',
        'bg-amber-500/15 text-amber-300 border border-amber-500/40',
        cls,
      ].join(' ')}
    >
      <span aria-hidden>👑</span>
      <span className="hidden sm:inline">Premium</span>
    </span>
  )
}
