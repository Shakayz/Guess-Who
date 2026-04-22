// Menu background music manager — single looping HTMLAudioElement driven by
// localStorage-backed music_enabled / music_volume prefs. The MenuMusic
// component is responsible for calling play/pause as the user navigates
// between menu and game routes.

const MUSIC_SRC = '/music/redhanded.mp3'

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

let audio: HTMLAudioElement | null = null

let musicEnabled =
  typeof window !== 'undefined'
    ? localStorage.getItem('music_enabled') !== 'false'
    : true

let musicVolume = (() => {
  if (typeof window === 'undefined') return 0.4
  const raw = localStorage.getItem('music_volume')
  if (raw === null) return 0.4
  const v = parseFloat(raw)
  return Number.isFinite(v) ? clamp01(v) : 0.4
})()

function getAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (!audio) {
    try {
      audio = new Audio(MUSIC_SRC)
      audio.loop = true
      audio.preload = 'auto'
      audio.volume = musicVolume
    } catch {
      return null
    }
  }
  return audio
}

export const MusicManager = {
  init: () => {
    getAudio()
  },

  isEnabled: () => musicEnabled,

  setEnabled: (enabled: boolean) => {
    musicEnabled = enabled
    if (typeof window !== 'undefined') {
      localStorage.setItem('music_enabled', String(enabled))
    }
    if (!enabled) {
      const a = getAudio()
      if (a) a.pause()
    }
  },

  getVolume: () => musicVolume,

  setVolume: (v: number) => {
    musicVolume = clamp01(v)
    if (typeof window !== 'undefined') {
      localStorage.setItem('music_volume', String(musicVolume))
    }
    const a = getAudio()
    if (a) a.volume = musicVolume
  },

  play: () => {
    if (!musicEnabled) return
    const a = getAudio()
    if (!a) return
    a.volume = musicVolume
    // play() rejects if the user hasn't interacted with the page yet
    // (browser autoplay policy). Swallow — MenuMusic wires a one-shot
    // input listener that calls play() again after first interaction.
    a.play().catch(() => {})
  },

  pause: () => {
    const a = getAudio()
    if (!a) return
    a.pause()
  },
}
