import React, { useState } from 'react'

export interface RoomCodeDisplayProps {
  code: string
  className?: string
}

export function RoomCodeDisplay({ code, className = '' }: RoomCodeDisplayProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={[
        'flex items-center gap-3 px-4 py-2 rounded-xl border border-neutral-700',
        'bg-neutral-900 hover:border-violet-600 transition-colors duration-150',
        className,
      ].join(' ')}
    >
      <span className="font-mono font-bold text-xl tracking-widest text-white">{code}</span>
      <span className="text-xs text-neutral-400">{copied ? '✓ Copied' : 'Copy'}</span>
    </button>
  )
}
