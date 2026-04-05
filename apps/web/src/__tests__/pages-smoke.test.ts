/**
 * Lightweight smoke tests for all page components.
 * We only verify that each module can be dynamically imported without throwing
 * and that the module exports a default export (the page component).
 *
 * All heavy external dependencies are mocked so no network/socket/store
 * initialisation happens during import.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'

// ---------------------------------------------------------------------------
// Global mocks — must be declared with vi.mock() so Vitest hoists them before
// any import resolution happens.
// ---------------------------------------------------------------------------

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/', search: '', hash: '' }),
  useParams: () => ({}),
  Link: ({ children }: { children: unknown }) => children,
  Navigate: () => null,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: unknown }) => children,
}))

vi.mock('../store/auth', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: 'u1', username: 'testuser' }, token: 'tok', clearAuth: vi.fn(), setAuth: vi.fn() }),
}))

vi.mock('../store/social', () => ({
  useSocialStore: (selector: (s: unknown) => unknown) =>
    selector({
      activeDm: null,
      setActiveDm: vi.fn(),
      unreadCounts: {},
      incrementUnread: vi.fn(),
      clearUnread: vi.fn(),
      pendingInvite: null,
      setPendingInvite: vi.fn(),
      pendingFriendRequest: null,
      setPendingFriendRequest: vi.fn(),
    }),
}))

vi.mock('../store/game', () => ({
  useGameStore: (selector: (s: unknown) => unknown) =>
    selector({
      room: null,
      phase: 'lobby',
      setRoom: vi.fn(),
      reset: vi.fn(),
    }),
}))

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('../lib/socket', () => ({
  getSocket: () => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: false }),
  connectSocket: vi.fn(),
  disconnectSocket: vi.fn(),
  updateSocketAuth: vi.fn(),
}))

vi.mock('../components/NavBar', () => ({ NavBar: () => null }))
vi.mock('../components/BottomNav', () => ({ BottomNav: () => null }))
vi.mock('../components/DmChatPanel', () => ({ DmChatPanel: () => null }))

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), connected: false })),
}))

vi.mock('@imposter/shared', () => ({}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function importDefault(modulePath: string): Promise<unknown> {
  const mod = await import(/* @vite-ignore */ modulePath)
  return mod.default
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pages smoke tests — dynamic import', () => {
  const pages = [
    { name: 'AuthPage',          path: '../pages/AuthPage' },
    { name: 'HomePage',          path: '../pages/HomePage' },
    { name: 'LobbyPage',         path: '../pages/LobbyPage' },
    { name: 'GamePage',          path: '../pages/GamePage' },
    { name: 'ResultsPage',       path: '../pages/ResultsPage' },
    { name: 'LeaderboardPage',   path: '../pages/LeaderboardPage' },
    { name: 'HistoryPage',       path: '../pages/HistoryPage' },
    { name: 'FriendsPage',       path: '../pages/FriendsPage' },
    { name: 'ProfilePage',       path: '../pages/ProfilePage' },
    { name: 'GameDetailPage',    path: '../pages/GameDetailPage' },
    { name: 'PlayerProfilePage', path: '../pages/PlayerProfilePage' },
    { name: 'PremiumPage',       path: '../pages/PremiumPage' },
    { name: 'WordPacksPage',     path: '../pages/WordPacksPage' },
    { name: 'ShopPage',          path: '../pages/ShopPage' },
    { name: 'SeasonPassPage',    path: '../pages/SeasonPassPage' },
  ]

  for (const { name, path } of pages) {
    it(`${name} can be imported without errors and exports a default`, async () => {
      const defaultExport = await importDefault(path)
      expect(defaultExport).toBeDefined()
      expect(typeof defaultExport).toBe('function')
    })
  }
})
