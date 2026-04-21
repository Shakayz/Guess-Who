// Web Audio API sound manager — no external dependencies, no audio files needed

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

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

let audioCtx: AudioContext | null = null

let soundVolume = (() => {
  if (typeof window === 'undefined') return 1
  const raw = localStorage.getItem('sound_volume')
  if (raw === null) return 1
  const v = parseFloat(raw)
  return Number.isFinite(v) ? clamp01(v) : 1
})()

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch {
      return null
    }
  }
  return audioCtx
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.25,
  startTime?: number,
) {
  const ctx = getCtx()
  if (!ctx) return

  const now = startTime ?? ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.frequency.value = frequency
  gain.gain.setValueAtTime(volume * soundVolume, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration)
}

function playFreqRamp(
  freqStart: number,
  freqEnd: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.25,
  startTime?: number,
) {
  const ctx = getCtx()
  if (!ctx) return

  const now = startTime ?? ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(freqStart, now)
  osc.frequency.linearRampToValueAtTime(freqEnd, now + duration)
  gain.gain.setValueAtTime(volume * soundVolume, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration)
}

// Store sound-enabled preference in localStorage
let soundEnabled =
  typeof window !== 'undefined'
    ? localStorage.getItem('sound_enabled') !== 'false'
    : true

export const SoundManager = {
  isEnabled: () => soundEnabled,

  setEnabled: (enabled: boolean) => {
    soundEnabled = enabled
    if (typeof window !== 'undefined') {
      localStorage.setItem('sound_enabled', String(enabled))
    }
  },

  getVolume: () => soundVolume,

  setVolume: (v: number) => {
    soundVolume = clamp01(v)
    if (typeof window !== 'undefined') {
      localStorage.setItem('sound_volume', String(soundVolume))
    }
  },

  play: (sound: SoundType) => {
    if (!soundEnabled) return
    if (soundVolume <= 0) return
    const ctx = getCtx()
    if (!ctx) return
    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    switch (sound) {
      // Short UI click — high freq sine, 50ms
      case 'click':
        playTone(1200, 0.05, 'sine', 0.15)
        break

      // Ascending two-tone — success
      case 'success':
        playTone(523, 0.1, 'sine', 0.25)
        playTone(784, 0.12, 'sine', 0.25, ctx.currentTime + 0.1)
        break

      // Descending buzz — error
      case 'error':
        playFreqRamp(400, 180, 0.15, 'sawtooth', 0.2)
        break

      // Pleasant chime — notification
      case 'notification':
        playTone(880, 0.12, 'sine', 0.2)
        playTone(1100, 0.12, 'sine', 0.2, ctx.currentTime + 0.1)
        playTone(1320, 0.15, 'sine', 0.2, ctx.currentTime + 0.2)
        break

      // Soft thud — vote
      case 'vote':
        playFreqRamp(220, 80, 0.1, 'sine', 0.3)
        break

      // Dramatic rising tone — reveal
      case 'reveal':
        playFreqRamp(220, 880, 0.45, 'sine', 0.2)
        playTone(880, 0.1, 'sine', 0.3, ctx.currentTime + 0.45)
        break

      // Low dramatic hit — elimination
      case 'elimination':
        playFreqRamp(300, 60, 0.3, 'sawtooth', 0.3)
        playTone(55, 0.2, 'sine', 0.25, ctx.currentTime + 0.2)
        break

      // Subtle tick — timer_tick
      case 'timer_tick':
        playTone(800, 0.03, 'square', 0.1)
        break

      // Faster urgent tick — timer_warning
      case 'timer_warning':
        playTone(1000, 0.04, 'square', 0.15)
        break

      // Fanfare-like ascending scale — game_start (6 notes over 600ms)
      case 'game_start': {
        const scale = [261, 329, 392, 523, 659, 784]
        scale.forEach((freq, i) => {
          playTone(freq, 0.12, 'sine', 0.25, ctx.currentTime + i * 0.1)
        })
        break
      }

      // Conclusion sound — game_end (descending gentle chord)
      case 'game_end':
        playTone(784, 0.2, 'sine', 0.2)
        playTone(659, 0.2, 'sine', 0.15, ctx.currentTime + 0.15)
        playTone(523, 0.25, 'sine', 0.2, ctx.currentTime + 0.3)
        break

      // Brief attention sound — round_start
      case 'round_start':
        playTone(440, 0.08, 'sine', 0.2)
        playTone(660, 0.12, 'sine', 0.25, ctx.currentTime + 0.08)
        break

      // Soft pop — chat_message
      case 'chat_message':
        playFreqRamp(600, 400, 0.08, 'sine', 0.12)
        break
    }
  },
}
