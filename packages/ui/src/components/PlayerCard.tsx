import React from 'react'
import type { Player } from '@imposter/shared'
import { Avatar } from './Avatar'
import { Badge } from './Badge'

export interface PlayerCardProps {
  player: Player
  isCurrentUser?: boolean
  canVote?: boolean
  hasVoted?: boolean
  onVote?: (playerId: string) => void
  showRole?: boolean
  className?: string
}

export function PlayerCard({
  player,
  isCurrentUser = false,
  canVote = false,
  hasVoted = false,
  onVote,
  showRole = false,
  className = '',
}: PlayerCardProps) {
  const isEliminated = player.status === 'eliminated'

  return (
    <div
      className={[
        'relative flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200',
        isEliminated
          ? 'opacity-40 border-neutral-800 bg-neutral-900/40'
          : isCurrentUser
          ? 'border-violet-600/60 bg-violet-950/30'
          : 'border-neutral-800 bg-neutral-900/60',
        canVote && !isEliminated && !isCurrentUser
          ? 'cursor-pointer hover:border-violet-500 hover:bg-violet-950/20'
          : '',
        className,
      ].join(' ')}
      onClick={() => canVote && !isEliminated && !isCurrentUser && onVote?.(player.userId)}
    >
      <Avatar src={player.avatarUrl} username={player.username} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          {player.username}
          {isCurrentUser && <span className="text-violet-400 ml-1">(you)</span>}
        </p>
        {showRole && player.role && (
          <Badge variant={player.role === 'imposter' || player.role === 'double_agent' ? 'danger' : 'success'}>
            {player.role}
          </Badge>
        )}
      </div>
      {player.isHost && (
        <span className="text-xs text-amber-400 font-semibold">HOST</span>
      )}
      {hasVoted && !canVote && (
        <span className="text-xs text-emerald-400">✓</span>
      )}
    </div>
  )
}
