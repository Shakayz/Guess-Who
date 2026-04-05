import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '../store/game'
import { useSocialStore } from '../store/social'
import type { Room, Round, ChatMessage } from '@imposter/shared'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeRoom = (overrides: Partial<Room> = {}): Room => ({
  id: 'room-1',
  code: 'ABC123',
  hostId: 'user-1',
  status: 'waiting',
  players: [],
  settings: {
    maxPlayers: 8,
    minPlayers: 3,
    imposterCount: 1,
    speakingTimeSeconds: 30,
    votingTimeSeconds: 60,
    wordPackId: 'default',
    isPrivate: false,
    language: 'en',
    gameMode: 'normal',
    categories: [],
  },
  currentRound: 0,
  maxRounds: 5,
  createdAt: new Date().toISOString(),
  ...overrides,
})

const makeRound = (overrides: Partial<Round> = {}): Round => ({
  id: 'round-1',
  roundNumber: 1,
  speakingOrder: [],
  clues: [],
  votes: [],
  eliminatedPlayerId: null,
  eliminatedRole: null,
  wordReveal: null,
  ...overrides,
})

const makeMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'msg-1',
  senderId: 'user-1',
  senderName: 'alice',
  text: 'hello',
  timestamp: new Date().toISOString(),
  type: 'chat',
  ...overrides,
})

// ─── Game Store ───────────────────────────────────────────────────────────────

describe('useGameStore', () => {
  beforeEach(() => {
    useGameStore.setState({
      room: null,
      currentRound: null,
      completedRounds: [],
      myRole: null,
      myWord: null,
      myVillagerWord: null,
      detectiveRevealUsed: false,
      revealedPlayer: null,
      messages: [],
      result: null,
      gameFinished: false,
      lastResetAt: 0,
    })
  })

  it('starts with all null / empty initial state', () => {
    const state = useGameStore.getState()
    expect(state.room).toBeNull()
    expect(state.currentRound).toBeNull()
    expect(state.completedRounds).toEqual([])
    expect(state.myRole).toBeNull()
    expect(state.myWord).toBeNull()
    expect(state.messages).toEqual([])
    expect(state.result).toBeNull()
    expect(state.gameFinished).toBe(false)
    expect(state.detectiveRevealUsed).toBe(false)
  })

  it('setRoom stores the room', () => {
    const room = makeRoom()
    useGameStore.getState().setRoom(room)
    expect(useGameStore.getState().room).toEqual(room)
  })

  it('setRound stores the current round', () => {
    const round = makeRound()
    useGameStore.getState().setRound(round)
    expect(useGameStore.getState().currentRound).toEqual(round)
  })

  it('addCompletedRound appends to completedRounds', () => {
    const r1 = makeRound({ id: 'r1', roundNumber: 1 })
    const r2 = makeRound({ id: 'r2', roundNumber: 2 })
    useGameStore.getState().addCompletedRound(r1)
    useGameStore.getState().addCompletedRound(r2)
    expect(useGameStore.getState().completedRounds).toHaveLength(2)
    expect(useGameStore.getState().completedRounds[1].id).toBe('r2')
  })

  it('addCompletedRound keeps at most 20 rounds', () => {
    for (let i = 1; i <= 25; i++) {
      useGameStore.getState().addCompletedRound(makeRound({ id: `r${i}`, roundNumber: i }))
    }
    expect(useGameStore.getState().completedRounds).toHaveLength(20)
    // Should keep the newest ones
    expect(useGameStore.getState().completedRounds[19].roundNumber).toBe(25)
  })

  it('setRoleAndWord sets role, word, and villagerWord', () => {
    useGameStore.getState().setRoleAndWord('imposter', 'cat', 'dog')
    const state = useGameStore.getState()
    expect(state.myRole).toBe('imposter')
    expect(state.myWord).toBe('cat')
    expect(state.myVillagerWord).toBe('dog')
  })

  it('setRoleAndWord sets myVillagerWord to null when villagerWord is omitted', () => {
    useGameStore.getState().setRoleAndWord('villager', 'pizza')
    expect(useGameStore.getState().myVillagerWord).toBeNull()
  })

  it('setDetectiveRevealUsed sets detectiveRevealUsed to true', () => {
    useGameStore.getState().setDetectiveRevealUsed()
    expect(useGameStore.getState().detectiveRevealUsed).toBe(true)
  })

  it('setRevealedPlayer stores revealed player info', () => {
    const p = { userId: 'u1', username: 'bob', role: 'imposter' }
    useGameStore.getState().setRevealedPlayer(p)
    expect(useGameStore.getState().revealedPlayer).toEqual(p)
  })

  it('addMessage appends chat messages', () => {
    const msg = makeMessage()
    useGameStore.getState().addMessage(msg)
    expect(useGameStore.getState().messages).toHaveLength(1)
    expect(useGameStore.getState().messages[0]).toEqual(msg)
  })

  it('addMessage caps messages at 100', () => {
    for (let i = 0; i < 105; i++) {
      useGameStore.getState().addMessage(makeMessage({ id: `msg-${i}`, text: `text ${i}` }))
    }
    expect(useGameStore.getState().messages).toHaveLength(100)
    // Latest message should be the last one added
    expect(useGameStore.getState().messages[99].text).toBe('text 104')
  })

  it('setResult stores result and sets gameFinished to true', () => {
    const result = {
      winner: 'villagers' as const,
      finalRound: makeRound(),
      rewards: { starCoinsEarned: 10, xpEarned: 50, lpChange: 5, achievements: [] },
    }
    useGameStore.getState().setResult(result)
    const state = useGameStore.getState()
    expect(state.result).toEqual(result)
    expect(state.gameFinished).toBe(true)
  })

  it('setGameFinished updates the gameFinished flag', () => {
    useGameStore.getState().setGameFinished(true)
    expect(useGameStore.getState().gameFinished).toBe(true)
    useGameStore.getState().setGameFinished(false)
    expect(useGameStore.getState().gameFinished).toBe(false)
  })

  it('reset clears all game state and records lastResetAt', () => {
    // Populate state first
    useGameStore.getState().setRoom(makeRoom())
    useGameStore.getState().setRoleAndWord('imposter', 'cat')
    useGameStore.getState().addMessage(makeMessage())

    const beforeReset = Date.now()
    useGameStore.getState().reset()

    const state = useGameStore.getState()
    expect(state.room).toBeNull()
    expect(state.myRole).toBeNull()
    expect(state.myWord).toBeNull()
    expect(state.messages).toEqual([])
    expect(state.gameFinished).toBe(false)
    expect(state.lastResetAt).toBeGreaterThanOrEqual(beforeReset)
  })
})

// ─── Social Store ─────────────────────────────────────────────────────────────

describe('useSocialStore', () => {
  beforeEach(() => {
    useSocialStore.setState({
      activeDm: null,
      unreadCounts: {},
      pendingInvite: null,
      pendingFriendRequest: null,
    })
  })

  it('starts with null activeDm', () => {
    expect(useSocialStore.getState().activeDm).toBeNull()
  })

  it('setActiveDm stores a DM conversation', () => {
    const dm = { friendId: 'u2', friendUsername: 'bob' }
    useSocialStore.getState().setActiveDm(dm)
    expect(useSocialStore.getState().activeDm).toEqual(dm)
  })

  it('setActiveDm can clear the active DM with null', () => {
    useSocialStore.getState().setActiveDm({ friendId: 'u2', friendUsername: 'bob' })
    useSocialStore.getState().setActiveDm(null)
    expect(useSocialStore.getState().activeDm).toBeNull()
  })

  it('incrementUnread increases count for a friendId', () => {
    useSocialStore.getState().incrementUnread('u2')
    useSocialStore.getState().incrementUnread('u2')
    expect(useSocialStore.getState().unreadCounts['u2']).toBe(2)
  })

  it('incrementUnread starts from 0 for new friendId', () => {
    useSocialStore.getState().incrementUnread('u3')
    expect(useSocialStore.getState().unreadCounts['u3']).toBe(1)
  })

  it('clearUnread removes the friendId from unreadCounts', () => {
    useSocialStore.getState().incrementUnread('u2')
    useSocialStore.getState().incrementUnread('u2')
    useSocialStore.getState().clearUnread('u2')
    expect(useSocialStore.getState().unreadCounts['u2']).toBeUndefined()
  })

  it('clearUnread does not affect other friendIds', () => {
    useSocialStore.getState().incrementUnread('u2')
    useSocialStore.getState().incrementUnread('u3')
    useSocialStore.getState().clearUnread('u2')
    expect(useSocialStore.getState().unreadCounts['u3']).toBe(1)
  })

  it('setPendingInvite stores an invite', () => {
    const invite = { fromUsername: 'bob', roomCode: 'XYZ123' }
    useSocialStore.getState().setPendingInvite(invite)
    expect(useSocialStore.getState().pendingInvite).toEqual(invite)
  })

  it('setPendingInvite can be cleared with null', () => {
    useSocialStore.getState().setPendingInvite({ fromUsername: 'bob', roomCode: 'XYZ' })
    useSocialStore.getState().setPendingInvite(null)
    expect(useSocialStore.getState().pendingInvite).toBeNull()
  })

  it('setPendingFriendRequest stores a friend request', () => {
    const req = { friendshipId: 'f1', fromId: 'u2', fromUsername: 'carol' }
    useSocialStore.getState().setPendingFriendRequest(req)
    expect(useSocialStore.getState().pendingFriendRequest).toEqual(req)
  })

  it('setPendingFriendRequest can be cleared with null', () => {
    useSocialStore.getState().setPendingFriendRequest({ friendshipId: 'f1', fromId: 'u2', fromUsername: 'carol' })
    useSocialStore.getState().setPendingFriendRequest(null)
    expect(useSocialStore.getState().pendingFriendRequest).toBeNull()
  })
})
