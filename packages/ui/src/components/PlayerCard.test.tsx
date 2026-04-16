import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PlayerCard } from './PlayerCard'
import type { Player } from '@red-handed/shared'

const basePlayer: Player = {
  id: 'player-1',
  userId: 'user-1',
  username: 'alice',
  avatarUrl: null,
  status: 'alive',
  isHost: false,
  isReady: true,
  honorGiven: false,
}

describe('PlayerCard', () => {
  it('renders the player username', () => {
    render(<PlayerCard player={basePlayer} />)
    expect(screen.getByText('alice')).toBeInTheDocument()
  })

  it('shows "(you)" label when isCurrentUser is true', () => {
    render(<PlayerCard player={basePlayer} isCurrentUser />)
    expect(screen.getByText('(you)')).toBeInTheDocument()
  })

  it('does not show "(you)" for other players', () => {
    render(<PlayerCard player={basePlayer} />)
    expect(screen.queryByText('(you)')).not.toBeInTheDocument()
  })

  it('shows HOST badge when player is host', () => {
    const hostPlayer = { ...basePlayer, isHost: true }
    render(<PlayerCard player={hostPlayer} />)
    expect(screen.getByText('HOST')).toBeInTheDocument()
  })

  it('does not show HOST badge for regular players', () => {
    render(<PlayerCard player={basePlayer} />)
    expect(screen.queryByText('HOST')).not.toBeInTheDocument()
  })

  it('shows checkmark when hasVoted is true and canVote is false', () => {
    render(<PlayerCard player={basePlayer} hasVoted canVote={false} />)
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('shows role badge when showRole is true and player has a role', () => {
    const playerWithRole = { ...basePlayer, role: 'villager' as const }
    render(<PlayerCard player={playerWithRole} showRole />)
    expect(screen.getByText('villager')).toBeInTheDocument()
  })

  it('shows danger badge variant for redHanded role', () => {
    const playerWithRole = { ...basePlayer, role: 'red_handed' as const }
    render(<PlayerCard player={playerWithRole} showRole />)
    const badge = screen.getByText('red_handed')
    expect(badge.className).toContain('text-red-400')
  })

  it('does not show role badge when showRole is false', () => {
    const playerWithRole = { ...basePlayer, role: 'red_handed' as const }
    render(<PlayerCard player={playerWithRole} showRole={false} />)
    expect(screen.queryByText('red_handed')).not.toBeInTheDocument()
  })

  it('calls onVote with playerId when clicked and canVote is true', () => {
    const onVote = vi.fn()
    render(<PlayerCard player={basePlayer} canVote onVote={onVote} />)
    fireEvent.click(screen.getByText('alice').closest('div')!)
    expect(onVote).toHaveBeenCalledWith('user-1')
  })

  it('does not call onVote when player is eliminated', () => {
    const eliminatedPlayer = { ...basePlayer, status: 'eliminated' as const }
    const onVote = vi.fn()
    render(<PlayerCard player={eliminatedPlayer} canVote onVote={onVote} />)
    fireEvent.click(screen.getByText('alice').closest('div')!)
    expect(onVote).not.toHaveBeenCalled()
  })

  it('does not call onVote when isCurrentUser is true', () => {
    const onVote = vi.fn()
    render(<PlayerCard player={basePlayer} canVote isCurrentUser onVote={onVote} />)
    fireEvent.click(screen.getByText('alice').closest('div')!)
    expect(onVote).not.toHaveBeenCalled()
  })

  it('applies reduced opacity for eliminated players', () => {
    const eliminatedPlayer = { ...basePlayer, status: 'eliminated' as const }
    render(<PlayerCard player={eliminatedPlayer} />)
    // The outermost div should have opacity-40
    const card = screen.getByText('alice').closest('[class*="opacity"]')
    expect(card).not.toBeNull()
    expect(card!.className).toContain('opacity-40')
  })
})
