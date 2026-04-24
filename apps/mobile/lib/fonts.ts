import { Platform } from 'react-native'

/**
 * Font family used by the "Red Handed !" wordmark. Web uses Playfair Display
 * (heavy italic serif). On mobile we currently fall back to the nearest
 * platform serif until the @expo-google-fonts/playfair-display package is
 * installed — swap WORDMARK_FONT for 'PlayfairDisplay_900Black_Italic'
 * once the font is loaded in lib/fonts.ts and the dependency is added.
 */
export const WORDMARK_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
})!

/**
 * Root layout calls this to decide whether to hold the splash for font
 * loading. With the system-serif fallback in place, fonts are always ready
 * immediately. When Playfair Display is wired, return the actual loader.
 */
export function useBrandFonts() {
  return { loaded: true, error: null as Error | null }
}
