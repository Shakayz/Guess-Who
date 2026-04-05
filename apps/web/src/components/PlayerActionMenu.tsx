import React, { useState, useRef, useEffect } from 'react'
import { api } from '../lib/api'
import { ReportModal } from './ReportModal'

interface PlayerActionMenuProps {
  targetUserId: string
  targetUsername: string
  /** Optional: position the menu relative to a trigger element */
  className?: string
  children: (open: () => void) => React.ReactNode
}

/**
 * Renders a trigger via render-prop children, then shows a popover
 * with Block / Report actions when triggered.
 */
export function PlayerActionMenu({ targetUserId, targetUsername, className, children }: PlayerActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [blockLoading, setBlockLoading] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleBlock = async () => {
    if (blocked) return
    setBlockLoading(true)
    try {
      await api.post(`/users/${targetUserId}/block`, {})
      setBlocked(true)
    } catch {}
    setBlockLoading(false)
    setOpen(false)
  }

  return (
    <div className={`relative inline-block ${className ?? ''}`} ref={menuRef}>
      {children(() => setOpen((p) => !p))}

      {open && (
        <div className="absolute right-0 top-full mt-1 z-40 w-44 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl shadow-black/60 overflow-hidden animate-slide-up">
          <button
            onClick={() => { setShowReport(true); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors text-left"
          >
            <span>🚨</span>
            Report
          </button>
          <div className="h-px bg-neutral-800" />
          <button
            onClick={handleBlock}
            disabled={blockLoading || blocked}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-400 hover:bg-red-950/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{blocked ? '✅' : '🚫'}</span>
            {blockLoading ? 'Blocking...' : blocked ? 'Blocked' : 'Block'}
          </button>
        </div>
      )}

      {showReport && (
        <ReportModal
          targetUserId={targetUserId}
          targetUsername={targetUsername}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  )
}
