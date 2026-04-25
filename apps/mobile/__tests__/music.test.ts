/**
 * music.test.ts
 *
 * Covers the menu-music manager wrapping expo-av's Audio.Sound. The
 * non-trivial behaviour:
 *
 *   - Prefs round-trip through AsyncStorage (`music_enabled` / `music_volume`)
 *     with sane fallbacks if a key is missing or the value is malformed.
 *   - setEnabled(false) pauses the sound if it's loaded.
 *   - setVolume() clamps to [0, 1] AND pushes the new volume to the live
 *     sound when one exists.
 *   - play() short-circuits when music is disabled (no expo-av call).
 *   - The native expo-av require can fail on web / Expo Go — every public
 *     method has to swallow that and stay a no-op.
 *
 * MusicManager keeps module-scoped state (the prefs, the lazy sound, and
 * the in-flight load promise), so each test resets the module via
 * `vi.resetModules()` to start from a clean slate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture the most recent fake sound created by the (mocked) Audio.Sound
// constructor — tests assert that play/pause/setVolume call into it.
let lastSound: {
  loadAsync: ReturnType<typeof vi.fn>
  playAsync: ReturnType<typeof vi.fn>
  pauseAsync: ReturnType<typeof vi.fn>
  setVolumeAsync: ReturnType<typeof vi.fn>
} | null = null

vi.mock('expo-av', () => {
  return {
    Audio: {
      Sound: class {
        loadAsync = vi.fn().mockResolvedValue(undefined)
        playAsync = vi.fn().mockResolvedValue(undefined)
        pauseAsync = vi.fn().mockResolvedValue(undefined)
        setVolumeAsync = vi.fn().mockResolvedValue(undefined)
        constructor() {
          lastSound = this as any
        }
      },
    },
  }
})

const asyncStorage = {
  getItem: vi.fn().mockResolvedValue(null),
  setItem: vi.fn().mockResolvedValue(undefined),
}
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorage,
}))

// Any `require('../assets/music/redhanded.mp3')` — vitest's transformer
// resolves the path through the file system. Stub the asset so the load
// doesn't try to read a real audio file off disk.
vi.mock('../assets/music/redhanded.mp3', () => ({ default: { uri: 'stub' } }))

async function freshModule() {
  vi.resetModules()
  asyncStorage.getItem.mockReset().mockResolvedValue(null)
  asyncStorage.setItem.mockReset().mockResolvedValue(undefined)
  lastSound = null
  return await import('../lib/music')
}

beforeEach(() => {
  // Sanity guard so a leaked mock from a prior test can't poison the next.
  vi.clearAllMocks()
})

describe('MusicManager.init + prefs', () => {
  it('defaults to enabled=true and volume=0.4 when no AsyncStorage values exist', async () => {
    const { MusicManager } = await freshModule()
    await MusicManager.init()
    expect(MusicManager.isEnabled()).toBe(true)
    expect(MusicManager.getVolume()).toBe(0.4)
  })

  it('honours stored music_enabled=false', async () => {
    asyncStorage.getItem.mockImplementation((key: string) =>
      Promise.resolve(key === 'music_enabled' ? 'false' : null),
    )
    const { MusicManager } = await freshModule()
    asyncStorage.getItem.mockImplementation((key: string) =>
      Promise.resolve(key === 'music_enabled' ? 'false' : null),
    )
    await MusicManager.init()
    expect(MusicManager.isEnabled()).toBe(false)
  })

  it('reads + clamps the stored volume to [0, 1]', async () => {
    const { MusicManager } = await freshModule()
    asyncStorage.getItem.mockImplementation((key: string) =>
      Promise.resolve(key === 'music_volume' ? '2.5' : null),
    )
    await MusicManager.init()
    // 2.5 clamps down to 1.0.
    expect(MusicManager.getVolume()).toBe(1)
  })

  it('falls back to 0.4 when the stored volume is malformed', async () => {
    const { MusicManager } = await freshModule()
    asyncStorage.getItem.mockImplementation((key: string) =>
      Promise.resolve(key === 'music_volume' ? 'not-a-number' : null),
    )
    await MusicManager.init()
    expect(MusicManager.getVolume()).toBe(0.4)
  })

  it('init is idempotent — a second call does not reload prefs or asset', async () => {
    const { MusicManager } = await freshModule()
    await MusicManager.init()
    const calls = asyncStorage.getItem.mock.calls.length
    await MusicManager.init()
    expect(asyncStorage.getItem.mock.calls.length).toBe(calls)
  })
})

describe('MusicManager.setEnabled', () => {
  it('persists the new flag to AsyncStorage', async () => {
    const { MusicManager } = await freshModule()
    await MusicManager.init()
    await MusicManager.setEnabled(false)
    expect(asyncStorage.setItem).toHaveBeenCalledWith('music_enabled', 'false')
    expect(MusicManager.isEnabled()).toBe(false)
  })

  it('pauses the live sound when disabled', async () => {
    const { MusicManager } = await freshModule()
    await MusicManager.init()
    expect(lastSound).not.toBeNull()
    await MusicManager.setEnabled(false)
    expect(lastSound!.pauseAsync).toHaveBeenCalled()
  })

  it('does not crash when AsyncStorage.setItem throws', async () => {
    const { MusicManager } = await freshModule()
    await MusicManager.init()
    asyncStorage.setItem.mockRejectedValueOnce(new Error('quota'))
    await expect(MusicManager.setEnabled(false)).resolves.toBeUndefined()
  })
})

describe('MusicManager.setVolume', () => {
  it('clamps the volume to [0, 1] and persists it', async () => {
    const { MusicManager } = await freshModule()
    await MusicManager.init()
    await MusicManager.setVolume(-0.5)
    expect(MusicManager.getVolume()).toBe(0)
    expect(asyncStorage.setItem).toHaveBeenCalledWith('music_volume', '0')

    await MusicManager.setVolume(0.7)
    expect(MusicManager.getVolume()).toBe(0.7)
    await MusicManager.setVolume(1.5)
    expect(MusicManager.getVolume()).toBe(1)
  })

  it('pushes the clamped volume to the live sound', async () => {
    const { MusicManager } = await freshModule()
    await MusicManager.init()
    await MusicManager.setVolume(0.6)
    expect(lastSound!.setVolumeAsync).toHaveBeenCalledWith(0.6)
  })
})

describe('MusicManager.play / pause', () => {
  it('play() is a no-op when music is disabled (does not load expo-av)', async () => {
    asyncStorage.getItem.mockImplementation((key: string) =>
      Promise.resolve(key === 'music_enabled' ? 'false' : null),
    )
    const { MusicManager } = await freshModule()
    asyncStorage.getItem.mockImplementation((key: string) =>
      Promise.resolve(key === 'music_enabled' ? 'false' : null),
    )
    await MusicManager.init()
    await MusicManager.play()
    // The init path still creates a sound (loadAsync is called), but
    // playAsync must NOT be — that's the disable-respecting branch.
    expect(lastSound?.playAsync).not.toHaveBeenCalled()
  })

  it('play() sets the volume and starts the sound when enabled', async () => {
    const { MusicManager } = await freshModule()
    await MusicManager.init()
    await MusicManager.play()
    expect(lastSound!.setVolumeAsync).toHaveBeenCalledWith(0.4)
    expect(lastSound!.playAsync).toHaveBeenCalled()
  })

  it('pause() forwards to the underlying sound', async () => {
    const { MusicManager } = await freshModule()
    await MusicManager.init()
    await MusicManager.pause()
    expect(lastSound!.pauseAsync).toHaveBeenCalled()
  })

  it('pause() is a no-op before any sound has been loaded', async () => {
    const { MusicManager } = await freshModule()
    // No init() — sound is still null.
    await expect(MusicManager.pause()).resolves.toBeUndefined()
  })

  it('play() swallows errors thrown by the native layer', async () => {
    const { MusicManager } = await freshModule()
    await MusicManager.init()
    lastSound!.playAsync.mockRejectedValueOnce(new Error('audio focus lost'))
    await expect(MusicManager.play()).resolves.toBeUndefined()
  })
})
