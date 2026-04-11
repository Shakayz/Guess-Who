import {
  applyCorruptorSilencing,
  finalizeRound,
  findEligibleJudge,
  resolveElimination,
  tallyFilteredVotes,
  type VotablePlayer,
  type VoteRecord,
} from './voteResolution'

const player = (name: string, role: VotablePlayer['role']): VotablePlayer => ({
  name,
  role,
})

describe('applyCorruptorSilencing', () => {
  it('returns an empty set when no corruptor is alive', () => {
    const alive = [player('Alice', 'villager'), player('Bob', 'imposter')]
    const silenced = applyCorruptorSilencing(alive, {})
    expect(silenced.size).toBe(0)
  })

  it('silences the corruptor target', () => {
    const alive = [
      player('Alice', 'villager'),
      player('Eve', 'corruptor'),
      player('Bob', 'imposter'),
    ]
    const silenced = applyCorruptorSilencing(alive, { Eve: 'Alice' })
    expect(silenced.has('Alice')).toBe(true)
    expect(silenced.size).toBe(1)
  })

  it('handles multiple corruptors silencing different targets', () => {
    const alive = [
      player('Eve', 'corruptor'),
      player('Mallory', 'corruptor'),
      player('Alice', 'villager'),
      player('Bob', 'villager'),
    ]
    const silenced = applyCorruptorSilencing(alive, { Eve: 'Alice', Mallory: 'Bob' })
    expect(silenced).toEqual(new Set(['Alice', 'Bob']))
  })

  it('ignores corruptors that have not picked a target', () => {
    const alive = [player('Eve', 'corruptor'), player('Alice', 'villager')]
    const silenced = applyCorruptorSilencing(alive, {})
    expect(silenced.size).toBe(0)
  })
})

describe('tallyFilteredVotes', () => {
  it('counts every vote when no one is silenced', () => {
    const votes: VoteRecord[] = [
      { voterName: 'Alice', targetName: 'Bob' },
      { voterName: 'Carol', targetName: 'Bob' },
      { voterName: 'Dave', targetName: 'Eve' },
    ]
    const result = tallyFilteredVotes(votes, new Set())
    expect(result.tally).toEqual({ Bob: 2, Eve: 1 })
    expect(result.totalCounted).toBe(3)
  })

  it('drops votes from silenced voters', () => {
    const votes: VoteRecord[] = [
      { voterName: 'Alice', targetName: 'Bob' },
      { voterName: 'Carol', targetName: 'Bob' },
      { voterName: 'Dave', targetName: 'Eve' },
    ]
    const result = tallyFilteredVotes(votes, new Set(['Carol']))
    expect(result.tally).toEqual({ Bob: 1, Eve: 1 })
    expect(result.totalCounted).toBe(2)
  })

  it('reflects mayor double-vote when caller has appended an extra record', () => {
    const votes: VoteRecord[] = [
      { voterName: 'Mayor', targetName: 'Bob' },
      { voterName: 'Mayor', targetName: 'Bob' }, // mayor double
      { voterName: 'Alice', targetName: 'Carol' },
    ]
    const result = tallyFilteredVotes(votes, new Set())
    expect(result.tally.Bob).toBe(2)
    expect(result.totalCounted).toBe(3)
  })
})

describe('resolveElimination', () => {
  it('returns null when nobody voted', () => {
    const r = resolveElimination({})
    expect(r.eliminatedName).toBeNull()
    expect(r.isTie).toBe(false)
    expect(r.topCandidates).toEqual([])
  })

  it('eliminates a clear majority', () => {
    const r = resolveElimination({ Alice: 3, Bob: 1 })
    expect(r.eliminatedName).toBe('Alice')
    expect(r.isTie).toBe(false)
  })

  it('reports a tie at the top', () => {
    const r = resolveElimination({ Alice: 2, Bob: 2, Carol: 1 })
    expect(r.isTie).toBe(true)
    expect(r.eliminatedName).toBeNull()
    expect(new Set(r.topCandidates)).toEqual(new Set(['Alice', 'Bob']))
  })

  it('inverter flips to lowest count', () => {
    const r = resolveElimination({ Alice: 3, Bob: 1, Carol: 2 }, { inverterActive: true })
    expect(r.eliminatedName).toBe('Bob')
  })

  it('inverter still ties when low counts tie', () => {
    const r = resolveElimination({ Alice: 3, Bob: 1, Carol: 1 }, { inverterActive: true })
    expect(r.isTie).toBe(true)
    expect(new Set(r.topCandidates)).toEqual(new Set(['Bob', 'Carol']))
  })
})

describe('findEligibleJudge', () => {
  it('returns the judge when they are not in the tied set', () => {
    const alive = [
      player('Alice', 'villager'),
      player('Judge', 'judge'),
      player('Bob', 'imposter'),
    ]
    const judge = findEligibleJudge(alive, ['Alice', 'Bob'])
    expect(judge?.name).toBe('Judge')
  })

  it('refuses a judge who is themselves tied', () => {
    const alive = [player('Alice', 'villager'), player('Judge', 'judge')]
    const judge = findEligibleJudge(alive, ['Judge', 'Alice'])
    expect(judge).toBeUndefined()
  })

  it('returns undefined when no judge is alive', () => {
    const alive = [player('Alice', 'villager'), player('Bob', 'imposter')]
    expect(findEligibleJudge(alive, ['Alice', 'Bob'])).toBeUndefined()
  })
})

describe('finalizeRound', () => {
  const alive: VotablePlayer[] = [
    player('Alice', 'villager'),
    player('Bob', 'imposter'),
    player('Carol', 'villager'),
    player('Eve', 'corruptor'),
    player('Judge', 'judge'),
  ]

  it('runs the full pipeline and eliminates the majority target', () => {
    const votes: VoteRecord[] = [
      { voterName: 'Alice', targetName: 'Bob' },
      { voterName: 'Carol', targetName: 'Bob' },
      { voterName: 'Eve', targetName: 'Alice' },
      { voterName: 'Judge', targetName: 'Bob' },
    ]
    const result = finalizeRound(votes, alive, {})
    expect(result.silencedVoterNames.size).toBe(0)
    expect(result.filtered.totalCounted).toBe(4)
    expect(result.resolution.eliminatedName).toBe('Bob')
    expect(result.judgeForTie).toBeNull()
  })

  it('drops the silenced voter and reports a judge for the resulting tie', () => {
    // Eve corruptor silences Alice. Without Alice's vote, Bob and Carol tie 2-2.
    const votes: VoteRecord[] = [
      { voterName: 'Alice', targetName: 'Bob' }, // silenced
      { voterName: 'Carol', targetName: 'Bob' },
      { voterName: 'Eve', targetName: 'Bob' },
      { voterName: 'Bob', targetName: 'Carol' },
      { voterName: 'Judge', targetName: 'Carol' },
    ]
    const result = finalizeRound(votes, alive, { Eve: 'Alice' })
    expect(result.silencedVoterNames.has('Alice')).toBe(true)
    expect(result.filtered.totalCounted).toBe(4)
    expect(result.filtered.tally).toEqual({ Bob: 2, Carol: 2 })
    expect(result.resolution.isTie).toBe(true)
    expect(new Set(result.resolution.topCandidates)).toEqual(new Set(['Bob', 'Carol']))
    expect(result.judgeForTie?.name).toBe('Judge')
  })

  it('respects inverterActive in the resolution stage', () => {
    const votes: VoteRecord[] = [
      { voterName: 'Alice', targetName: 'Bob' },
      { voterName: 'Carol', targetName: 'Bob' },
      { voterName: 'Eve', targetName: 'Bob' },
      { voterName: 'Bob', targetName: 'Carol' },
      { voterName: 'Judge', targetName: 'Carol' },
    ]
    const result = finalizeRound(votes, alive, {}, { inverterActive: true })
    // Bob has 3 votes, Carol has 2 → inverter flips, Carol eliminated
    expect(result.resolution.eliminatedName).toBe('Carol')
  })
})
