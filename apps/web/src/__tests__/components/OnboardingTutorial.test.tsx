import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}))

import { OnboardingTutorial, hasTutorialCompleted } from '../../components/OnboardingTutorial'

describe('hasTutorialCompleted', () => {
  beforeEach(() => localStorage.clear())

  it('returns false when flag is unset', () => {
    expect(hasTutorialCompleted()).toBe(false)
  })

  it('returns true once the flag is set to "1"', () => {
    localStorage.setItem('red-handed-tutorial-completed', '1')
    expect(hasTutorialCompleted()).toBe(true)
  })

  it('returns false for any other value', () => {
    localStorage.setItem('red-handed-tutorial-completed', '0')
    expect(hasTutorialCompleted()).toBe(false)
  })
})

describe('OnboardingTutorial', () => {
  let onClose: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    onClose = vi.fn()
  })

  it('renders the welcome step first', () => {
    render(<OnboardingTutorial onClose={onClose} />)
    expect(screen.getByText(/Welcome to Red Handed/i)).toBeInTheDocument()
  })

  it('advances to the next step on Next', () => {
    render(<OnboardingTutorial onClose={onClose} />)
    fireEvent.click(screen.getByText('common.next'))
    expect(screen.getByText(/Secret Words & Roles/i)).toBeInTheDocument()
  })

  it('goes back to the previous step on Back', () => {
    render(<OnboardingTutorial onClose={onClose} />)
    fireEvent.click(screen.getByText('common.next'))
    fireEvent.click(screen.getByText('common.back'))
    expect(screen.getByText(/Welcome to Red Handed/i)).toBeInTheDocument()
  })

  it('skip button marks tutorial completed and closes', () => {
    render(<OnboardingTutorial onClose={onClose} />)
    fireEvent.click(screen.getByText('Skip'))
    expect(localStorage.getItem('red-handed-tutorial-completed')).toBe('1')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clicking the backdrop skips the tutorial', () => {
    const { container } = render(<OnboardingTutorial onClose={onClose} />)
    fireEvent.click(container.firstChild as HTMLElement)
    expect(onClose).toHaveBeenCalled()
  })

  it('shows the final "Let\'s Play!" button on the last step', () => {
    render(<OnboardingTutorial onClose={onClose} />)
    // 5 steps total → 4 Nexts to reach final
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByText(/common.next|Let's Play/i))
    expect(screen.getByText(/Let's Play!/i)).toBeInTheDocument()
  })

  it('clicking Let\'s Play closes and marks tutorial completed', () => {
    render(<OnboardingTutorial onClose={onClose} />)
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByText(/common.next|Let's Play/i))
    fireEvent.click(screen.getByText(/Let's Play!/i))
    expect(localStorage.getItem('red-handed-tutorial-completed')).toBe('1')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('supports ArrowRight keyboard shortcut to move forward', () => {
    render(<OnboardingTutorial onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText(/Secret Words & Roles/i)).toBeInTheDocument()
  })

  it('supports ArrowLeft keyboard shortcut to move backward', () => {
    render(<OnboardingTutorial onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText(/Welcome to Red Handed/i)).toBeInTheDocument()
  })

  it('supports Escape key to skip', () => {
    render(<OnboardingTutorial onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
    expect(localStorage.getItem('red-handed-tutorial-completed')).toBe('1')
  })

  it('jumping to a step via a dot navigates directly to it', () => {
    render(<OnboardingTutorial onClose={onClose} />)
    // Dots are buttons with aria-label "Go to step N" — the active one gets
    // w-7 styling instead of w-2, so filter by label, not class name.
    const dotButtons = Array.from({ length: 5 }).map((_, i) =>
      screen.getByLabelText(`Go to step ${i + 1}`),
    )
    expect(dotButtons.length).toBe(5)
    fireEvent.click(dotButtons[2])
    expect(screen.getByText(/Three Phases Per Round/i)).toBeInTheDocument()
  })
})
