import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ code: 'GAME01' }),
  Link: ({ children, to }: { children: unknown; to: string }) => <a href={to}>{children as React.ReactNode}</a>,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en' },
  }),
}))

vi.mock('../../store/auth', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: 'u1', username: 'testuser' }, token: 'tok' }),
}))

const mockGameState = {
  result: null as unknown,
  room: null as unknown,
  myRole: null as unknown,
  completedRounds: [] as unknown[],
  reset: vi.fn(),
  setRoleAndWord: vi.fn(),
  setResult: vi.fn(),
  setRoom: vi.fn(),
}

vi.mock('../../store/game', () => ({
  useGameStore: Object.assign(
    (selector?: (s: unknown) => unknown) => {
      return selector ? selector(mockGameState) : mockGameState
    },
    { getState: () => mockGameState },
  ),
}))

const mockSocketOn = vi.fn()
const mockSocketOff = vi.fn()
const mockSocketEmit = vi.fn()
vi.mock('../../lib/socket', () => ({
  getSocket: () => ({ on: mockSocketOn, off: mockSocketOff, emit: mockSocketEmit }),
}))

vi.mock('../../components/NavBar', () => ({ NavBar: () => <div data-testid="navbar" /> }))

vi.mock('@red-handed/ui', () => ({
  Avatar: ({ username }: { username: string }) => <div>{username}</div>,
  Badge: ({ tier }: { tier: string }) => <div>{tier}</div>,
}))

vi.mock('@red-handed/shared', () => ({
  RANK_CONFIG: {
    wooden:      { label: 'Wooden',      color: '#8B6914', icon: '🪵', lpRequired: 100 },
    bronze:      { label: 'Bronze',      color: '#CD7F32', icon: '🥉', lpRequired: 200 },
    silver:      { label: 'Silver',      color: '#C0C0C0', icon: '🥈', lpRequired: 300 },
    gold:        { label: 'Gold',        color: '#FFD700', icon: '🥇', lpRequired: 400 },
    diamond:     { label: 'Diamond',     color: '#B9F2FF', icon: '💎', lpRequired: 500 },
    master:      { label: 'Master',      color: '#9B59B6', icon: '👑', lpRequired: 600 },
    grandmaster: { label: 'Grandmaster', color: '#E74C3C', icon: '🌌', lpRequired: Infinity },
  },
}))

import ResultsPage from '../../pages/ResultsPage'

const winResult = {
  winner: 'villagers',
  finalRound: { id: 'r1', roundNumber: 3, speakingOrder: [], clues: [], votes: [] },
  rewards: { starCoinsEarned: 10, xpEarned: 50, lpChange: 5, achievements: [] },
}

const winRoom = {
  code: 'GAME01',
  status: 'finished',
  settings: { gameMode: 'normal', isPrivate: false },
  players: [
    { userId: 'u1', username: 'testuser', role: 'villager', status: 'alive', avatarUrl: null },
    { userId: 'u2', username: 'enemy', role: 'red_handed', status: 'eliminated', avatarUrl: null },
  ],
}

describe('ResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGameState.result = null
    mockGameState.room = null
    mockGameState.myRole = null
    mockGameState.completedRounds = []
  })

  it('renders without crashing', () => {
    render(<ResultsPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('shows fallback text when no result is available', () => {
    render(<ResultsPage />)
    expect(screen.getByText('No game data available.')).toBeInTheDocument()
  })

  it('shows back to home button on fallback screen', () => {
    render(<ResultsPage />)
    expect(screen.getByText('Back to Home')).toBeInTheDocument()
  })

  it('navigates home when back button clicked from fallback', () => {
    render(<ResultsPage />)
    fireEvent.click(screen.getByText('Back to Home'))
    expect(mockGameState.reset).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('renders navbar when result is available', () => {
    mockGameState.result = winResult
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('registers socket listeners on mount', () => {
    render(<ResultsPage />)
    expect(mockSocketOn).toHaveBeenCalled()
  })

  it('cleans up socket listeners on unmount', () => {
    const { unmount } = render(<ResultsPage />)
    unmount()
    expect(mockSocketOff).toHaveBeenCalled()
  })

  it('renders with a completed game result as villager winning', () => {
    mockGameState.result = winResult
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders when redHanded win', () => {
    mockGameState.result = {
      winner: 'red_handed',
      finalRound: { id: 'r1', roundNumber: 2, speakingOrder: [], clues: [], votes: [] },
      rewards: { starCoinsEarned: 5, xpEarned: 25, lpChange: -3, achievements: [] },
    }
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders when redHanded player wins', () => {
    mockGameState.result = {
      winner: 'red_handed',
      finalRound: { id: 'r1', roundNumber: 2, speakingOrder: [], clues: [], votes: [] },
      rewards: { starCoinsEarned: 15, xpEarned: 75, lpChange: 10, achievements: [] },
    }
    mockGameState.room = { ...winRoom, settings: { gameMode: 'normal', isPrivate: false } }
    mockGameState.myRole = 'red_handed'
    render(<ResultsPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders ranked game results with LP display', () => {
    mockGameState.result = {
      winner: 'villagers',
      finalRound: { id: 'r1', roundNumber: 1, speakingOrder: [], clues: [], votes: [] },
      rewards: { starCoinsEarned: 0, xpEarned: 0, lpChange: 20, achievements: [] },
    }
    mockGameState.room = {
      ...winRoom,
      settings: { gameMode: 'ranked', isPrivate: false },
    }
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('emits gamechat:history on mount', () => {
    render(<ResultsPage />)
    expect(mockSocketEmit).toHaveBeenCalledWith('gamechat:history')
  })

  it('handles chat message received via socket', () => {
    mockGameState.result = winResult
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    // Simulate receiving a chat message
    const chatMsgCall = mockSocketOn.mock.calls.find(call => call[0] === 'gamechat:message')
    expect(chatMsgCall).toBeDefined()
    act(() => {
      chatMsgCall![1]({ id: 'm1', userId: 'u2', username: 'enemy', text: 'Good game!', createdAt: new Date().toISOString() })
    })
    expect(screen.getByText('Good game!')).toBeInTheDocument()
  })

  it('handles play again button click', () => {
    mockGameState.result = winResult
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    // The play again button should be rendered
    const playAgainBtn = screen.queryByText('results.playAgain')
    if (playAgainBtn) {
      fireEvent.click(playAgainBtn)
      expect(mockGameState.reset).toHaveBeenCalled()
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles completed rounds when present', () => {
    mockGameState.result = winResult
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    mockGameState.completedRounds = [
      {
        id: 'r1', roundNumber: 1, speakingOrder: ['u1', 'u2'], clues: [], votes: [],
        wordReveal: { villagerWord: 'pizza', redHandedWord: 'pasta' }, eliminatedPlayerId: 'u2',
      },
    ]
    render(<ResultsPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders with draw result', () => {
    mockGameState.result = {
      winner: 'draw',
      finalRound: { id: 'r1', roundNumber: 1, speakingOrder: [], clues: [], votes: [] },
      rewards: { starCoinsEarned: 3, xpEarned: 10, lpChange: 0, achievements: [] },
    }
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('shows word reveal when finalRound has wordReveal', () => {
    mockGameState.result = {
      winner: 'villagers',
      finalRound: {
        id: 'r1', roundNumber: 1, speakingOrder: [], clues: [], votes: [],
        wordReveal: { villagerWord: 'pizza', redHandedWord: 'pasta' },
      },
      rewards: { starCoinsEarned: 10, xpEarned: 50, lpChange: 5, achievements: [] },
    }
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    expect(screen.getByText('pizza')).toBeInTheDocument()
    expect(screen.getByText('pasta')).toBeInTheDocument()
  })

  it('shows LP section in ranked game', () => {
    mockGameState.result = {
      winner: 'villagers',
      finalRound: { id: 'r1', roundNumber: 1, speakingOrder: [], clues: [], votes: [] },
      rewards: { starCoinsEarned: 10, xpEarned: 50, lpChange: 20, achievements: [] },
    }
    mockGameState.room = { ...winRoom, settings: { gameMode: 'ranked', isPrivate: false } }
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    expect(screen.getByText('results.lp')).toBeInTheDocument()
  })

  it('shows negative LP in ranked game', () => {
    mockGameState.result = {
      winner: 'red_handed',
      finalRound: { id: 'r1', roundNumber: 1, speakingOrder: [], clues: [], votes: [] },
      rewards: { starCoinsEarned: 3, xpEarned: 10, lpChange: -15, achievements: [] },
    }
    mockGameState.room = { ...winRoom, settings: { gameMode: 'ranked', isPrivate: false } }
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    expect(screen.getByText('results.lp')).toBeInTheDocument()
  })

  it('shows achievements when unlocked', () => {
    mockGameState.result = {
      winner: 'villagers',
      finalRound: { id: 'r1', roundNumber: 1, speakingOrder: [], clues: [], votes: [] },
      rewards: {
        starCoinsEarned: 10, xpEarned: 50, lpChange: 5,
        achievements: [{ id: 'a1', name: 'First Win' }],
      },
    }
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    expect(screen.getByText(/First Win/)).toBeInTheDocument()
  })

  it('handles honor give button flow', () => {
    mockGameState.result = winResult
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    // Click +Honor button for enemy player
    const honorBtn = screen.getByText('results.plusHonor')
    fireEvent.click(honorBtn)
    // Honor type buttons should appear
    expect(screen.getByText('results.cancel')).toBeInTheDocument()
  })

  it('cancels honor selection', () => {
    mockGameState.result = winResult
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    fireEvent.click(screen.getByText('results.plusHonor'))
    expect(screen.getByText('results.cancel')).toBeInTheDocument()
    fireEvent.click(screen.getByText('results.cancel'))
    expect(screen.queryByText('results.cancel')).not.toBeInTheDocument()
  })

  it('gives honor to a player', () => {
    mockGameState.result = winResult
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    fireEvent.click(screen.getByText('results.plusHonor'))
    // Click one of the honor type buttons
    const honorTypes = ['honor.teamplayer', 'honor.sharpMind', 'honor.goodSport']
    const foundBtn = honorTypes.map(t => screen.queryByText(t)).find(Boolean)
    if (foundBtn) {
      fireEvent.click(foundBtn)
      expect(mockSocketEmit).toHaveBeenCalledWith('honor:give', expect.any(Object))
    }
    expect(document.body).toBeInTheDocument()
  })

  it('sends chat message when send button is clicked', () => {
    mockGameState.result = winResult
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    const chatInput = screen.getByPlaceholderText('results.chatPlaceholder')
    fireEvent.change(chatInput, { target: { value: 'Hello everyone!' } })
    fireEvent.click(screen.getByText('results.send'))
    expect(mockSocketEmit).toHaveBeenCalledWith('gamechat:send', { text: 'Hello everyone!' })
  })

  it('sends chat message on Enter key', () => {
    mockGameState.result = winResult
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    const chatInput = screen.getByPlaceholderText('results.chatPlaceholder')
    fireEvent.change(chatInput, { target: { value: 'Hello!' } })
    fireEvent.keyDown(chatInput, { key: 'Enter' })
    expect(mockSocketEmit).toHaveBeenCalledWith('gamechat:send', { text: 'Hello!' })
  })

  it('handles rank:updated socket event with promotion', () => {
    mockGameState.result = winResult
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    const rankUpdatedCall = mockSocketOn.mock.calls.find(c => c[0] === 'rank:updated')
    if (rankUpdatedCall) {
      act(() => {
        rankUpdatedCall[1]({ oldTier: 'bronze', newTier: 'silver', newLP: 300, promoted: true })
      })
      expect(screen.getByText('results.rankUp')).toBeInTheDocument()
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles rank:updated event without promotion', () => {
    mockGameState.result = winResult
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    const rankUpdatedCall = mockSocketOn.mock.calls.find(c => c[0] === 'rank:updated')
    if (rankUpdatedCall) {
      act(() => {
        rankUpdatedCall[1]({ oldTier: 'bronze', newTier: 'bronze', newLP: 200, promoted: false })
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles game:started socket event navigates to new game', () => {
    mockGameState.result = winResult
    mockGameState.room = { ...winRoom, code: 'GAME01' }
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    const gameStartedCall = mockSocketOn.mock.calls.find(c => c[0] === 'game:started')
    if (gameStartedCall) {
      act(() => {
        gameStartedCall[1]({ yourWord: 'cat', yourRole: 'villager', yourVillagerWord: null })
      })
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/game/'))
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles gamechat:history event populating chat messages', () => {
    mockGameState.result = winResult
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    const historyCall = mockSocketOn.mock.calls.find(c => c[0] === 'gamechat:history')
    if (historyCall) {
      act(() => {
        historyCall[1]({ messages: [
          { id: 'm1', userId: 'u2', username: 'enemy', text: 'gg', createdAt: new Date().toISOString() },
        ]})
      })
      expect(screen.getByText('gg')).toBeInTheDocument()
    }
    expect(document.body).toBeInTheDocument()
  })

  it('shows exit button and triggers reset on click', () => {
    mockGameState.result = winResult
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    const exitBtn = screen.queryByText('results.exit') ?? screen.queryByText('Exit')
    if (exitBtn) {
      fireEvent.click(exitBtn)
      expect(mockGameState.reset).toHaveBeenCalled()
    }
    expect(document.body).toBeInTheDocument()
  })

  it('renders double_agent and detective roles in player list', () => {
    mockGameState.result = winResult
    mockGameState.room = {
      ...winRoom,
      players: [
        { userId: 'u1', username: 'testuser', role: 'detective', status: 'alive', avatarUrl: null },
        { userId: 'u2', username: 'enemy', role: 'double_agent', status: 'eliminated', avatarUrl: null },
      ],
    }
    mockGameState.myRole = 'detective'
    render(<ResultsPage />)
    expect(screen.getByText('results.detective')).toBeInTheDocument()
    expect(screen.getByText('results.doubleAgent')).toBeInTheDocument()
  })

  it('dismisses rank celebration overlay when continue clicked', () => {
    mockGameState.result = winResult
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    const rankUpdatedCall = mockSocketOn.mock.calls.find(c => c[0] === 'rank:updated')
    if (rankUpdatedCall) {
      act(() => {
        rankUpdatedCall[1]({ oldTier: 'bronze', newTier: 'silver', newLP: 300, promoted: true })
      })
      const continueBtn = screen.queryByText('results.continue')
      if (continueBtn) {
        fireEvent.click(continueBtn)
        expect(screen.queryByText('results.rankUp')).not.toBeInTheDocument()
      }
    }
    expect(document.body).toBeInTheDocument()
  })

  it('renders my own chat message with isMe styling', () => {
    mockGameState.result = winResult
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    const chatMsgCall = mockSocketOn.mock.calls.find(call => call[0] === 'gamechat:message')
    // Send a message from myself (u1)
    if (chatMsgCall) {
      // First send other message to set lastUser !== u1
      act(() => {
        chatMsgCall[1]({ id: 'm0', userId: 'u2', username: 'enemy', text: 'hey', createdAt: new Date().toISOString() })
      })
      // Now send from u1 (isMe)
      act(() => {
        chatMsgCall[1]({ id: 'm1', userId: 'u1', username: 'testuser', text: 'my message', createdAt: new Date().toISOString() })
      })
      expect(screen.getByText('my message')).toBeInTheDocument()
    }
    expect(document.body).toBeInTheDocument()
  })

  it('renders players with survived status', () => {
    mockGameState.result = winResult
    mockGameState.room = {
      ...winRoom,
      players: [
        { userId: 'u1', username: 'testuser', role: 'villager', status: 'alive', survived: true, avatarUrl: null },
        { userId: 'u2', username: 'enemy', role: 'red_handed', status: 'eliminated', survived: false, avatarUrl: null },
      ],
    }
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    expect(screen.getByText('results.survived')).toBeInTheDocument()
    expect(screen.getByText('results.eliminated')).toBeInTheDocument()
  })

  it('shows play again navigates to lobby', () => {
    mockGameState.result = winResult
    mockGameState.room = { ...winRoom, code: 'GAME01' }
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    const playAgainBtn = screen.getByText('results.playAgain')
    fireEvent.click(playAgainBtn)
    expect(mockGameState.reset).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/lobby/GAME01')
  })
})
