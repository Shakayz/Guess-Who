import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('applies primary variant classes by default', () => {
    render(<Button>Primary</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-violet-600')
  })

  it('applies secondary variant classes', () => {
    render(<Button variant="secondary">Secondary</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-neutral-800')
  })

  it('applies danger variant classes', () => {
    render(<Button variant="danger">Danger</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-red-600')
  })

  it('applies sm size classes', () => {
    render(<Button size="sm">Small</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('px-3')
    expect(btn.className).toContain('py-1.5')
    expect(btn.className).toContain('text-sm')
  })

  it('applies md size classes by default', () => {
    render(<Button>Medium</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('px-5')
    expect(btn.className).toContain('py-2.5')
    expect(btn.className).toContain('text-base')
  })

  it('applies lg size classes', () => {
    render(<Button size="lg">Large</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('px-7')
    expect(btn.className).toContain('py-3.5')
    expect(btn.className).toContain('text-lg')
  })

  it('shows spinner when loading', () => {
    render(<Button loading>Loading</Button>)
    const svg = screen.getByRole('button').querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg!.getAttribute('class')).toContain('animate-spin')
  })

  it('is disabled when loading', () => {
    render(<Button loading>Loading</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('applies fullWidth class', () => {
    render(<Button fullWidth>Full</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('w-full')
  })

  it('calls onClick handler', () => {
    const handler = vi.fn()
    render(<Button onClick={handler}>Click</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('does not call onClick when disabled', () => {
    const handler = vi.fn()
    render(<Button disabled onClick={handler}>Click</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(handler).not.toHaveBeenCalled()
  })
})
