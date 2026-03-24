import React from 'react'

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'rank'

export interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-neutral-800 text-neutral-300',
  success: 'bg-emerald-900/60 text-emerald-400',
  warning: 'bg-amber-900/60 text-amber-400',
  danger:  'bg-red-900/60 text-red-400',
  info:    'bg-blue-900/60 text-blue-400',
  rank:    'bg-violet-900/60 text-violet-400',
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}
