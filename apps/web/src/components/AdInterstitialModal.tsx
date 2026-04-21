import { useEffect, useState } from 'react'
import { ADSENSE_CLIENT, ADSENSE_INTERSTITIAL_SLOT, adsConfigured, ensureAdSenseScript } from '../lib/ads'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

const SKIP_DELAY_MS = 5000

export function AdInterstitialModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [skippable, setSkippable] = useState(false)

  useEffect(() => {
    if (!open) return
    setSkippable(false)
    const t = setTimeout(() => setSkippable(true), SKIP_DELAY_MS)

    if (adsConfigured()) {
      ensureAdSenseScript()
      try {
        ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      } catch {
        // adsbygoogle.js may not have loaded yet — modal still renders the slot
        // and AdSense will hydrate it when the script arrives.
      }
    }

    return () => clearTimeout(t)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-4 shadow-2xl">
        <button
          type="button"
          aria-label="Close"
          disabled={!skippable}
          onClick={onClose}
          className={`absolute -top-2 -right-2 h-8 w-8 rounded-full border text-sm font-bold transition-colors ${
            skippable
              ? 'border-neutral-700 bg-neutral-900 text-white hover:bg-neutral-800'
              : 'border-neutral-800 bg-neutral-900/70 text-neutral-600 cursor-not-allowed'
          }`}
        >
          ✕
        </button>

        <div className="flex min-h-[280px] w-full items-center justify-center overflow-hidden rounded-xl bg-neutral-900">
          {adsConfigured() ? (
            <ins
              className="adsbygoogle"
              style={{ display: 'block', width: '100%', minHeight: 280 }}
              data-ad-client={ADSENSE_CLIENT}
              data-ad-slot={ADSENSE_INTERSTITIAL_SLOT}
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          ) : (
            <span className="text-xs text-neutral-600">Advertisement</span>
          )}
        </div>

        {!skippable && (
          <p className="mt-3 text-center text-[11px] uppercase tracking-widest text-neutral-600">
            Continuing in a moment…
          </p>
        )}
      </div>
    </div>
  )
}
