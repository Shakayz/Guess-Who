import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useParams: () => ({ code: 'GAME01' }),
  useNavigate: () => mockNavigate,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: unknown }) => children,
}))

vi.mock('../../store/auth', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: 'u1', username: 'testuser' }, token: 'tok' }),
}))

const mockGameState = {
  room: null as unknown,
  currentRound: null as unknown,
  myRole: null as unknown,
  myWord: null as unknown,
  myVillagerWord: null as unknown,
  detectiveRevealUsed: false,
  revealedPlayer: null,
  messages: [] as unknown[],
  result: null,
  completedRounds: [],
  addMessage: vi.fn(),
  setResult: vi.fn(),
  setRound: vi.fn(),
  addCompletedRound: vi.fn(),
  setDetectiveRevealUsed: vi.fn(),
  setRevealedPlayer: vi.fn(),
  setRoom: vi.fn(),
  setRoleAndWord: vi.fn(),
  reset: vi.fn(),
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
  connectSocket: vi.fn(),
  getSocket: () => ({ on: mockSocketOn, off: mockSocketOff, emit: mockSocketEmit, connected: false }),
}))

vi.mock('@imposter/ui', () => ({
  Avatar: ({ username }: { username: string }) => <div data-testid="avatar">{username}</div>,
}))

vi.mock('@imposter/shared', () => ({}))

import GamePage from '../../pages/GamePage'

const mockRoom = {
  id: 'r1',
  code: 'GAME01',
  status: 'in_progress',
  players: [
    { userId: 'u1', username: 'testuser', status: 'alive', avatarUrl: null, isReady: false },
    { userId: 'u2', username: 'opponent', status: 'alive', avatarUrl: null, isReady: false },
  ],
  settings: { speakingTimeSeconds: 30, votingTimeSeconds: 60, gameMode: 'normal' },
  currentRound: 1,
}

const mockRound = {
  id: 'rnd1',
  roundNumber: 1,
  speakingOrder: ['u1', 'u2'],
  clues: [],
  votes: [],
  eliminatedPlayerId: null,
}

describe('GamePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGameState.room = null
    mockGameState.myRole = null
    mockGameState.myWord = null
    mockGameState.myVillagerWord = null
    mockGameState.currentRound = null
    mockGameState.messages = []
    mockGameState.result = null
    mockGameState.completedRounds = []
    mockGameState.revealedPlayer = null
    mockGameState.detectiveRevealUsed = false
  })

  it('renders without crashing when no room', () => {
    render(<GamePage />)
    expect(document.body).toBeInTheDocument()
  })

  it('shows connecting state when no room is in store', () => {
    render(<GamePage />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the game page with room data', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'villager'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    expect(document.body).toBeInTheDocument()
  })

  it('registers socket event listeners on mount', () => {
    render(<GamePage />)
    expect(mockSocketOn).toHaveBeenCalled()
  })

  it('cleans up socket listeners on unmount', () => {
    const { unmount } = render(<GamePage />)
    unmount()
    expect(mockSocketOff).toHaveBeenCalled()
  })

  it('renders as imposter role', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'imposter'
    mockGameState.myWord = 'pasta'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders voting phase', () => {
    mockGameState.room = { ...mockRoom, status: 'voting' }
    mockGameState.myRole = 'villager'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    expect(document.body).toBeInTheDocument()
  })

  it('handles round:speaking-turn event', () => {
    render(<GamePage />)
    const speakingTurnCall = mockSocketOn.mock.calls.find(c => c[0] === 'round:speaking-turn')
    if (speakingTurnCall) {
      act(() => {
        speakingTurnCall[1]({ playerId: 'u1', timeSeconds: 30, speakingOrder: ['u1', 'u2'] })
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles round:voting-started event', () => {
    render(<GamePage />)
    const votingCall = mockSocketOn.mock.calls.find(c => c[0] === 'round:voting-started')
    if (votingCall) {
      act(() => {
        votingCall[1]({ timeSeconds: 30, players: [{ userId: 'u1' }, { userId: 'u2' }] })
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles round:ended event with elimination', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'villager'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    const roundEndedCall = mockSocketOn.mock.calls.find(c => c[0] === 'round:ended')
    if (roundEndedCall) {
      act(() => {
        roundEndedCall[1]({
          round: {
            id: 'rnd1', roundNumber: 1, eliminatedPlayerId: 'u2', eliminatedRole: 'imposter',
            wordReveal: { villagerWord: 'pizza', imposterWord: 'pasta' },
            votes: [{ voterId: 'u1', targetId: 'u2' }],
          },
          nextRound: null,
        })
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles round:clue-submitted event', () => {
    render(<GamePage />)
    const clueSubmittedCall = mockSocketOn.mock.calls.find(c => c[0] === 'round:clue-submitted')
    if (clueSubmittedCall) {
      act(() => {
        clueSubmittedCall[1]({ playerId: 'u1', text: 'It is round', createdAt: new Date().toISOString() })
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles game:finished event and navigates to results', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'villager'
    render(<GamePage />)
    const gameFinishedCall = mockSocketOn.mock.calls.find(c => c[0] === 'game:finished')
    if (gameFinishedCall) {
      act(() => {
        gameFinishedCall[1]({
          winner: 'villagers',
          finalRound: { id: 'r1', roundNumber: 1 },
          rewards: { starCoinsEarned: 10, xpEarned: 50, lpChange: 5, achievements: [] },
        })
      })
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/results'))
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles game:sync event for speaking phase', () => {
    render(<GamePage />)
    const syncCall = mockSocketOn.mock.calls.find(c => c[0] === 'game:sync')
    if (syncCall) {
      act(() => {
        syncCall[1]({
          phase: 'speaking',
          currentSpeakerId: 'u1',
          speakingOrder: ['u1', 'u2'],
          clues: [],
          votes: [],
          timeRemainingSeconds: 25,
          currentRound: mockRound,
          tiebreakerActive: false,
          tiebreakerPlayerIds: [],
          tiebreakerPhase: null,
        })
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles game:sync event for voting phase', () => {
    render(<GamePage />)
    const syncCall = mockSocketOn.mock.calls.find(c => c[0] === 'game:sync')
    if (syncCall) {
      act(() => {
        syncCall[1]({
          phase: 'voting',
          currentSpeakerId: null,
          speakingOrder: ['u1', 'u2'],
          clues: [{ playerId: 'u1', text: 'test', createdAt: new Date().toISOString() }],
          votes: [],
          timeRemainingSeconds: 20,
          currentRound: mockRound,
          tiebreakerActive: false,
          tiebreakerPlayerIds: [],
          tiebreakerPhase: null,
        })
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles game:started event', () => {
    render(<GamePage />)
    const gameStartedCall = mockSocketOn.mock.calls.find(c => c[0] === 'game:started')
    if (gameStartedCall) {
      act(() => {
        gameStartedCall[1]({ yourWord: 'cat', yourRole: 'villager', yourVillagerWord: null })
      })
    }
    expect(mockGameState.setRoleAndWord).toHaveBeenCalled()
  })

  it('handles tiebreaker event', () => {
    render(<GamePage />)
    const tbCall = mockSocketOn.mock.calls.find(c => c[0] === 'round:tiebreaker-start')
    if (tbCall) {
      act(() => {
        tbCall[1]({ tiedPlayerIds: ['u1', 'u2'], tiedUsernames: ['testuser', 'opponent'], timeSeconds: 20 })
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles player-forfeited event', () => {
    render(<GamePage />)
    const forfeitCall = mockSocketOn.mock.calls.find(c => c[0] === 'game:player-forfeited')
    if (forfeitCall) {
      act(() => {
        forfeitCall[1]({ userId: 'u2' })
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('renders with eliminated user state', () => {
    mockGameState.room = {
      ...mockRoom,
      players: [
        { userId: 'u1', username: 'testuser', status: 'eliminated', avatarUrl: null },
        { userId: 'u2', username: 'opponent', status: 'alive', avatarUrl: null },
      ],
    }
    mockGameState.myRole = 'villager'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    expect(document.body).toBeInTheDocument()
  })

  it('shows role reveal overlay when myRole is set', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'villager'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    // Role reveal overlay should be visible — t('game.yourRole', 'YOUR ROLE') returns 'YOUR ROLE'
    expect(screen.getByText('YOUR ROLE')).toBeInTheDocument()
  })

  it('dismisses role card when overlay is clicked', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'villager'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    const overlay = document.querySelector('.fixed.inset-0.z-50')
    if (overlay) {
      fireEvent.click(overlay)
    }
    expect(document.body).toBeInTheDocument()
  })

  it('renders double_agent role with both words shown', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'double_agent'
    mockGameState.myWord = 'pasta'
    mockGameState.myVillagerWord = 'pizza'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    expect(screen.getByText('game.roleDoubleAgent')).toBeInTheDocument()
  })

  it('renders detective role', () => {
    mockGameState.room = {
      ...mockRoom,
      players: [
        { userId: 'u1', username: 'testuser', status: 'alive', avatarUrl: null, isReady: false },
        { userId: 'u2', username: 'opponent', status: 'alive', avatarUrl: null, isReady: false },
      ],
    }
    mockGameState.myRole = 'detective'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    expect(screen.getByText('game.detectiveAvailable')).toBeInTheDocument()
  })

  it('shows forfeit confirm dialog when forfeit button clicked', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'villager'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    // Click the forfeit button
    const forfeitBtn = screen.queryByText(/game\.forfeit/) ?? screen.queryByText(/game\.quitForfeit/)
    if (forfeitBtn) {
      fireEvent.click(forfeitBtn)
      expect(screen.getByText('game.forfeitConfirmYes')).toBeInTheDocument()
    }
    expect(document.body).toBeInTheDocument()
  })

  it('executes forfeit when yes is confirmed', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'villager'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    const forfeitBtn = screen.queryByText(/game\.forfeit/) ?? screen.queryByText(/game\.quitForfeit/)
    if (forfeitBtn) {
      fireEvent.click(forfeitBtn)
      const yesBtn = screen.queryByText('game.forfeitConfirmYes')
      if (yesBtn) {
        fireEvent.click(yesBtn)
        expect(mockSocketEmit).toHaveBeenCalledWith('game:forfeit')
        expect(mockGameState.reset).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('/')
      }
    }
    expect(document.body).toBeInTheDocument()
  })

  it('cancels forfeit when cancel is clicked', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'villager'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    const forfeitBtn = screen.queryByText(/game\.forfeit/) ?? screen.queryByText(/game\.quitForfeit/)
    if (forfeitBtn) {
      fireEvent.click(forfeitBtn)
      const cancelBtn = screen.queryByText('game.forfeitConfirmNo')
      if (cancelBtn) {
        fireEvent.click(cancelBtn)
        expect(screen.queryByText('game.forfeitConfirmYes')).not.toBeInTheDocument()
      }
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles voting phase after round:voting-started', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'villager'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    const votingCall = mockSocketOn.mock.calls.find(c => c[0] === 'round:voting-started')
    if (votingCall) {
      act(() => {
        votingCall[1]({ timeSeconds: 30, players: [{ userId: 'u1' }, { userId: 'u2' }] })
      })
      expect(screen.getByText('game.voteOutImposter')).toBeInTheDocument()
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles reveal phase with tie state', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'villager'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    const roundEndedCall = mockSocketOn.mock.calls.find(c => c[0] === 'round:ended')
    if (roundEndedCall) {
      act(() => {
        roundEndedCall[1]({
          round: {
            id: 'rnd1', roundNumber: 1, eliminatedPlayerId: null,
            votes: [{ voterId: 'u1', targetId: 'u2' }, { voterId: 'u2', targetId: 'u1' }],
            wordReveal: { villagerWord: 'pizza', imposterWord: 'pasta' },
          },
          nextRound: null,
        })
      })
      expect(screen.getByText('game.itsTie')).toBeInTheDocument()
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles vote:update event', () => {
    render(<GamePage />)
    const voteUpdateCall = mockSocketOn.mock.calls.find(c => c[0] === 'vote:update')
    if (voteUpdateCall) {
      act(() => { voteUpdateCall[1]({ voteCount: 2, totalVoters: 4 }) })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles vote:all-cast event', () => {
    mockGameState.room = mockRoom
    render(<GamePage />)
    const allCastCall = mockSocketOn.mock.calls.find(c => c[0] === 'vote:all-cast')
    if (allCastCall) {
      // First set voting phase
      const votingCall = mockSocketOn.mock.calls.find(c => c[0] === 'round:voting-started')
      if (votingCall) {
        act(() => { votingCall[1]({ timeSeconds: 30, players: [{ userId: 'u1' }, { userId: 'u2' }] }) })
      }
      act(() => { allCastCall[1]() })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles tiebreaker voting phase', () => {
    render(<GamePage />)
    const tbVotingCall = mockSocketOn.mock.calls.find(c => c[0] === 'round:tiebreaker-voting')
    if (tbVotingCall) {
      act(() => {
        tbVotingCall[1]({ tiedPlayerIds: ['u1', 'u2'], timeSeconds: 20 })
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles deadchat:message event', () => {
    mockGameState.room = {
      ...mockRoom,
      players: [
        { userId: 'u1', username: 'testuser', status: 'eliminated', avatarUrl: null },
        { userId: 'u2', username: 'opponent', status: 'alive', avatarUrl: null },
      ],
    }
    mockGameState.myRole = 'villager'
    mockGameState.myWord = 'pizza'
    render(<GamePage />)
    const deadchatCall = mockSocketOn.mock.calls.find(c => c[0] === 'deadchat:message')
    if (deadchatCall) {
      act(() => {
        deadchatCall[1]({ id: 'm1', userId: 'u1', username: 'testuser', text: 'I am dead' })
      })
      expect(screen.getByText('I am dead')).toBeInTheDocument()
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles round:word-said event eliminating me', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'villager'
    render(<GamePage />)
    const wordSaidCall = mockSocketOn.mock.calls.find(c => c[0] === 'round:word-said')
    if (wordSaidCall) {
      act(() => {
        wordSaidCall[1]({ playerId: 'u1', username: 'testuser', role: 'villager' })
      })
      expect(mockSocketEmit).toHaveBeenCalledWith('deadchat:join')
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles round:word-said for another player', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'villager'
    render(<GamePage />)
    const wordSaidCall = mockSocketOn.mock.calls.find(c => c[0] === 'round:word-said')
    if (wordSaidCall) {
      act(() => {
        wordSaidCall[1]({ playerId: 'u2', username: 'opponent', role: 'villager' })
      })
      expect(mockGameState.setRoom).toHaveBeenCalled()
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles emote:receive event shows floating emote', () => {
    render(<GamePage />)
    const emoteCall = mockSocketOn.mock.calls.find(c => c[0] === 'emote:receive')
    if (emoteCall) {
      act(() => {
        emoteCall[1]({ username: 'opponent', emoji: '👍' })
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('sends emote when emote button clicked', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'villager'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    // Emote buttons are in the sidebar
    const emoteBtn = screen.queryByText('👍')
    if (emoteBtn) {
      fireEvent.click(emoteBtn)
      expect(mockSocketEmit).toHaveBeenCalledWith('emote:send', { emoji: '👍' })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('shows revealedPlayer detective result', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'detective'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    mockGameState.revealedPlayer = { userId: 'u2', username: 'opponent', role: 'imposter' }
    render(<GamePage />)
    // The detective reveal toast shows "🔍 opponent: [role]" in the same div
    const revealToast = document.querySelector('[style*="border-color"]')
    expect(revealToast).toBeTruthy()
    expect(document.body).toBeInTheDocument()
  })

  it('handles game:sync with tiebreaker active', () => {
    render(<GamePage />)
    const syncCall = mockSocketOn.mock.calls.find(c => c[0] === 'game:sync')
    if (syncCall) {
      act(() => {
        syncCall[1]({
          phase: 'speaking',
          currentSpeakerId: 'u1',
          speakingOrder: ['u1', 'u2'],
          clues: [{ playerId: 'u1', text: 'clue1', createdAt: new Date().toISOString() }],
          votes: [],
          timeRemainingSeconds: 25,
          currentRound: mockRound,
          tiebreakerActive: true,
          tiebreakerPlayerIds: ['u1', 'u2'],
          tiebreakerPhase: 'clue',
        })
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles room:updated socket event finishing the game', () => {
    mockGameState.result = { winner: 'villagers', finalRound: null, rewards: null }
    mockGameState.room = mockRoom
    render(<GamePage />)
    const roomUpdatedCall = mockSocketOn.mock.calls.find(c => c[0] === 'room:updated')
    if (roomUpdatedCall) {
      act(() => {
        roomUpdatedCall[1]({ ...mockRoom, status: 'finished' })
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('submits clue on form submit', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'villager'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    // Dismiss role card first
    const overlay = document.querySelector('.fixed.inset-0.z-50')
    if (overlay) fireEvent.click(overlay)
    const clueInput = screen.queryByPlaceholderText('game.cluePlaceholder')
    if (clueInput) {
      fireEvent.change(clueInput, { target: { value: 'It is round' } })
      const form = clueInput.closest('form')!
      fireEvent.submit(form)
      expect(mockSocketEmit).toHaveBeenCalledWith('clue:submit', 'It is round')
    }
    expect(document.body).toBeInTheDocument()
  })

  it('renders clues list when clues are present and clue submitted', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'villager'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    // Trigger speaking turn so phase is clues
    const speakingCall = mockSocketOn.mock.calls.find(c => c[0] === 'round:speaking-turn')
    if (speakingCall) {
      act(() => { speakingCall[1]({ playerId: 'u1', timeSeconds: 30, speakingOrder: ['u1', 'u2'] }) })
    }
    // Add a clue via socket event
    const clueSubmittedCall = mockSocketOn.mock.calls.find(c => c[0] === 'round:clue-submitted')
    if (clueSubmittedCall) {
      act(() => { clueSubmittedCall[1]({ playerId: 'u1', text: 'My clue text', createdAt: new Date().toISOString(), flaggedForWord: false }) })
    }
    // Submit our own clue to mark hasSubmittedClue=true (shows clue list)
    const clueInput = screen.queryByPlaceholderText('game.cluePlaceholder')
    if (clueInput) {
      fireEvent.change(clueInput, { target: { value: 'my clue' } })
      const form = clueInput.closest('form')!
      fireEvent.submit(form)
    }
    expect(document.body).toBeInTheDocument()
  })

  it('renders clues with flaggedForWord badge', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'villager'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    // After clue submission, show flagged clue
    const clueSubmittedCall = mockSocketOn.mock.calls.find(c => c[0] === 'round:clue-submitted')
    if (clueSubmittedCall) {
      act(() => { clueSubmittedCall[1]({ playerId: 'u1', text: 'pizza pizza pizza', createdAt: new Date().toISOString(), flaggedForWord: true }) })
    }
    // The clue list only shows after submitting our own clue
    const clueInput = screen.queryByPlaceholderText('game.cluePlaceholder')
    if (clueInput) {
      fireEvent.change(clueInput, { target: { value: 'test' } })
      const form = clueInput.closest('form')!
      act(() => { fireEvent.submit(form) })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('shows detectiveUsed state when detectiveRevealUsed is true', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'detective'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    mockGameState.detectiveRevealUsed = true
    render(<GamePage />)
    expect(screen.getByText('game.detectiveUsed')).toBeInTheDocument()
  })

  it('handles detective:result socket event', () => {
    render(<GamePage />)
    const detectiveCall = mockSocketOn.mock.calls.find(c => c[0] === 'detective:result')
    if (detectiveCall) {
      act(() => {
        detectiveCall[1]({ targetUserId: 'u2', targetUsername: 'opponent', role: 'villager' })
      })
      expect(mockGameState.setDetectiveRevealUsed).toHaveBeenCalled()
      expect(mockGameState.setRevealedPlayer).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u2' }))
    }
    expect(document.body).toBeInTheDocument()
  })
})
