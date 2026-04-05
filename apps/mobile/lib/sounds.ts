// Mobile sound manager using expo-av
// Sounds are short programmatic audio — expo-av manages audio session.

import AsyncStorage from '@react-native-async-storage/async-storage'

export type SoundType =
  | 'click'
  | 'success'
  | 'error'
  | 'notification'
  | 'vote'
  | 'reveal'
  | 'elimination'
  | 'timer_tick'
  | 'timer_warning'
  | 'game_start'
  | 'game_end'
  | 'round_start'
  | 'chat_message'

let soundEnabled = true
let initialized = false

// Attempt to import expo-av — gracefully no-op if not available
let Audio: any = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Audio = require('expo-av').Audio
} catch {
  // expo-av not installed — sounds will be silently skipped
}

export const SoundManager = {
  isEnabled: () => soundEnabled,

  setEnabled: async (enabled: boolean) => {
    soundEnabled = enabled
    await AsyncStorage.setItem('sound_enabled', String(enabled))
  },

  init: async () => {
    if (initialized) return
    initialized = true
    try {
      const stored = await AsyncStorage.getItem('sound_enabled')
      if (stored !== null) soundEnabled = stored !== 'false'

      if (Audio) {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: false,
          staysActiveInBackground: false,
        })
      }
    } catch {
      // non-fatal
    }
  },

  play: (sound: SoundType) => {
    if (!soundEnabled) return
    if (!Audio) return

    // On mobile we use a minimal beep approach via Audio.Sound with a
    // generated data URI for common event feedback.
    // For now, different event categories map to distinct beep patterns
    // using the system's built-in capabilities.
    // The most impactful feedback is kept for key game moments.
    _playMobileSound(sound)
  },
}

/**
 * Play a mobile sound using expo-av.
 * We encode tiny WAV files inline (base64) for each sound category
 * to avoid bundling external audio files.
 */
async function _playMobileSound(sound: SoundType) {
  if (!Audio) return
  try {
    // Map sounds to short frequency/duration parameters
    // We generate a simple WAV tone on-the-fly using a data URI.
    const params = getSoundParams(sound)
    if (!params) return

    const wav = generateWavDataUri(params.freq, params.duration, params.volume)
    const { sound: avSound } = await Audio.Sound.createAsync({ uri: wav })
    await avSound.playAsync()
    // Unload after playback to free memory
    avSound.setOnPlaybackStatusUpdate((status: any) => {
      if (status.didJustFinish) {
        avSound.unloadAsync().catch(() => {})
      }
    })
  } catch {
    // non-fatal — audio failure should never crash the app
  }
}

interface SoundParams {
  freq: number
  duration: number // seconds
  volume: number // 0-1
}

function getSoundParams(sound: SoundType): SoundParams | null {
  switch (sound) {
    case 'click':         return { freq: 1200, duration: 0.05, volume: 0.4 }
    case 'success':       return { freq: 784,  duration: 0.2,  volume: 0.5 }
    case 'error':         return { freq: 220,  duration: 0.15, volume: 0.4 }
    case 'notification':  return { freq: 880,  duration: 0.25, volume: 0.45 }
    case 'vote':          return { freq: 330,  duration: 0.1,  volume: 0.4 }
    case 'reveal':        return { freq: 660,  duration: 0.4,  volume: 0.5 }
    case 'elimination':   return { freq: 110,  duration: 0.35, volume: 0.5 }
    case 'timer_tick':    return { freq: 800,  duration: 0.03, volume: 0.3 }
    case 'timer_warning': return { freq: 1000, duration: 0.04, volume: 0.35 }
    case 'game_start':    return { freq: 523,  duration: 0.5,  volume: 0.5 }
    case 'game_end':      return { freq: 392,  duration: 0.4,  volume: 0.45 }
    case 'round_start':   return { freq: 440,  duration: 0.18, volume: 0.45 }
    case 'chat_message':  return { freq: 600,  duration: 0.08, volume: 0.3 }
    default:              return null
  }
}

/**
 * Generate a minimal WAV data URI for a pure sine tone.
 * Returns a base64-encoded WAV suitable for expo-av.
 */
function generateWavDataUri(freq: number, durationSec: number, amplitude: number): string {
  const sampleRate = 22050
  const numSamples = Math.floor(sampleRate * durationSec)
  const dataLength = numSamples * 2 // 16-bit PCM
  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)      // PCM chunk size
  view.setUint16(20, 1, true)       // PCM format
  view.setUint16(22, 1, true)       // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true)       // block align
  view.setUint16(34, 16, true)      // bits per sample
  writeString(view, 36, 'data')
  view.setUint32(40, dataLength, true)

  const maxVal = 32767 * Math.min(1, Math.max(0, amplitude))
  for (let i = 0; i < numSamples; i++) {
    // Apply a simple envelope: fade in first 10%, fade out last 20%
    let env = 1
    const pos = i / numSamples
    if (pos < 0.1) env = pos / 0.1
    else if (pos > 0.8) env = (1 - pos) / 0.2

    const sample = Math.round(Math.sin((2 * Math.PI * freq * i) / sampleRate) * maxVal * env)
    view.setInt16(44 + i * 2, sample, true)
  }

  // Convert to base64
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)
  return `data:audio/wav;base64,${base64}`
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
