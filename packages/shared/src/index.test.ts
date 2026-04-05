import * as SharedExports from './index'

describe('shared barrel exports', () => {
  it('exports constants', () => {
    expect(SharedExports.RANK_TIERS).toBeDefined()
    expect(SharedExports.RANK_CONFIG).toBeDefined()
    expect(SharedExports.HONOR_TYPES).toBeDefined()
    expect(SharedExports.SUPPORTED_LOCALES).toBeDefined()
    expect(SharedExports.DEFAULT_ROOM_SETTINGS).toBeDefined()
    expect(SharedExports.COIN_REWARDS).toBeDefined()
    expect(SharedExports.LP_DECAY).toBeDefined()
    expect(SharedExports.MATCHMAKING_CONFIG).toBeDefined()
    expect(SharedExports.LP_REWARDS).toBeDefined()
  })

  it('exports game-logic functions', () => {
    expect(typeof SharedExports.countAlive).toBe('function')
    expect(typeof SharedExports.checkWinCondition).toBe('function')
    expect(typeof SharedExports.getMostVoted).toBe('function')
    expect(typeof SharedExports.getTiedPlayerIds).toBe('function')
    expect(typeof SharedExports.shuffleArray).toBe('function')
    expect(typeof SharedExports.generateRoomCode).toBe('function')
  })

  it('exports utils functions', () => {
    expect(typeof SharedExports.formatDate).toBe('function')
    expect(typeof SharedExports.clamp).toBe('function')
    expect(typeof SharedExports.sleep).toBe('function')
  })

  it('exports WORD_CATEGORIES constant from types', () => {
    expect(SharedExports.WORD_CATEGORIES).toBeDefined()
    expect(Array.isArray(SharedExports.WORD_CATEGORIES)).toBe(true)
    expect(SharedExports.WORD_CATEGORIES.length).toBeGreaterThan(0)
  })
})
