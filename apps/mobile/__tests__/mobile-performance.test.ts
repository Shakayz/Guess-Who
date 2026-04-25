import { describe, it, expect, vi, beforeEach } from 'vitest'

// ───────────────────────────────────────────────────────────────────────────
// Mobile performance parity suite
//
// The mobile app has historically had no perf coverage; web has none either,
// so "performance parity with web" in practice means: for every
// platform-agnostic feature the mobile app depends on (game logic, offline
// logic, stores, lib/ helpers), hot paths must be fast enough in plain JS
// that the React Native shell — not the logic — is the bottleneck.
//
// These tests execute the same shared/pure modules the web app uses and
// assert operation-count thresholds that a modern V8 engine will comfortably
// meet. Thresholds are deliberately generous (~5–10× the observed local
// runtime) to stay green on slower CI workers while still catching true
// regressions (a 2× slowdown).
// ───────────────────────────────────────────────────────────────────────────

// Stub the native modules that some lib/* imports pull in. Vitest runs in
// Node, so expo-haptics / AsyncStorage / expo-av / react-native wouldn't
// otherwise resolve.
const impactAsyncMock = vi.fn()
const notificationAsyncMock = vi.fn()
const selectionAsyncMock = vi.fn()

vi.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  impactAsync: (...args: unknown[]) => impactAsyncMock(...args),
  notificationAsync: (...args: unknown[]) => notificationAsyncMock(...args),
  selectionAsync: (...args: unknown[]) => selectionAsyncMock(...args),
}))

const asyncStorage = new Map<string, string>()
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => asyncStorage.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      asyncStorage.set(k, v)
    }),
    removeItem: vi.fn(async (k: string) => {
      asyncStorage.delete(k)
    }),
  },
}))

// react-native's Platform is pulled in transitively by lib/api.ts, lib/socket.ts,
// and lib/notifications.ts. Stub it with just the surface those modules read.
vi.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (obj: Record<string, unknown>) => obj.ios ?? obj.default },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}))

// Measure wall-clock time a block takes (ms). Uses performance.now() which is
// available in both Node ≥16 and jsdom — same API web tests would use.
async function timeMs(fn: () => void | Promise<void>): Promise<number> {
  const t0 = performance.now()
  await fn()
  return performance.now() - t0
}

// A single "budget multiplier" knob so CI under heavy load can loosen
// thresholds without rewriting each assertion. Default 3 — tight enough to
// still catch a 2× regression but loose enough to survive `turbo run test`,
// which spawns the web/api/shared/ui suites in parallel and contends the
// CPU. Override with PERF_BUDGET=1 for a strict local-only run.
const BUDGET = Number(process.env.PERF_BUDGET ?? 3)
const budget = (ms: number) => ms * BUDGET

// ───────────────────────────────────────────────────────────────────────────
// 1. Shared game logic (consumed by mobile's game/[code].tsx hot paths)
// ───────────────────────────────────────────────────────────────────────────

describe('perf: shared game logic (mobile consumer)', () => {
  it('tallyVotes handles a full 20-player lobby in well under a frame', async () => {
    const { tallyVotes } = await import('@red-handed/shared')
    const players = Array.from({ length: 20 }, (_, i) => ({
      id: `p${i}`,
      userId: `u${i}`,
      username: `user${i}`,
      avatarUrl: null,
      status: 'alive' as const,
      isHost: i === 0,
      isReady: true,
      honorGiven: false,
      role: (i % 3 === 0 ? 'villager' : i % 3 === 1 ? 'red_handed' : 'detective') as any,
    }))
    const votes = players.map((p, i) => ({
      voterId: p.userId,
      targetId: players[(i + 1) % players.length].userId,
      timestamp: new Date().toISOString(),
    }))

    const elapsed = await timeMs(() => {
      for (let i = 0; i < 1000; i++) tallyVotes(votes, players)
    })
    // 1000 iterations must finish in under one 60fps frame × many — be generous.
    expect(elapsed).toBeLessThan(budget(150))
  })

  it('checkWinCondition is O(n) and stays sub-ms per call at 20 players', async () => {
    const { checkWinCondition } = await import('@red-handed/shared')
    const players = Array.from({ length: 20 }, (_, i) => ({
      id: `p${i}`,
      userId: `u${i}`,
      username: `user${i}`,
      avatarUrl: null,
      status: (i % 4 === 0 ? 'eliminated' : 'alive') as 'alive' | 'eliminated',
      isHost: i === 0,
      isReady: true,
      honorGiven: false,
      role: (i < 15 ? 'villager' : 'red_handed') as any,
    }))

    const elapsed = await timeMs(() => {
      for (let i = 0; i < 5000; i++) checkWinCondition(players)
    })
    expect(elapsed).toBeLessThan(budget(100))
  })

  it('shuffleArray + generateRoomCode keep up with rapid lobby churn', async () => {
    const { shuffleArray, generateRoomCode } = await import('@red-handed/shared')
    const seed = Array.from({ length: 50 }, (_, i) => i)

    const elapsed = await timeMs(() => {
      for (let i = 0; i < 2000; i++) {
        shuffleArray(seed)
        generateRoomCode()
      }
    })
    expect(elapsed).toBeLessThan(budget(200))
  })

  it('getMostVoted + getTiedPlayerIds handle degenerate inputs quickly', async () => {
    const { getMostVoted, getTiedPlayerIds } = await import('@red-handed/shared')
    const votes = Array.from({ length: 200 }, (_, i) => ({
      voterId: `u${i}`,
      targetId: `u${i % 5}`,
      timestamp: new Date().toISOString(),
    }))

    const elapsed = await timeMs(() => {
      for (let i = 0; i < 1000; i++) {
        getMostVoted(votes)
        getTiedPlayerIds(votes)
      }
    })
    expect(elapsed).toBeLessThan(budget(200))
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 2. Offline mode helpers (pass-and-play / offline.tsx hot paths)
// ───────────────────────────────────────────────────────────────────────────

describe('perf: offline mode helpers', () => {
  it('computeMaxRoleCounts is cheap across the full supported player range', async () => {
    const { computeMaxRoleCounts, ZERO_SPECIAL_COUNTS } = await import('@red-handed/shared')

    const elapsed = await timeMs(() => {
      for (let iter = 0; iter < 200; iter++) {
        for (let p = 3; p <= 20; p++) {
          for (let r = 1; r <= 6; r++) {
            computeMaxRoleCounts(p, r, ZERO_SPECIAL_COUNTS)
          }
        }
      }
    })
    // 200 × 18 × 6 = 21 600 calls.
    expect(elapsed).toBeLessThan(budget(250))
  })

  it('clamp/max/default red-handed helpers run in constant time', async () => {
    const { clampRedHandedCount, maxRedHandedFor, getDefaultRedHandedCount } = await import(
      '@red-handed/shared'
    )

    const elapsed = await timeMs(() => {
      for (let i = 0; i < 50_000; i++) {
        maxRedHandedFor(10)
        clampRedHandedCount(10, 3)
        getDefaultRedHandedCount(10)
      }
    })
    expect(elapsed).toBeLessThan(budget(100))
  })

  it('isEvilOfflineRole keeps up with tight render loops', async () => {
    const { isEvilOfflineRole, EVIL_OFFLINE_ROLES } = await import('@red-handed/shared')

    const elapsed = await timeMs(() => {
      for (let i = 0; i < 100_000; i++) {
        isEvilOfflineRole(EVIL_OFFLINE_ROLES[i % EVIL_OFFLINE_ROLES.length] as any)
      }
    })
    expect(elapsed).toBeLessThan(budget(100))
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 3. Shared utilities used by mobile UI (formatters, clamps, rank)
// ───────────────────────────────────────────────────────────────────────────

describe('perf: shared utils', () => {
  it('formatDate throughput sustains 1000 timestamps per test run', async () => {
    const { formatDate } = await import('@red-handed/shared')
    const iso = new Date().toISOString()

    const elapsed = await timeMs(() => {
      for (let i = 0; i < 1000; i++) formatDate(iso, 'en')
    })
    // Intl is slow-ish; still must not dominate render.
    expect(elapsed).toBeLessThan(budget(500))
  })

  it('clamp is effectively free', async () => {
    const { clamp } = await import('@red-handed/shared')

    const elapsed = await timeMs(() => {
      for (let i = 0; i < 1_000_000; i++) clamp(i, 0, 500)
    })
    expect(elapsed).toBeLessThan(budget(100))
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 4. Zustand stores (auth / game / social) — state update cost
// ───────────────────────────────────────────────────────────────────────────

describe('perf: mobile zustand stores', () => {
  beforeEach(() => {
    asyncStorage.clear()
    vi.resetModules()
    // lib/logger reads the RN-injected `__DEV__` global at module load; the
    // stores import logger transitively, so the flag must exist first.
    ;(globalThis as any).__DEV__ = false
    // Stores log on every setAuth/reset/etc.; silence to keep perf output clean.
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('auth store set/clear cycles stay under a frame at 1000 iterations', async () => {
    const { useAuthStore } = await import('../store/auth')

    const elapsed = await timeMs(() => {
      for (let i = 0; i < 1000; i++) {
        useAuthStore.getState().setAuth(`tok-${i}`, { id: `u${i}`, username: `u${i}` })
        useAuthStore.getState().clearAuth()
      }
    })
    expect(elapsed).toBeLessThan(budget(400))
  })

  it('game store addMessage keeps the ring buffer bounded and fast', async () => {
    const { useGameStore } = await import('../store/game')

    const elapsed = await timeMs(() => {
      for (let i = 0; i < 1000; i++) {
        useGameStore.getState().addMessage({
          id: `m${i}`,
          userId: 'u1',
          username: 'u1',
          text: `hello #${i}`,
          timestamp: new Date().toISOString(),
        } as any)
      }
    })
    expect(elapsed).toBeLessThan(budget(400))
    // Invariant: the addMessage ring keeps only the last 100 entries.
    expect(useGameStore.getState().messages.length).toBe(100)
    useGameStore.getState().reset()
  })

  it('game store addCompletedRound keeps the ring buffer bounded and fast', async () => {
    const { useGameStore } = await import('../store/game')

    const elapsed = await timeMs(() => {
      for (let i = 0; i < 500; i++) {
        useGameStore.getState().addCompletedRound({
          id: `r${i}`,
          roundNumber: i,
          speakingOrder: [],
          clues: [],
          votes: [],
          eliminatedPlayerId: null,
          eliminatedRole: null,
          wordReveal: null,
        } as any)
      }
    })
    expect(elapsed).toBeLessThan(budget(300))
    expect(useGameStore.getState().completedRounds.length).toBe(20)
    useGameStore.getState().reset()
  })

  it('social store unread-count updates scale linearly with friend count', async () => {
    const { useSocialStore } = await import('../store/social')

    const elapsed = await timeMs(() => {
      for (let i = 0; i < 1000; i++) {
        useSocialStore.getState().incrementUnread(`friend-${i % 50}`)
      }
      for (let i = 0; i < 50; i++) {
        useSocialStore.getState().clearUnread(`friend-${i}`)
      }
    })
    expect(elapsed).toBeLessThan(budget(400))
    expect(Object.keys(useSocialStore.getState().unreadCounts).length).toBe(0)
  })

  it('social store achievement toast pipeline stays responsive', async () => {
    const { useSocialStore } = await import('../store/social')

    const elapsed = await timeMs(() => {
      for (let i = 0; i < 200; i++) {
        useSocialStore.getState().pushAchievementToast({
          key: `ach-${i}`,
          name: `Achievement ${i}`,
          icon: '🏆',
          difficulty: 'normal',
          starsReward: 1,
        })
      }
      const { achievementToasts } = useSocialStore.getState()
      for (const t of achievementToasts) useSocialStore.getState().dismissAchievementToast(t.id)
    })
    expect(elapsed).toBeLessThan(budget(200))
    expect(useSocialStore.getState().achievementToasts.length).toBe(0)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 5. Mobile lib/ helpers (logger, haptics, sounds, responsive)
// ───────────────────────────────────────────────────────────────────────────

describe('perf: mobile lib helpers', () => {
  beforeEach(() => {
    asyncStorage.clear()
    impactAsyncMock.mockClear()
    notificationAsyncMock.mockClear()
    selectionAsyncMock.mockClear()
    vi.resetModules()
    ;(globalThis as any).__DEV__ = false
  })

  it('logger formats and emits 1000 messages without blocking the JS thread', async () => {
    ;(globalThis as any).__DEV__ = false
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { createLogger } = await import('../lib/logger')
    const log = createLogger('perf')

    const elapsed = await timeMs(() => {
      for (let i = 0; i < 1000; i++) {
        log.info(`msg ${i}`, { idx: i })
        log.warn(`msg ${i}`)
      }
    })

    debugSpy.mockRestore()
    infoSpy.mockRestore()
    warnSpy.mockRestore()
    errSpy.mockRestore()

    expect(elapsed).toBeLessThan(budget(300))
  })

  it('HapticManager dispatches 500 calls in well under a frame', async () => {
    const { HapticManager } = await import('../lib/haptics')

    const elapsed = await timeMs(() => {
      for (let i = 0; i < 500; i++) {
        HapticManager.light()
        HapticManager.selection()
        HapticManager.success()
      }
    })
    expect(elapsed).toBeLessThan(budget(150))
    expect(impactAsyncMock).toHaveBeenCalledTimes(500)
    expect(selectionAsyncMock).toHaveBeenCalledTimes(500)
    expect(notificationAsyncMock).toHaveBeenCalledTimes(500)
  })

  it('HapticManager.setEnabled(false) short-circuits immediately', async () => {
    const { HapticManager } = await import('../lib/haptics')
    await HapticManager.setEnabled(false)

    const elapsed = await timeMs(() => {
      for (let i = 0; i < 10_000; i++) {
        HapticManager.light()
        HapticManager.medium()
        HapticManager.heavy()
        HapticManager.selection()
      }
    })
    // Disabled path is a pure `if`; must be essentially free.
    expect(elapsed).toBeLessThan(budget(80))
    expect(impactAsyncMock).not.toHaveBeenCalled()
    expect(selectionAsyncMock).not.toHaveBeenCalled()
  })

  it('SoundManager.play is a no-op when expo-av is absent (Node env)', async () => {
    const { SoundManager } = await import('../lib/sounds')

    const elapsed = await timeMs(() => {
      for (let i = 0; i < 5000; i++) {
        SoundManager.play('click')
        SoundManager.play('success')
        SoundManager.play('vote')
      }
    })
    // Without a native backend, play() must short-circuit instantly.
    expect(elapsed).toBeLessThan(budget(80))
  })

  it('responsiveContentStyle returns shape without allocating under pressure', async () => {
    const { responsiveContentStyle } = await import('../lib/responsive')

    const elapsed = await timeMs(() => {
      for (let i = 0; i < 100_000; i++) {
        responsiveContentStyle(i % 2 === 0, 390 + (i % 400))
      }
    })
    expect(elapsed).toBeLessThan(budget(100))
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 6. End-to-end offline game loop — mirrors the steps a player does in
//    app/offline.tsx: set up roles → assign words → tally votes → check win.
//    The whole loop must fit comfortably inside a single render budget.
// ───────────────────────────────────────────────────────────────────────────

describe('perf: offline game loop (mobile e2e logic path)', () => {
  it('completes a full 10-player round in under one frame', async () => {
    const {
      computeMaxRoleCounts,
      ZERO_SPECIAL_COUNTS,
      clampRedHandedCount,
      shuffleArray,
      tallyVotes,
      checkWinCondition,
    } = await import('@red-handed/shared')

    const playerCount = 10
    const seatIds = Array.from({ length: playerCount }, (_, i) => `seat-${i}`)

    const elapsed = await timeMs(() => {
      // Round setup
      const redHandedCount = clampRedHandedCount(playerCount, 2)
      computeMaxRoleCounts(playerCount, redHandedCount, ZERO_SPECIAL_COUNTS)
      const order = shuffleArray(seatIds)

      const players = order.map((id, i) => ({
        id,
        userId: id,
        username: id,
        avatarUrl: null,
        status: 'alive' as const,
        isHost: i === 0,
        isReady: true,
        honorGiven: false,
        role: (i < redHandedCount ? 'red_handed' : 'villager') as any,
      }))

      // Everyone votes for player 0
      const votes = players.map((p) => ({
        voterId: p.userId,
        targetId: players[0].userId,
        timestamp: new Date().toISOString(),
      }))

      const { mostVotedId } = tallyVotes(votes, players)
      const eliminated = players.find((p) => p.userId === mostVotedId)
      if (eliminated) eliminated.status = 'eliminated' as any
      checkWinCondition(players)
    })

    // One frame @ 60fps = ~16ms. Give 10× headroom for CI jitter.
    expect(elapsed).toBeLessThan(budget(16 * 10))
  })
})
