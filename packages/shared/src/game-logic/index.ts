import type { Player, Round, Vote, PlayerStatus } from '../types'

export function countAlive(players: Player[]): { villagers: number; imposters: number } {
  const alive = players.filter((p) => p.status === 'alive')
  return {
    villagers: alive.filter((p) => p.role === 'villager' || p.role === 'detective').length,
    imposters: alive.filter((p) => p.role === 'imposter' || p.role === 'double_agent').length,
  }
}

export function checkWinCondition(players: Player[]): 'villagers' | 'imposters' | null {
  const { villagers, imposters } = countAlive(players)
  if (imposters === 0) return 'villagers'
  if (imposters >= villagers) return 'imposters'
  return null
}

export function getMostVoted(votes: Vote[]): string | null {
  if (votes.length === 0) return null
  const tally: Record<string, number> = {}
  for (const v of votes) {
    tally[v.targetId] = (tally[v.targetId] ?? 0) + 1
  }
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1])
  if (sorted.length < 2 || sorted[0][1] !== sorted[1][1]) {
    return sorted[0][0]
  }
  return null // tie
}

export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}
