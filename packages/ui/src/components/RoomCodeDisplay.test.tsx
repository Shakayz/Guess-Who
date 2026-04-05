import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RoomCodeDisplay } from './RoomCodeDisplay'

describe('RoomCodeDisplay', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the room code text', () => {
    render(<RoomCodeDisplay code="ABC123" />)
    expect(screen.getByText('ABC123')).toBeInTheDocument()
  })

  it('shows "Copy" label initially', () => {
    render(<RoomCodeDisplay code="XYZ789" />)
    expect(screen.getByText('Copy')).toBeInTheDocument()
  })

  it('shows "✓ Copied" after clicking and copies to clipboard', async () => {
    render(<RoomCodeDisplay code="XYZ789" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('XYZ789')
    expect(screen.getByText('✓ Copied')).toBeInTheDocument()
  })

  it('reverts to "Copy" after 2 seconds', async () => {
    render(<RoomCodeDisplay code="XYZ789" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    expect(screen.getByText('✓ Copied')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('Copy')).toBeInTheDocument()
  })

  it('passes extra className to the button', () => {
    render(<RoomCodeDisplay code="ABC" className="my-class" />)
    expect(screen.getByRole('button').className).toContain('my-class')
  })
})
