// Web haptics — mirrors the mobile `HapticManager` API so call sites can be
// shared one-for-one between platforms. Uses the Vibration API where
// available (supported on most Android browsers; silently no-ops on desktop
// and iOS Safari). Respects a persisted user preference in localStorage.

export type HapticKind =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error'
  | 'selection'

const STORAGE_KEY = 'haptics_enabled'

let hapticsEnabled =
  typeof window !== 'undefined'
    ? localStorage.getItem(STORAGE_KEY) !== 'false'
    : true

function vibrate(pattern: number | number[]): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return false
  }
  try {
    return navigator.vibrate(pattern)
  } catch {
    return false
  }
}

/**
 * Patterns chosen to roughly match the feel of expo-haptics on Android:
 *  - light   : a single quick tap
 *  - medium  : a firmer single tap
 *  - heavy   : a long firm press
 *  - success : two short pulses (confirmation)
 *  - warning : one short + one longer pulse
 *  - error   : three short punchy pulses
 *  - selection: a very short tick
 */
const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  success: [15, 40, 15],
  warning: [20, 60, 40],
  error: [30, 40, 30, 40, 30],
  selection: 5,
}

export const HapticManager = {
  isEnabled: () => hapticsEnabled,

  setEnabled: (enabled: boolean) => {
    hapticsEnabled = enabled
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(enabled))
    }
  },

  /** Returns true if the browser exposes `navigator.vibrate`. */
  isSupported: () =>
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function',

  trigger: (kind: HapticKind): boolean => {
    if (!hapticsEnabled) return false
    return vibrate(PATTERNS[kind])
  },

  light: () => HapticManager.trigger('light'),
  medium: () => HapticManager.trigger('medium'),
  heavy: () => HapticManager.trigger('heavy'),
  success: () => HapticManager.trigger('success'),
  warning: () => HapticManager.trigger('warning'),
  error: () => HapticManager.trigger('error'),
  selection: () => HapticManager.trigger('selection'),
}
