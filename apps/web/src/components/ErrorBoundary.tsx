import React from 'react'

interface State { hasError: boolean; error: Error | null }

// Matches chunk-load errors from dynamic imports across browsers.
const CHUNK_ERROR_REGEX =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i
const RELOAD_FLAG = 'chunk-reload-attempted'

function isChunkLoadError(err: Error | null): boolean {
  if (!err) return false
  return CHUNK_ERROR_REGEX.test(err.message || '')
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode; fallback?: React.ReactNode }, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)

    // Safety net: if a stale dynamic import slips past lazyWithRetry (e.g. a
    // nested lazy() inside a page), recover by forcing a hard reload once per
    // session. This matches the behavior of lazyWithRetry so the user never
    // sees "Failed to fetch dynamically imported module" twice in a row.
    if (isChunkLoadError(error)) {
      let alreadyReloaded = false
      try { alreadyReloaded = !!sessionStorage.getItem(RELOAD_FLAG) } catch {}
      if (!alreadyReloaded) {
        try { sessionStorage.setItem(RELOAD_FLAG, String(Date.now())) } catch {}
        window.location.reload()
      }
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      // While a chunk-error reload is in flight, show a neutral spinner
      // instead of the scary error card — the page is about to refresh.
      if (isChunkLoadError(this.state.error)) {
        let alreadyReloaded = false
        try { alreadyReloaded = !!sessionStorage.getItem(RELOAD_FLAG) } catch {}
        if (alreadyReloaded) {
          // Reload already happened and still failed — fall through to the
          // regular error UI so the user can try manually.
        } else {
          return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-violet-600 border-t-transparent animate-spin" />
            </div>
          )
        }
      }
      return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
          <div role="alert" className="bg-neutral-900 border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
            <div className="text-4xl mb-4">💥</div>
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-neutral-400 mb-6 text-sm">{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button
              onClick={() => {
                // Always clear the reload flag on a manual reload so the next
                // chunk error can trigger the auto-recovery again.
                try { sessionStorage.removeItem(RELOAD_FLAG) } catch {}
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-semibold transition"
            >
              Reload App
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
