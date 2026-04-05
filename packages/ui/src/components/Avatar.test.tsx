import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Avatar } from './Avatar'

describe('Avatar', () => {
  it('renders an img when src is provided', () => {
    render(<Avatar src="https://example.com/avatar.png" username="alice" />)
    const img = screen.getByRole('img')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.png')
    expect(img).toHaveAttribute('alt', 'alice')
  })

  it('renders initials when src is null', () => {
    render(<Avatar src={null} username="alice" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('AL')).toBeInTheDocument()
  })

  it('renders initials when src is omitted', () => {
    render(<Avatar username="Bob" />)
    expect(screen.getByText('BO')).toBeInTheDocument()
  })

  it('renders only first 2 characters uppercased as initials', () => {
    render(<Avatar username="charlie" />)
    expect(screen.getByText('CH')).toBeInTheDocument()
  })

  it('applies xs size classes', () => {
    render(<Avatar username="alice" size="xs" />)
    const el = screen.getByText('AL')
    expect(el.className).toContain('w-6')
    expect(el.className).toContain('h-6')
  })

  it('applies md size classes by default', () => {
    render(<Avatar username="alice" />)
    const el = screen.getByText('AL')
    expect(el.className).toContain('w-10')
    expect(el.className).toContain('h-10')
  })

  it('applies lg size classes', () => {
    render(<Avatar username="alice" size="lg" />)
    const el = screen.getByText('AL')
    expect(el.className).toContain('w-14')
    expect(el.className).toContain('h-14')
  })

  it('applies xl size classes to image', () => {
    render(<Avatar src="https://example.com/avatar.png" username="alice" size="xl" />)
    const img = screen.getByRole('img')
    expect(img.className).toContain('w-20')
    expect(img.className).toContain('h-20')
  })

  it('applies a background color class derived from username', () => {
    render(<Avatar username="alice" />)
    const el = screen.getByText('AL')
    // The color is one of the predefined Tailwind classes
    const colorClasses = ['bg-violet-600', 'bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-cyan-600']
    const hasColor = colorClasses.some((c) => el.className.includes(c))
    expect(hasColor).toBe(true)
  })

  it('passes extra className to the element', () => {
    render(<Avatar username="alice" className="my-custom-class" />)
    const el = screen.getByText('AL')
    expect(el.className).toContain('my-custom-class')
  })
})
