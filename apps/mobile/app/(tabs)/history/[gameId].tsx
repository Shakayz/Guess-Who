import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { api } from '../../../lib/api'
import { useAuthStore } from '../../../store/auth'
import { useResponsive } from '../../../lib/responsive'

interface PlayerInfo {
  username: string
  role: 'villager' | 'red_handed' | 'detective' | 'doubleAgent'
  status: 'survived' | 'eliminated'
}

interface Clue {
  playerName: string
  text: string
}

interface Vote {
  voterName: string
  targetName: string
}

interface Round {
  roundNumber: number
  clues: Clue[]
  votes: Vote[]
  eliminatedPlayer: string | null
  eliminatedRole: string | null
}

interface GameDetail {
  id: string
  winner: 'villagers' | 'red_handed'
  players: PlayerInfo[]
  rounds: Round[]
  createdAt: string
}

const ROLE_CONFIG: Record<string, { emoji: string; label: string }> = {
  villager: { emoji: '🏘️', label: 'Villager' },
  red_handed: { emoji: '🎭', label: 'Imposter' },
  detective: { emoji: '🔍', label: 'Detective' },
  double_agent: { emoji: '🕵️', label: 'Double Agent' },
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function didWin(winner: string, myRole: string): boolean {
  const villagerTeam = ['villager', 'detective']
  if (winner === 'villagers') return villagerTeam.includes(myRole)
  return !villagerTeam.includes(myRole)
}

export default function GameDetailScreen() {
  const { t } = useTranslation()
  const { gameId } = useLocalSearchParams<{ gameId: string }>()
  const user = useAuthStore((s) => s.user)

  const [game, setGame] = useState<GameDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!gameId) return
    setLoading(true)
    api
      .get<GameDetail>(`/history/${gameId}`)
      .then(setGame)
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false))
  }, [gameId])

  const toggleRound = (roundNumber: number) => {
    setExpandedRounds((prev) => {
      const next = new Set(prev)
      if (next.has(roundNumber)) {
        next.delete(roundNumber)
      } else {
        next.add(roundNumber)
      }
      return next
    })
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-950 items-center justify-center">
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text className="text-neutral-500 mt-3 text-sm">
          {t('common.loading')}
        </Text>
      </SafeAreaView>
    )
  }

  if (error || !game) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-950 items-center justify-center px-6">
        <Text className="text-red-400 text-sm text-center">
          {error ?? t('common.error')}
        </Text>
      </SafeAreaView>
    )
  }

  const { isTablet, px } = useResponsive()
  const contentStyle = isTablet ? { maxWidth: 700, alignSelf: 'center' as const, width: '100%' as const } : {}

  const me = game.players.find((p) => p.username === user?.username)
  const won = me ? didWin(game.winner, me.role) : game.winner === 'villagers'

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={contentStyle}>
        {/* Outcome Banner */}
        <View
          className={`mt-4 p-5 rounded-2xl border items-center ${
            won
              ? 'bg-emerald-950/50 border-emerald-800'
              : 'bg-red-950/50 border-red-800'
          }`}
          style={{ marginHorizontal: px }}
        >
          <Text className="text-3xl mb-2">{won ? '🏆' : '💀'}</Text>
          <Text
            className={`text-xl font-bold ${
              won ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {won ? t('results.victory') : t('results.defeat')}
          </Text>
          <Text className="text-neutral-500 text-xs mt-1">
            {game.winner === 'villagers'
              ? t('results.villagersWon')
              : t('results.redHandedWon')}
          </Text>
          <Text className="text-neutral-600 text-xs mt-2">
            {dateFormatter.format(new Date(game.createdAt))}
          </Text>
        </View>

        {/* Players Section */}
        <View className="mt-5" style={{ marginHorizontal: px }}>
          <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3 px-1">
            {t('common.players')}
          </Text>
          <View className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden">
            {game.players.map((player, index) => {
              const role = ROLE_CONFIG[player.role] ?? ROLE_CONFIG.villager
              const isMe = player.username === user?.username
              const survived = player.status === 'survived'

              return (
                <View
                  key={player.username}
                  className={`flex-row items-center px-4 py-3 ${
                    index < game.players.length - 1
                      ? 'border-b border-neutral-800'
                      : ''
                  }`}
                >
                  <View className="w-8 h-8 rounded-full bg-neutral-800 items-center justify-center mr-3">
                    <Text className="text-sm">{role.emoji}</Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-white text-sm font-semibold">
                        {player.username}
                      </Text>
                      {isMe && (
                        <View className="px-1.5 py-0.5 rounded bg-violet-900/60 border border-violet-700/40">
                          <Text className="text-violet-400 text-[10px] font-bold">
                            {t('results.you')}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-neutral-500 text-xs">
                      {role.label}
                    </Text>
                  </View>
                  <View
                    className={`px-2 py-1 rounded-lg ${
                      survived
                        ? 'bg-emerald-950 border border-emerald-800/50'
                        : 'bg-red-950 border border-red-800/50'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold ${
                        survived ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {survived
                        ? t('results.survived')
                        : t('results.eliminated')}
                    </Text>
                  </View>
                </View>
              )
            })}
          </View>
        </View>

        {/* Rounds Section */}
        <View className="mt-5" style={{ marginHorizontal: px }}>
          <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3 px-1">
            Rounds
          </Text>
          <View className="gap-3">
            {game.rounds.map((round) => {
              const expanded = expandedRounds.has(round.roundNumber)

              return (
                <View
                  key={round.roundNumber}
                  className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden"
                >
                  <TouchableOpacity
                    onPress={() => toggleRound(round.roundNumber)}
                    className="flex-row items-center justify-between px-4 py-3"
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-center gap-2">
                      <Text className="text-white font-semibold text-sm">
                        {t('game.roundNumber', {
                          number: round.roundNumber,
                        })}
                      </Text>
                      {round.eliminatedPlayer && (
                        <View className="px-2 py-0.5 rounded-md bg-red-950 border border-red-800/50">
                          <Text className="text-red-400 text-[10px] font-bold">
                            {round.eliminatedPlayer} out
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-neutral-600 text-sm">
                      {expanded ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>

                  {expanded && (
                    <View className="px-4 pb-4 gap-4">
                      {/* Clues */}
                      <View>
                        <Text className="text-xs font-semibold text-neutral-500 mb-2">
                          Clues
                        </Text>
                        {round.clues.length === 0 ? (
                          <Text className="text-neutral-600 text-xs italic">
                            {t('game.noClues')}
                          </Text>
                        ) : (
                          <View className="gap-1.5">
                            {round.clues.map((clue, i) => (
                              <View
                                key={i}
                                className="flex-row items-start gap-2"
                              >
                                <Text className="text-violet-400 text-xs font-semibold min-w-[80px]">
                                  {clue.playerName}
                                </Text>
                                <Text className="text-neutral-300 text-xs flex-1">
                                  {clue.text}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Votes */}
                      <View>
                        <Text className="text-xs font-semibold text-neutral-500 mb-2">
                          {t('common.votes')}
                        </Text>
                        {round.votes.length === 0 ? (
                          <Text className="text-neutral-600 text-xs italic">
                            No votes cast
                          </Text>
                        ) : (
                          <View className="gap-1.5">
                            {round.votes.map((vote, i) => (
                              <View
                                key={i}
                                className="flex-row items-center gap-1"
                              >
                                <Text className="text-neutral-400 text-xs min-w-[80px]">
                                  {vote.voterName}
                                </Text>
                                <Text className="text-neutral-600 text-xs">
                                  voted
                                </Text>
                                <Text className="text-red-400 text-xs font-semibold">
                                  {vote.targetName}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Elimination result */}
                      {round.eliminatedPlayer ? (
                        <View className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-red-950/40 border border-red-800/30">
                          <Text className="text-sm">💀</Text>
                          <Text className="text-red-400 text-xs font-semibold">
                            {t('game.wasEliminatedPlayer', {
                              name: round.eliminatedPlayer,
                            })}
                          </Text>
                          {round.eliminatedRole && (
                            <Text className="text-neutral-500 text-xs">
                              ({(ROLE_CONFIG[round.eliminatedRole] ?? ROLE_CONFIG.villager).label})
                            </Text>
                          )}
                        </View>
                      ) : (
                        <View className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-neutral-800/40 border border-neutral-700/30">
                          <Text className="text-neutral-500 text-xs">
                            {t('game.noEliminatedRound')}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
