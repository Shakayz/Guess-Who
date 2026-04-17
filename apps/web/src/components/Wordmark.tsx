import React from 'react'

interface WordmarkProps {
  /** 'inline' = single line (for navbar), 'stacked' = two lines (for hero/auth) */
  layout?: 'inline' | 'stacked'
  /** CSS font-size applied to the wordmark (px or any CSS unit). */
  size?: number | string
  className?: string
}

/**
 * "Red Handed!" wordmark — heavy italic serif in deep red, matching the brand reference.
 * Rendered as inline HTML (not an SVG file) so it can pick up the Playfair Display
 * web font loaded in index.html.
 */
export function Wordmark({ layout = 'inline', size, className = '' }: WordmarkProps) {
  const style: React.CSSProperties = {
    fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif',
    fontWeight: 900,
    fontStyle: 'italic',
    color: '#dc2626',
    letterSpacing: '-0.02em',
    lineHeight: 0.95,
    textShadow: '0 1px 0 rgba(127, 29, 29, 0.35)',
  }
  if (size !== undefined) {
    style.fontSize = typeof size === 'number' ? `${size}px` : size
  }

  if (layout === 'stacked') {
    return (
      <span
        className={`inline-flex flex-col items-center select-none ${className}`}
        style={style}
        aria-label="Red Handed !"
      >
        <span>Red</span>
        <span>
          Handed <span style={{ color: '#b91c1c' }}>!</span>
        </span>
      </span>
    )
  }

  return (
    <span
      className={`select-none whitespace-nowrap ${className}`}
      style={style}
      aria-label="Red Handed !"
    >
      Red Handed <span style={{ color: '#b91c1c' }}>!</span>
    </span>
  )
}
