import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { apiPost } = vi.hoisted(() => ({ apiPost: vi.fn() }))
vi.mock('../../lib/api', () => ({ api: { post: apiPost } }))

// Replace ReportModal with a simple stub so we don't pull in api for the modal.
vi.mock('../../components/ReportModal', () => ({
  ReportModal: ({ targetUsername, onClose }: { targetUsername: string; onClose: () => void }) => (
    <div data-testid="report-modal">
      Reporting {targetUsername}
      <button onClick={onClose}>close modal</button>
    </div>
  ),
}))

import { PlayerActionMenu } from '../../components/PlayerActionMenu'

function Trigger({ open }: { open: () => void }) {
  return <button onClick={open}>open-menu</button>
}

describe('PlayerActionMenu', () => {
  beforeEach(() => {
    apiPost.mockReset()
  })

  it('does not show the menu until the trigger is clicked', () => {
    render(
      <PlayerActionMenu targetUserId="u1" targetUsername="Alice">
        {(open) => <Trigger open={open} />}
      </PlayerActionMenu>,
    )
    expect(screen.queryByText('Report')).not.toBeInTheDocument()
  })

  it('opens the menu on trigger click', () => {
    render(
      <PlayerActionMenu targetUserId="u1" targetUsername="Alice">
        {(open) => <Trigger open={open} />}
      </PlayerActionMenu>,
    )
    fireEvent.click(screen.getByText('open-menu'))
    expect(screen.getByText('Report')).toBeInTheDocument()
    expect(screen.getByText('Block')).toBeInTheDocument()
  })

  it('clicking Report opens ReportModal and closes the menu', () => {
    render(
      <PlayerActionMenu targetUserId="u1" targetUsername="Alice">
        {(open) => <Trigger open={open} />}
      </PlayerActionMenu>,
    )
    fireEvent.click(screen.getByText('open-menu'))
    fireEvent.click(screen.getByText('Report'))
    expect(screen.getByTestId('report-modal')).toBeInTheDocument()
    expect(screen.queryByText('Block')).not.toBeInTheDocument()
  })

  it('clicking Block posts to /users/:id/block and updates the button state', async () => {
    apiPost.mockResolvedValueOnce({})
    render(
      <PlayerActionMenu targetUserId="u42" targetUsername="Bob">
        {(open) => <Trigger open={open} />}
      </PlayerActionMenu>,
    )
    fireEvent.click(screen.getByText('open-menu'))
    fireEvent.click(screen.getByText('Block'))
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/users/u42/block', {})
    })
    // Menu closes after blocking → reopen to see "Blocked"
    fireEvent.click(screen.getByText('open-menu'))
    expect(await screen.findByText('Blocked')).toBeInTheDocument()
  })

  it('does not duplicate the block request when already blocked', async () => {
    apiPost.mockResolvedValueOnce({})
    render(
      <PlayerActionMenu targetUserId="u42" targetUsername="Bob">
        {(open) => <Trigger open={open} />}
      </PlayerActionMenu>,
    )
    fireEvent.click(screen.getByText('open-menu'))
    fireEvent.click(screen.getByText('Block'))
    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByText('open-menu'))
    const blocked = screen.getByText('Blocked')
    fireEvent.click(blocked)
    expect(apiPost).toHaveBeenCalledTimes(1)
  })

  it('swallows block errors silently (no unhandled promise)', async () => {
    apiPost.mockRejectedValueOnce(new Error('network'))
    render(
      <PlayerActionMenu targetUserId="u1" targetUsername="Alice">
        {(open) => <Trigger open={open} />}
      </PlayerActionMenu>,
    )
    fireEvent.click(screen.getByText('open-menu'))
    fireEvent.click(screen.getByText('Block'))
    await waitFor(() => expect(apiPost).toHaveBeenCalled())
    // After a failure the menu still closes, and a re-open shows "Block" again.
    fireEvent.click(screen.getByText('open-menu'))
    expect(screen.getByText('Block')).toBeInTheDocument()
  })

  it('clicking outside the menu closes it', () => {
    render(
      <div>
        <div data-testid="outside">outside</div>
        <PlayerActionMenu targetUserId="u1" targetUsername="Alice">
          {(open) => <Trigger open={open} />}
        </PlayerActionMenu>
      </div>,
    )
    fireEvent.click(screen.getByText('open-menu'))
    expect(screen.getByText('Report')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByText('Report')).not.toBeInTheDocument()
  })
})
