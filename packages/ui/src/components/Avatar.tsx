import React from 'react'

export interface AvatarProps {
  src?: string | null
  username: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-xl',
  xl: 'w-20 h-20 text-2xl',
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

function getColorFromName(name: string): string {
  const colors = [
    'bg-violet-600', 'bg-blue-600', 'bg-emerald-600',
    'bg-amber-600', 'bg-rose-600', 'bg-cyan-600',
  ]
  const idx = name.charCodeAt(0) % colors.length
  return colors[idx]
}

export function Avatar({ src, username, size = 'md', className = '' }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={username}
        className={['rounded-full object-cover', sizeMap[size], className].join(' ')}
      />
    )
  }
  return (
    <div
      className={[
        'rounded-full flex items-center justify-center font-bold text-white select-none',
        sizeMap[size],
        getColorFromName(username),
        className,
      ].join(' ')}
    >
      {getInitials(username)}
    </div>
  )
}
