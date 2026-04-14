import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { ErrorBoundary } from '../../components/ErrorBoundary'

function ThrowOnRender({ err }: { err: Error }): JSX.Element {
  throw err
}

describe('ErrorBoundary', () => {
  let errSpy: ReturnType<typeof vi.spyOn>
  let reloadSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Suppress the React console.error that fires when an error is thrown.
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    sessionStorage.clear()
    reloadSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { reload: reloadSpy },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    errSpy.mockRestore()
  })

  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">ok</div>
      </ErrorBoundary>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders the fallback UI when a generic error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender err={new Error('generic boom')} />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
    expect(screen.getByText('generic boom')).toBeInTheDocument()
    expect(screen.getByText(/Reload App/i)).toBeInTheDocument()
  })

  it('uses a user-provided fallback if given', () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom">custom fallback</div>}>
        <ThrowOnRender err={new Error('any')} />
      </ErrorBoundary>,
    )
    expect(screen.getByTestId('custom')).toBeInTheDocument()
  })

  it('shows a spinner and triggers a hard reload on chunk-load errors', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender err={new Error('Failed to fetch dynamically imported module foo.js')} />
      </ErrorBoundary>,
    )
    // Reload requested exactly once
    expect(reloadSpy).toHaveBeenCalledTimes(1)
    // While the reload is in flight, the scary error card must NOT render.
    expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument()
    expect(sessionStorage.getItem('chunk-reload-attempted')).not.toBeNull()
  })

  it('falls through to the error card if chunk reload already happened', () => {
    sessionStorage.setItem('chunk-reload-attempted', '1')
    render(
      <ErrorBoundary>
        <ThrowOnRender err={new Error('Importing a module script failed')} />
      </ErrorBoundary>,
    )
    expect(reloadSpy).not.toHaveBeenCalled()
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
  })

  it('Reload App button clears the flag and reloads', () => {
    // Use a non-chunk error so clicking "Reload App" on the recovered tree
    // doesn't re-trigger the chunk-auto-reload path (which would reload again).
    render(
      <ErrorBoundary>
        <ThrowOnRender err={new Error('generic boom')} />
      </ErrorBoundary>,
    )
    sessionStorage.setItem('chunk-reload-attempted', '1')
    fireEvent.click(screen.getByText(/Reload App/i))
    expect(reloadSpy).toHaveBeenCalled()
    expect(sessionStorage.getItem('chunk-reload-attempted')).toBeNull()
  })

  it('uses a default fallback message when the error has no message', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender err={new Error('')} />
      </ErrorBoundary>,
    )
    expect(screen.getByText(/An unexpected error occurred/i)).toBeInTheDocument()
  })
})
