// Mobile sound manager using expo-av
//
// Sounds are synthesized on-device as multi-voice WAV data URIs — each
// sound is a layered recipe of oscillators (sine / triangle / square /
// sawtooth / noise) with ADSR envelopes, optional frequency sweeps,
// harmonics, and vibrato. Rendered WAVs are cached, so the first play
// of a sound is ~5-15ms and every subsequent play is just an Audio.Sound
// instantiation against a ready URI.
//
// The public API (SoundManager.play / init / setEnabled / isEnabled) is
// unchanged — existing call sites don't need updates.

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
  | 'coin'
  | 'stamp'
  | 'achievement'
  | 'whoosh'
  | 'countdown_final'

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

let soundEnabled = true
let soundVolume = 1
let initialized = false

let Audio: any = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Audio = require('expo-av').Audio
} catch {
  // expo-av not installed — sounds will be silently skipped
}

// Cache rendered WAV data URIs so we only synthesize each sound once.
const uriCache = new Map<SoundType, string>()

export const SoundManager = {
  isEnabled: () => soundEnabled,

  setEnabled: async (enabled: boolean) => {
    soundEnabled = enabled
    await AsyncStorage.setItem('sound_enabled', String(enabled))
  },

  getVolume: () => soundVolume,

  setVolume: async (v: number) => {
    soundVolume = clamp01(v)
    await AsyncStorage.setItem('sound_volume', String(soundVolume))
  },

  init: async () => {
    if (initialized) return
    initialized = true
    try {
      const stored = await AsyncStorage.getItem('sound_enabled')
      if (stored !== null) soundEnabled = stored !== 'false'
      const vol = await AsyncStorage.getItem('sound_volume')
      if (vol !== null) {
        const parsed = parseFloat(vol)
        if (Number.isFinite(parsed)) soundVolume = clamp01(parsed)
      }

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
    if (soundVolume <= 0) return
    if (!Audio) return
    _playMobileSound(sound)
  },
}

async function _playMobileSound(sound: SoundType) {
  if (!Audio) return
  try {
    let uri = uriCache.get(sound)
    if (!uri) {
      const recipe = SOUND_RECIPES[sound]
      if (!recipe) return
      uri = generateWavDataUri(recipe.voices, recipe.duration)
      uriCache.set(sound, uri)
    }
    const { sound: avSound } = await Audio.Sound.createAsync({ uri }, { volume: soundVolume })
    await avSound.playAsync()
    avSound.setOnPlaybackStatusUpdate((status: any) => {
      if (status.didJustFinish) {
        avSound.unloadAsync().catch(() => {})
      }
    })
  } catch {
    // non-fatal
  }
}

// ============================================================================
// Voice / recipe model
// ============================================================================

type WaveType = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'noise'

interface Voice {
  type: WaveType
  /** Starting frequency (Hz). For noise, used as a simple low-pass cutoff approximation. */
  freq: number
  /** Optional target frequency — linearly swept from `freq` over the note duration. */
  freqEnd?: number
  /** Peak amplitude 0..1 (before global mix normalization). */
  amp: number
  /** Start offset in seconds from the beginning of the sound. */
  start: number
  /** Voice duration in seconds. */
  duration: number
  /** ADSR envelope (all in seconds except sustain which is 0..1). Sensible defaults if omitted. */
  attack?: number
  decay?: number
  sustain?: number
  release?: number
  /** Optional vibrato: rate (Hz) and depth (semitones). */
  vibratoHz?: number
  vibratoSemi?: number
  /** Optional harmonic amplitudes for sine/triangle — array of ratios for H2, H3, H4, ... */
  harmonics?: number[]
}

interface Recipe {
  /** Total rendered length of the sound in seconds. Must be >= max(voice.start + voice.duration). */
  duration: number
  voices: Voice[]
}

// Helper: musical pitch in Hz. Middle C (C4) = 261.63Hz; A4 = 440Hz.
const PITCH: Record<string, number> = {
  C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, Eb5: 622.25, E5: 659.26, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50, D6: 1174.66, E6: 1318.51, G6: 1567.98, C7: 2093.00,
}

// ============================================================================
// Sound recipes — layered, musical, game-feel oriented.
// ============================================================================

const SOUND_RECIPES: Record<SoundType, Recipe> = {
  // Crisp UI click — short triangle pluck with a tiny noise transient.
  click: {
    duration: 0.08,
    voices: [
      { type: 'triangle', freq: 1600, amp: 0.35, start: 0, duration: 0.05, attack: 0.001, decay: 0.04, sustain: 0, release: 0.005 },
      { type: 'noise',    freq: 4000, amp: 0.08, start: 0, duration: 0.015, attack: 0, decay: 0.015, sustain: 0, release: 0 },
    ],
  },

  // Bright ascending major arpeggio C5 → E5 → G5 → C6 with bell-like harmonics.
  success: {
    duration: 0.7,
    voices: [
      { type: 'sine',     freq: PITCH.C5, amp: 0.45, start: 0.00, duration: 0.20, attack: 0.005, decay: 0.18, sustain: 0, release: 0.02, harmonics: [0.35, 0.15] },
      { type: 'sine',     freq: PITCH.E5, amp: 0.45, start: 0.09, duration: 0.22, attack: 0.005, decay: 0.20, sustain: 0, release: 0.02, harmonics: [0.35, 0.15] },
      { type: 'sine',     freq: PITCH.G5, amp: 0.45, start: 0.18, duration: 0.25, attack: 0.005, decay: 0.23, sustain: 0, release: 0.02, harmonics: [0.35, 0.15] },
      { type: 'sine',     freq: PITCH.C6, amp: 0.55, start: 0.27, duration: 0.42, attack: 0.005, decay: 0.40, sustain: 0, release: 0.03, harmonics: [0.30, 0.12, 0.06] },
      { type: 'triangle', freq: PITCH.C6 * 2, amp: 0.10, start: 0.27, duration: 0.30, attack: 0.005, decay: 0.28, sustain: 0, release: 0.02 },
    ],
  },

  // Low dissonant descending buzz — Eb3 + D3 (minor second cluster) on sawtooth.
  error: {
    duration: 0.28,
    voices: [
      { type: 'sawtooth', freq: PITCH.Eb3, freqEnd: PITCH.C3, amp: 0.40, start: 0,    duration: 0.25, attack: 0.005, decay: 0.05, sustain: 0.6, release: 0.18 },
      { type: 'sawtooth', freq: PITCH.D3,  freqEnd: 110,       amp: 0.30, start: 0.02, duration: 0.23, attack: 0.005, decay: 0.05, sustain: 0.6, release: 0.16 },
      { type: 'noise',    freq: 800,       amp: 0.06, start: 0, duration: 0.04, attack: 0, decay: 0.04, sustain: 0, release: 0 },
    ],
  },

  // Two-note chime A5 → D6, triangle with light harmonics.
  notification: {
    duration: 0.45,
    voices: [
      { type: 'triangle', freq: PITCH.A5, amp: 0.45, start: 0.00, duration: 0.22, attack: 0.005, decay: 0.20, sustain: 0, release: 0.02, harmonics: [0.25] },
      { type: 'triangle', freq: PITCH.D6, amp: 0.45, start: 0.12, duration: 0.30, attack: 0.005, decay: 0.28, sustain: 0, release: 0.02, harmonics: [0.25] },
    ],
  },

  // Soft wooden tap — low sine thud + filtered noise snap.
  vote: {
    duration: 0.12,
    voices: [
      { type: 'sine',  freq: 180, freqEnd: 90, amp: 0.35, start: 0, duration: 0.10, attack: 0.001, decay: 0.09, sustain: 0, release: 0.01 },
      { type: 'noise', freq: 2200, amp: 0.10, start: 0, duration: 0.03, attack: 0, decay: 0.03, sustain: 0, release: 0 },
    ],
  },

  // Rising magical sweep with shimmer — 300Hz → 1500Hz, plus a high sparkle layer.
  reveal: {
    duration: 0.7,
    voices: [
      { type: 'sine',     freq: 300,  freqEnd: 1500, amp: 0.40, start: 0,    duration: 0.45, attack: 0.04, decay: 0.10, sustain: 0.7, release: 0.30, harmonics: [0.25, 0.10] },
      { type: 'triangle', freq: 600,  freqEnd: 3000, amp: 0.18, start: 0.05, duration: 0.40, attack: 0.05, decay: 0.10, sustain: 0.5, release: 0.30 },
      { type: 'sine',     freq: PITCH.C6, amp: 0.30, start: 0.42, duration: 0.28, attack: 0.005, decay: 0.25, sustain: 0, release: 0.02, harmonics: [0.3, 0.15] },
    ],
  },

  // Dramatic elimination — sub-bass thud, descending saw growl, noise tail.
  elimination: {
    duration: 0.8,
    voices: [
      { type: 'sine',     freq: 90,  freqEnd: 40, amp: 0.55, start: 0,    duration: 0.35, attack: 0.001, decay: 0.10, sustain: 0.7, release: 0.24 },
      { type: 'sawtooth', freq: 220, freqEnd: 70, amp: 0.35, start: 0.02, duration: 0.45, attack: 0.005, decay: 0.10, sustain: 0.5, release: 0.30, vibratoHz: 6, vibratoSemi: 0.5 },
      { type: 'noise',    freq: 1200, amp: 0.15, start: 0.00, duration: 0.20, attack: 0.005, decay: 0.18, sustain: 0, release: 0.02 },
      { type: 'noise',    freq: 400,  amp: 0.12, start: 0.20, duration: 0.50, attack: 0.05, decay: 0.10, sustain: 0.4, release: 0.35 },
    ],
  },

  // Very short high pluck — used per-second during final countdown.
  timer_tick: {
    duration: 0.04,
    voices: [
      { type: 'triangle', freq: 1900, amp: 0.28, start: 0, duration: 0.03, attack: 0.001, decay: 0.025, sustain: 0, release: 0.004 },
    ],
  },

  // Urgent two-tone beep — 1200Hz then 1500Hz square for alarm feel.
  timer_warning: {
    duration: 0.15,
    voices: [
      { type: 'square', freq: 1200, amp: 0.28, start: 0.00, duration: 0.06, attack: 0.002, decay: 0.01, sustain: 0.7, release: 0.03 },
      { type: 'square', freq: 1500, amp: 0.28, start: 0.07, duration: 0.06, attack: 0.002, decay: 0.01, sustain: 0.7, release: 0.03 },
    ],
  },

  // Fanfare: C5-E5-G5 arpeggio landing on sustained C6 with shimmer.
  game_start: {
    duration: 1.0,
    voices: [
      { type: 'triangle', freq: PITCH.C5, amp: 0.40, start: 0.00, duration: 0.12, attack: 0.005, decay: 0.10, sustain: 0, release: 0.015, harmonics: [0.3] },
      { type: 'triangle', freq: PITCH.E5, amp: 0.40, start: 0.10, duration: 0.12, attack: 0.005, decay: 0.10, sustain: 0, release: 0.015, harmonics: [0.3] },
      { type: 'triangle', freq: PITCH.G5, amp: 0.40, start: 0.20, duration: 0.12, attack: 0.005, decay: 0.10, sustain: 0, release: 0.015, harmonics: [0.3] },
      { type: 'sine',     freq: PITCH.C6, amp: 0.55, start: 0.32, duration: 0.62, attack: 0.01, decay: 0.15, sustain: 0.65, release: 0.45, harmonics: [0.35, 0.15, 0.07] },
      { type: 'sine',     freq: PITCH.E6, amp: 0.30, start: 0.32, duration: 0.60, attack: 0.01, decay: 0.15, sustain: 0.55, release: 0.43 },
      { type: 'sine',     freq: PITCH.G6, amp: 0.18, start: 0.32, duration: 0.55, attack: 0.01, decay: 0.15, sustain: 0.45, release: 0.38 },
    ],
  },

  // End-of-game chord — solemn C major triad with gentle release.
  game_end: {
    duration: 1.0,
    voices: [
      { type: 'sine',     freq: PITCH.C4, amp: 0.40, start: 0, duration: 0.95, attack: 0.08, decay: 0.10, sustain: 0.7, release: 0.60, harmonics: [0.30, 0.12] },
      { type: 'sine',     freq: PITCH.E4, amp: 0.35, start: 0, duration: 0.95, attack: 0.10, decay: 0.12, sustain: 0.7, release: 0.60, harmonics: [0.25, 0.10] },
      { type: 'sine',     freq: PITCH.G4, amp: 0.35, start: 0, duration: 0.95, attack: 0.12, decay: 0.14, sustain: 0.7, release: 0.60, harmonics: [0.25, 0.10] },
      { type: 'triangle', freq: PITCH.C5, amp: 0.22, start: 0.05, duration: 0.85, attack: 0.12, decay: 0.12, sustain: 0.55, release: 0.55 },
    ],
  },

  // Round start: doorbell-like G5 + E5 dyad.
  round_start: {
    duration: 0.5,
    voices: [
      { type: 'sine', freq: PITCH.G5, amp: 0.40, start: 0.00, duration: 0.45, attack: 0.005, decay: 0.15, sustain: 0.4, release: 0.25, harmonics: [0.3, 0.15] },
      { type: 'sine', freq: PITCH.E5, amp: 0.35, start: 0.05, duration: 0.42, attack: 0.005, decay: 0.15, sustain: 0.4, release: 0.25, harmonics: [0.3, 0.15] },
    ],
  },

  // Chat pop — short triangle bloop.
  chat_message: {
    duration: 0.12,
    voices: [
      { type: 'triangle', freq: 600, freqEnd: 900, amp: 0.30, start: 0, duration: 0.10, attack: 0.005, decay: 0.08, sustain: 0, release: 0.012 },
    ],
  },

  // Bright coin jingle — E6 + B5 short, high shimmer.
  coin: {
    duration: 0.35,
    voices: [
      { type: 'sine',     freq: PITCH.E6, amp: 0.35, start: 0.00, duration: 0.15, attack: 0.003, decay: 0.13, sustain: 0, release: 0.015, harmonics: [0.3] },
      { type: 'sine',     freq: PITCH.B5, amp: 0.30, start: 0.06, duration: 0.18, attack: 0.003, decay: 0.16, sustain: 0, release: 0.015, harmonics: [0.3] },
      { type: 'triangle', freq: PITCH.C7, amp: 0.18, start: 0.02, duration: 0.10, attack: 0.002, decay: 0.09, sustain: 0, release: 0.008 },
      { type: 'noise',    freq: 6000, amp: 0.05, start: 0, duration: 0.02, attack: 0, decay: 0.02, sustain: 0, release: 0 },
    ],
  },

  // Victory/defeat stamp — percussive hit + short tonal body.
  stamp: {
    duration: 0.35,
    voices: [
      { type: 'noise',    freq: 2000, amp: 0.35, start: 0, duration: 0.04, attack: 0, decay: 0.04, sustain: 0, release: 0 },
      { type: 'sine',     freq: 140, freqEnd: 80, amp: 0.50, start: 0, duration: 0.20, attack: 0.001, decay: 0.04, sustain: 0.5, release: 0.15 },
      { type: 'triangle', freq: 380, freqEnd: 200, amp: 0.25, start: 0, duration: 0.15, attack: 0.002, decay: 0.04, sustain: 0.4, release: 0.10 },
    ],
  },

  // Achievement unlocked — rising 4-note fanfare with shimmer tail.
  achievement: {
    duration: 1.1,
    voices: [
      { type: 'triangle', freq: PITCH.C5, amp: 0.35, start: 0.00, duration: 0.15, attack: 0.005, decay: 0.13, sustain: 0, release: 0.015 },
      { type: 'triangle', freq: PITCH.E5, amp: 0.35, start: 0.12, duration: 0.15, attack: 0.005, decay: 0.13, sustain: 0, release: 0.015 },
      { type: 'triangle', freq: PITCH.G5, amp: 0.40, start: 0.24, duration: 0.18, attack: 0.005, decay: 0.15, sustain: 0, release: 0.02 },
      { type: 'sine',     freq: PITCH.C6, amp: 0.55, start: 0.38, duration: 0.70, attack: 0.01, decay: 0.20, sustain: 0.55, release: 0.50, harmonics: [0.30, 0.15, 0.08], vibratoHz: 5, vibratoSemi: 0.15 },
      { type: 'sine',     freq: PITCH.E6, amp: 0.30, start: 0.38, duration: 0.70, attack: 0.02, decay: 0.20, sustain: 0.5,  release: 0.50 },
      { type: 'sine',     freq: PITCH.G6, amp: 0.20, start: 0.38, duration: 0.65, attack: 0.03, decay: 0.20, sustain: 0.4,  release: 0.45 },
    ],
  },

  // Whoosh transition — noise sweep from low to mid.
  whoosh: {
    duration: 0.35,
    voices: [
      { type: 'noise',    freq: 400,  amp: 0.30, start: 0,    duration: 0.30, attack: 0.08, decay: 0.08, sustain: 0.5, release: 0.14 },
      { type: 'sawtooth', freq: 200, freqEnd: 800, amp: 0.15, start: 0.02, duration: 0.25, attack: 0.05, decay: 0.05, sustain: 0.5, release: 0.15 },
    ],
  },

  // "3, 2, 1!" final countdown beep — punchier than timer_warning.
  countdown_final: {
    duration: 0.22,
    voices: [
      { type: 'square',   freq: 1000, amp: 0.32, start: 0, duration: 0.12, attack: 0.002, decay: 0.02, sustain: 0.7, release: 0.08 },
      { type: 'triangle', freq: 2000, amp: 0.18, start: 0, duration: 0.10, attack: 0.002, decay: 0.02, sustain: 0.5, release: 0.07 },
      { type: 'noise',    freq: 3000, amp: 0.10, start: 0, duration: 0.02, attack: 0, decay: 0.02, sustain: 0, release: 0 },
    ],
  },
}

// ============================================================================
// WAV synthesis
// ============================================================================

const SAMPLE_RATE = 22050

function generateWavDataUri(voices: Voice[], totalDurationSec: number): string {
  const numSamples = Math.floor(SAMPLE_RATE * totalDurationSec)
  const mix = new Float32Array(numSamples)

  for (const v of voices) {
    renderVoice(v, mix)
  }

  // Normalize + soft clip so layered voices don't exceed [-1, 1].
  let peak = 0
  for (let i = 0; i < numSamples; i++) {
    const a = Math.abs(mix[i])
    if (a > peak) peak = a
  }
  const norm = peak > 0.98 ? 0.98 / peak : 1

  const buffer = new ArrayBuffer(44 + numSamples * 2)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + numSamples * 2, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, numSamples * 2, true)

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, mix[i] * norm))
    view.setInt16(44 + i * 2, Math.round(s * 32767), true)
  }

  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return `data:audio/wav;base64,${btoa(binary)}`
}

function renderVoice(v: Voice, mix: Float32Array) {
  const startSample = Math.floor(v.start * SAMPLE_RATE)
  const lengthSamples = Math.floor(v.duration * SAMPLE_RATE)
  const endSample = Math.min(startSample + lengthSamples, mix.length)

  const attack  = (v.attack  ?? 0.005) * SAMPLE_RATE
  const decay   = (v.decay   ?? 0.05)  * SAMPLE_RATE
  const sustain = v.sustain  ?? 0
  const release = (v.release ?? 0.03)  * SAMPLE_RATE

  const vibRate = v.vibratoHz ?? 0
  const vibSemi = v.vibratoSemi ?? 0

  // Seeded PRNG keeps noise deterministic per render (no audible pop diff between plays).
  let noiseState = 0x7f3c9a1e ^ Math.floor(v.freq) ^ Math.floor(v.amp * 1000)
  const nextNoise = () => {
    noiseState ^= noiseState << 13
    noiseState ^= noiseState >>> 17
    noiseState ^= noiseState << 5
    return ((noiseState | 0) / 0x7fffffff)
  }
  // Simple one-pole low-pass for noise, cutoff ~= v.freq.
  const alpha = Math.min(1, (2 * Math.PI * v.freq) / SAMPLE_RATE)
  let noiseLpf = 0

  let phase = 0

  for (let i = startSample; i < endSample; i++) {
    const nLocal = i - startSample
    const t = nLocal / SAMPLE_RATE

    // ADSR envelope
    let env: number
    const releaseStart = lengthSamples - release
    if (nLocal < attack) {
      env = nLocal / Math.max(1, attack)
    } else if (nLocal < attack + decay) {
      const k = (nLocal - attack) / Math.max(1, decay)
      env = 1 - (1 - sustain) * k
    } else if (nLocal < releaseStart) {
      env = sustain
    } else {
      const k = (nLocal - releaseStart) / Math.max(1, release)
      env = sustain * (1 - Math.min(1, k))
    }
    if (env <= 0) continue

    // Frequency (with optional linear sweep + vibrato)
    const progress = v.duration > 0 ? t / v.duration : 0
    let freq = v.freq
    if (v.freqEnd !== undefined) {
      freq = v.freq + (v.freqEnd - v.freq) * Math.min(1, progress)
    }
    if (vibRate > 0 && vibSemi > 0) {
      const lfo = Math.sin(2 * Math.PI * vibRate * t)
      freq *= Math.pow(2, (lfo * vibSemi) / 12)
    }

    let sample = 0
    const phaseInc = (2 * Math.PI * freq) / SAMPLE_RATE

    switch (v.type) {
      case 'sine':
        sample = Math.sin(phase)
        if (v.harmonics) {
          for (let h = 0; h < v.harmonics.length; h++) {
            sample += v.harmonics[h] * Math.sin(phase * (h + 2))
          }
        }
        break
      case 'triangle': {
        const p = (phase / (2 * Math.PI)) % 1
        sample = 4 * Math.abs(p - 0.5) - 1
        if (v.harmonics) {
          for (let h = 0; h < v.harmonics.length; h++) {
            const q = ((phase * (h + 2)) / (2 * Math.PI)) % 1
            sample += v.harmonics[h] * (4 * Math.abs(q - 0.5) - 1)
          }
        }
        break
      }
      case 'square':
        sample = Math.sin(phase) >= 0 ? 0.9 : -0.9
        break
      case 'sawtooth': {
        const p = (phase / (2 * Math.PI)) % 1
        sample = 2 * p - 1
        break
      }
      case 'noise': {
        noiseLpf += alpha * (nextNoise() - noiseLpf)
        sample = noiseLpf * 1.8
        break
      }
    }

    mix[i] += sample * env * v.amp
    phase += phaseInc
    if (phase > 1e9) phase -= 2 * Math.PI * Math.floor(phase / (2 * Math.PI))
  }
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
