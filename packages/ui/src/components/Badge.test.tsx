import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Badge } from './Badge'

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>New</Badge>)
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  it('applies default variant classes', () => {
    render(<Badge>Default</Badge>)
    const badge = screen.getByText('Default')
    expect(badge.className).toContain('bg-neutral-800')
    expect(badge.className).toContain('text-neutral-300')
  })

  it('applies success variant classes', () => {
    render(<Badge variant="success">Success</Badge>)
    const badge = screen.getByText('Success')
    expect(badge.className).toContain('bg-emerald-900/60')
    expect(badge.className).toContain('text-emerald-400')
  })

  it('applies danger variant classes', () => {
    render(<Badge variant="danger">Danger</Badge>)
    const badge = screen.getByText('Danger')
    expect(badge.className).toContain('bg-red-900/60')
    expect(badge.className).toContain('text-red-400')
  })

  it('merges custom className', () => {
    render(<Badge className="my-custom-class">Custom</Badge>)
    const badge = screen.getByText('Custom')
    expect(badge.className).toContain('my-custom-class')
    // Should still have base classes
    expect(badge.className).toContain('inline-flex')
  })
})
