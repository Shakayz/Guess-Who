import React, { useEffect, useState } from 'react'

export interface TimerProps {
  seconds: number
  onEnd?: () => void
  className?: string
}

export function Timer({ seconds, onEnd, className = '' }: TimerProps) {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    setRemaining(seconds)
  }, [seconds])

  useEffect(() => {
    if (remaining <= 0) {
      onEnd?.()
      return
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(id)
  }, [remaining, onEnd])

  const pct = (remaining / seconds) * 100
  const color = pct > 50 ? '#10b981' : pct > 25 ? '#f59e0b' : '#ef4444'

  return (
    <div className={['flex flex-col items-center gap-1', className].join(' ')}>
      <span className="text-2xl font-mono font-bold" style={{ color }}>
        {remaining}s
      </span>
      <div className="w-24 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
