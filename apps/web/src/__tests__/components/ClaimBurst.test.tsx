import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { ClaimBurst } from '../../components/achievements/ClaimBurst'

describe('ClaimBurst', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders nothing when the target element does not exist', () => {
    vi.useFakeTimers()
    const { container } = render(
      <ClaimBurst targetKey="missing" stars={10} onDone={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
    vi.useRealTimers()
  })

  it('renders 14 animated star particles and a +N⭐ label anchored to the target', () => {
    vi.useFakeTimers()
    // Seed a fake target in the DOM. jsdom returns zero rects by default,
    // so stub getBoundingClientRect to produce a deterministic position.
    const target = document.createElement('div')
    target.id = 'achievement-card-key42'
    target.getBoundingClientRect = () => ({
      left: 100,
      top: 200,
      width: 50,
      height: 40,
      right: 150,
      bottom: 240,
      x: 100,
      y: 200,
      toJSON() { return {} },
    }) as DOMRect
    document.body.appendChild(target)

    const { container } = render(<ClaimBurst targetKey="key42" stars={25} onDone={vi.fn()} />)
    expect(screen.getByText('+25⭐')).toBeInTheDocument()
    // Particle emojis are a mix of ⭐/✨/💫, so assert the animated-particle
    // count via the class that all particles share.
    const particles = container.querySelectorAll('.animate-star-fly')
    expect(particles.length).toBe(14)
    vi.useRealTimers()
  })

  it('adds the jelly animation class to the target for ~650ms', () => {
    vi.useFakeTimers()
    const target = document.createElement('div')
    target.id = 'achievement-card-anim'
    target.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 1, height: 1, right: 1, bottom: 1, x: 0, y: 0, toJSON() { return {} } }) as DOMRect
    document.body.appendChild(target)

    render(<ClaimBurst targetKey="anim" stars={1} onDone={vi.fn()} />)
    expect(target.classList.contains('animate-jelly')).toBe(true)
    act(() => {
      vi.advanceTimersByTime(700)
    })
    expect(target.classList.contains('animate-jelly')).toBe(false)
    vi.useRealTimers()
  })

  it('calls onDone after the 1.7s celebration finishes', () => {
    vi.useFakeTimers()
    const target = document.createElement('div')
    target.id = 'achievement-card-done'
    target.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 1, height: 1, right: 1, bottom: 1, x: 0, y: 0, toJSON() { return {} } }) as DOMRect
    document.body.appendChild(target)

    const onDone = vi.fn()
    render(<ClaimBurst targetKey="done" stars={1} onDone={onDone} />)
    expect(onDone).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1700)
    })
    expect(onDone).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
