import React, { Suspense } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { lazyWithRetry } from '../../lib/lazyWithRetry'

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function DummyPage() {
  return <div data-testid="lazy-loaded">Hello</div>
}

describe('lazyWithRetry', () => {
  it('resolves successfully on the first try', async () => {
    const factory = vi.fn(async () => ({ default: DummyPage }))
    const Lazy = lazyWithRetry(factory)

    render(
      <Suspense fallback={<div>loading</div>}>
        <Lazy />
      </Suspense>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('lazy-loaded')).toBeInTheDocument()
    })
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('clears the reload flag on a successful import', async () => {
    sessionStorage.setItem('chunk-reload-attempted', '1')
    const factory = vi.fn(async () => ({ default: DummyPage }))
    const Lazy = lazyWithRetry(factory)

    render(
      <Suspense fallback={<div>loading</div>}>
        <Lazy />
      </Suspense>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('lazy-loaded')).toBeInTheDocument()
    })
    expect(sessionStorage.getItem('chunk-reload-attempted')).toBeNull()
  })

  it('retries once on a chunk-load error then succeeds', async () => {
    let call = 0
    const factory = vi.fn(async () => {
      call += 1
      if (call === 1) throw new Error('Failed to fetch dynamically imported module')
      return { default: DummyPage }
    })
    const Lazy = lazyWithRetry(factory)

    render(
      <Suspense fallback={<div>loading</div>}>
        <Lazy />
      </Suspense>,
    )

    await waitFor(
      () => {
        expect(screen.getByTestId('lazy-loaded')).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('forces a hard reload when both attempts fail with chunk errors', async () => {
    const reloadSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { reload: reloadSpy },
      writable: true,
      configurable: true,
    })

    const factory = vi.fn(async () => {
      throw new Error('error loading dynamically imported module')
    })
    const Lazy = lazyWithRetry(factory)

    render(
      <Suspense fallback={<div>loading</div>}>
        <Lazy />
      </Suspense>,
    )

    await waitFor(
      () => {
        expect(reloadSpy).toHaveBeenCalled()
      },
      { timeout: 2000 },
    )
    expect(sessionStorage.getItem('chunk-reload-attempted')).not.toBeNull()
  })

  it('rethrows non-chunk errors immediately', async () => {
    // Suppress React's noisy error logs for this negative test.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const factory = vi.fn(async () => {
      throw new Error('unrelated bug')
    })
    const Lazy = lazyWithRetry(factory)

    class Catcher extends React.Component<{ children: React.ReactNode }, { caught?: Error }> {
      state: { caught?: Error } = {}
      static getDerivedStateFromError(err: Error) {
        return { caught: err }
      }
      render() {
        if (this.state.caught) return <div data-testid="caught">{this.state.caught.message}</div>
        return this.props.children
      }
    }

    render(
      <Catcher>
        <Suspense fallback={<div>loading</div>}>
          <Lazy />
        </Suspense>
      </Catcher>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('caught').textContent).toBe('unrelated bug')
    })
    expect(factory).toHaveBeenCalledTimes(1)
    errSpy.mockRestore()
  })
})
