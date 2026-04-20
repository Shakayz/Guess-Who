// Threshold for showing ads. Kept in code only — never surfaced in UI.
const ADS_MIN_LEVEL = 3

export const ADSENSE_CLIENT = (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined) ?? ''
export const ADSENSE_INTERSTITIAL_SLOT =
  (import.meta.env.VITE_ADSENSE_INTERSTITIAL_SLOT as string | undefined) ?? ''

export function adsConfigured(): boolean {
  return !!ADSENSE_CLIENT && !!ADSENSE_INTERSTITIAL_SLOT
}

export function shouldShowAd(opts: { level?: number | null; isPremium?: boolean | null }): boolean {
  if (opts.isPremium) return false
  return (opts.level ?? 0) >= ADS_MIN_LEVEL
}

let scriptInjected = false
/** Idempotent — call before mounting an interstitial slot. No-ops without env. */
export function ensureAdSenseScript(): void {
  if (scriptInjected || !ADSENSE_CLIENT || typeof document === 'undefined') return
  scriptInjected = true
  const s = document.createElement('script')
  s.async = true
  s.crossOrigin = 'anonymous'
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`
  document.head.appendChild(s)
}
