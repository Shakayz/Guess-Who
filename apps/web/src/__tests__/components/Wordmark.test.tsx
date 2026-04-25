/**
 * Wordmark.test.tsx
 *
 * The "Red Handed !" wordmark is the inline HTML alternative to the
 * <img alt="Red Handed !"> brand lockup, used in places where the SVG/PNG
 * isn't appropriate (auth hero, navbar fallback, etc.). Two layouts —
 * inline (single line) and stacked (two lines, for hero) — and the size
 * prop is passed through as a CSS font-size.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Wordmark } from '../../components/Wordmark'

describe('Wordmark', () => {
  it('renders the brand text and exposes it via aria-label for screen-readers', () => {
    render(<Wordmark />)
    expect(screen.getByLabelText('Red Handed !')).toBeInTheDocument()
  })

  it('inline layout (default) renders the brand on a single line', () => {
    const { container } = render(<Wordmark />)
    const root = container.querySelector('span[aria-label="Red Handed !"]') as HTMLElement
    expect(root.className).toContain('whitespace-nowrap')
    expect(root.textContent).toBe('Red Handed !')
  })

  it('stacked layout splits the brand across two lines', () => {
    const { container } = render(<Wordmark layout="stacked" />)
    const root = container.querySelector('span[aria-label="Red Handed !"]') as HTMLElement
    expect(root.className).toContain('inline-flex')
    expect(root.className).toContain('flex-col')
    // First line is just "Red", second line is "Handed !"
    const lines = Array.from(root.children) as HTMLElement[]
    expect(lines.length).toBe(2)
    expect(lines[0].textContent).toBe('Red')
    expect(lines[1].textContent).toBe('Handed !')
  })

  it('numeric size is converted to px', () => {
    const { container } = render(<Wordmark size={48} />)
    const root = container.querySelector('span[aria-label="Red Handed !"]') as HTMLElement
    expect(root.style.fontSize).toBe('48px')
  })

  it('string size is passed through as-is (so callers can supply rem, em, etc.)', () => {
    const { container } = render(<Wordmark size="3rem" />)
    const root = container.querySelector('span[aria-label="Red Handed !"]') as HTMLElement
    expect(root.style.fontSize).toBe('3rem')
  })

  it('omits font-size when size is not provided (inherits from the parent)', () => {
    const { container } = render(<Wordmark />)
    const root = container.querySelector('span[aria-label="Red Handed !"]') as HTMLElement
    expect(root.style.fontSize).toBe('')
  })

  it('appends the className prop after the layout-specific classes', () => {
    const { container } = render(<Wordmark className="my-custom-class" />)
    const root = container.querySelector('span[aria-label="Red Handed !"]') as HTMLElement
    expect(root.className).toContain('my-custom-class')
  })

  it('uses the brand red (#dc2626) for the main text and a darker shade (#b91c1c) for the bang', () => {
    const { container } = render(<Wordmark />)
    const root = container.querySelector('span[aria-label="Red Handed !"]') as HTMLElement
    expect(root.style.color).toBe('rgb(220, 38, 38)')
    // The "!" lives inside an inner span with its own color.
    const bang = root.querySelector('span') as HTMLElement
    expect(bang.style.color).toBe('rgb(185, 28, 28)')
  })
})
