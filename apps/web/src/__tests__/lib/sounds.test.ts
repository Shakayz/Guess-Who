import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Build a minimal stub of Web Audio's AudioContext that records every call.
function makeFakeAudioContext() {
  const oscillators: any[] = []
  const gains: any[] = []
  const createOscillator = vi.fn(() => {
    const osc = {
      type: '',
      frequency: {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
    oscillators.push(osc)
    return osc
  })
  const createGain = vi.fn(() => {
    const gain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }
    gains.push(gain)
    return gain
  })
  const ctx = {
    currentTime: 0,
    destination: {},
    state: 'running' as 'running' | 'suspended',
    resume: vi.fn().mockResolvedValue(undefined),
    createOscillator,
    createGain,
  }
  return { ctx, oscillators, gains }
}

let fake: ReturnType<typeof makeFakeAudioContext>
let AudioContextSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fake = makeFakeAudioContext()
  AudioContextSpy = vi.fn(() => fake.ctx)
  ;(window as any).AudioContext = AudioContextSpy
  ;(window as any).webkitAudioContext = AudioContextSpy
  localStorage.clear()
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SoundManager.isEnabled / setEnabled', () => {
  it('defaults to enabled when no localStorage value set', async () => {
    const { SoundManager } = await import('../../lib/sounds')
    expect(SoundManager.isEnabled()).toBe(true)
  })

  it('reads a persisted disabled flag from localStorage', async () => {
    localStorage.setItem('sound_enabled', 'false')
    const { SoundManager } = await import('../../lib/sounds')
    expect(SoundManager.isEnabled()).toBe(false)
  })

  it('setEnabled persists the flag to localStorage', async () => {
    const { SoundManager } = await import('../../lib/sounds')
    SoundManager.setEnabled(false)
    expect(SoundManager.isEnabled()).toBe(false)
    expect(localStorage.getItem('sound_enabled')).toBe('false')
    SoundManager.setEnabled(true)
    expect(SoundManager.isEnabled()).toBe(true)
    expect(localStorage.getItem('sound_enabled')).toBe('true')
  })
})

describe('SoundManager.play', () => {
  it('does nothing when sound is disabled', async () => {
    const { SoundManager } = await import('../../lib/sounds')
    SoundManager.setEnabled(false)
    SoundManager.play('click')
    expect(AudioContextSpy).not.toHaveBeenCalled()
  })

  it('creates an AudioContext lazily on first play', async () => {
    const { SoundManager } = await import('../../lib/sounds')
    SoundManager.play('click')
    expect(AudioContextSpy).toHaveBeenCalledTimes(1)
  })

  it('resumes a suspended context (browser autoplay policy)', async () => {
    fake.ctx.state = 'suspended'
    const { SoundManager } = await import('../../lib/sounds')
    SoundManager.play('click')
    expect(fake.ctx.resume).toHaveBeenCalled()
  })

  it('swallows errors thrown by AudioContext constructor', async () => {
    ;(window as any).AudioContext = vi.fn(() => {
      throw new Error('unsupported')
    })
    ;(window as any).webkitAudioContext = (window as any).AudioContext
    vi.resetModules()
    const { SoundManager } = await import('../../lib/sounds')
    expect(() => SoundManager.play('click')).not.toThrow()
  })

  it.each([
    'click',
    'success',
    'error',
    'notification',
    'vote',
    'reveal',
    'elimination',
    'timer_tick',
    'timer_warning',
    'game_start',
    'game_end',
    'round_start',
    'chat_message',
  ] as const)('plays %s without throwing', async (sound) => {
    const { SoundManager } = await import('../../lib/sounds')
    expect(() => SoundManager.play(sound)).not.toThrow()
    expect(fake.ctx.createOscillator).toHaveBeenCalled()
    expect(fake.ctx.createGain).toHaveBeenCalled()
  })

  it('game_start plays a 6-note ascending scale', async () => {
    const { SoundManager } = await import('../../lib/sounds')
    SoundManager.play('game_start')
    // 6 notes → 6 oscillators + 6 gains
    expect(fake.oscillators.length).toBe(6)
    expect(fake.gains.length).toBe(6)
  })

  it('notification plays three chimes', async () => {
    const { SoundManager } = await import('../../lib/sounds')
    SoundManager.play('notification')
    expect(fake.oscillators.length).toBe(3)
  })
})
