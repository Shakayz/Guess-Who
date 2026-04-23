// Menu background music manager for mobile. Uses expo-av's Audio.Sound with
// a bundled asset, preference-driven volume, and lazy loading. MenuMusic
// component drives play/pause based on route + AppState.

import AsyncStorage from '@react-native-async-storage/async-storage'

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

let musicEnabled = true
let musicVolume = 0.4
let initialized = false
let sound: any = null
let loading: Promise<void> | null = null

async function loadPrefs() {
  try {
    const [e, v] = await Promise.all([
      AsyncStorage.getItem('music_enabled'),
      AsyncStorage.getItem('music_volume'),
    ])
    if (e !== null) musicEnabled = e !== 'false'
    if (v !== null) {
      const parsed = parseFloat(v)
      if (Number.isFinite(parsed)) musicVolume = clamp01(parsed)
    }
  } catch {}
}

async function ensureLoaded() {
  if (sound) return
  if (loading) return loading
  loading = (async () => {
    try {
      // Lazy-require so the module is safe to import on web.
      const { Audio } = require('expo-av')
      const s = new Audio.Sound()
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const asset = require('../assets/music/redhanded.mp3')
      await s.loadAsync(asset, {
        isLooping: true,
        volume: musicVolume,
        shouldPlay: false,
      })
      sound = s
    } catch {
      // expo-av not installed on web / asset missing — silently no-op.
      sound = null
    } finally {
      loading = null
    }
  })()
  return loading
}

export const MusicManager = {
  init: async () => {
    if (initialized) return
    initialized = true
    await loadPrefs()
    await ensureLoaded()
  },

  isEnabled: () => musicEnabled,

  setEnabled: async (enabled: boolean) => {
    musicEnabled = enabled
    try {
      await AsyncStorage.setItem('music_enabled', String(enabled))
    } catch {}
    if (!enabled && sound) {
      try {
        await sound.pauseAsync()
      } catch {}
    }
  },

  getVolume: () => musicVolume,

  setVolume: async (v: number) => {
    musicVolume = clamp01(v)
    try {
      await AsyncStorage.setItem('music_volume', String(musicVolume))
    } catch {}
    if (sound) {
      try {
        await sound.setVolumeAsync(musicVolume)
      } catch {}
    }
  },

  play: async () => {
    if (!musicEnabled) return
    await ensureLoaded()
    if (!sound) return
    try {
      await sound.setVolumeAsync(musicVolume)
      await sound.playAsync()
    } catch {}
  },

  pause: async () => {
    if (!sound) return
    try {
      await sound.pauseAsync()
    } catch {}
  },
}
