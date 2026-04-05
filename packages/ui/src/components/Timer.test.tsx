import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Timer } from './Timer'

describe('Timer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders initial seconds', () => {
    render(<Timer seconds={30} />)
    expect(screen.getByText('30s')).toBeInTheDocument()
  })

  it('color is green when > 50%', () => {
    render(<Timer seconds={60} />)
    const timerText = screen.getByText('60s')
    // 60/60 = 100% which is > 50%, so color should be green (#10b981)
    expect(timerText.style.color).toBe('rgb(16, 185, 129)')
  })

  it('counts down each second', () => {
    render(<Timer seconds={10} />)
    expect(screen.getByText('10s')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('9s')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('8s')).toBeInTheDocument()
  })

  it('calls onEnd when reaching 0', () => {
    const onEnd = vi.fn()
    render(<Timer seconds={3} onEnd={onEnd} />)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(onEnd).toHaveBeenCalled()
  })

  it('color changes to yellow when <= 50% and > 25%', () => {
    render(<Timer seconds={4} />)

    // Advance to 2s remaining: 2/4 = 50%, which is NOT > 50%, so yellow
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    const timerText = screen.getByText('2s')
    // 2/4 = 50% -> not > 50% but > 25% -> yellow (#f59e0b)
    expect(timerText.style.color).toBe('rgb(245, 158, 11)')
  })

  it('color changes to red when <= 25%', () => {
    render(<Timer seconds={4} />)

    // Advance to 1s remaining: 1/4 = 25%, which is NOT > 25%, so red
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    const timerText = screen.getByText('1s')
    // 1/4 = 25% -> not > 25% -> red (#ef4444)
    expect(timerText.style.color).toBe('rgb(239, 68, 68)')
  })
})
