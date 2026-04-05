import React from 'react'

interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode; fallback?: React.ReactNode }, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
          <div className="bg-neutral-900 border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
            <div className="text-4xl mb-4">💥</div>
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-neutral-400 mb-6 text-sm">{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
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
