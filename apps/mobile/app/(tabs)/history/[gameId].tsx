import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Share,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { api } from '../../../lib/api'
import { useAuthStore } from '../../../store/auth'
import { useResponsive } from '../../../lib/responsive'
import { HapticManager } from '../../../lib/haptics'
import { isVillagerSideRole, isRedHandedSideRole, isJesterRole, isTwinRole } from '@red-handed/shared'
import type { PlayerRole } from '@red-handed/shared'

interface DetailPlayer {
  userId: string
  username: string
  avatarUrl: string | null
  role: 'villager' | 'red_handed' | 'detective' | 'doubleAgent' | 'double_agent' | string
  survived: boolean
  starCoinsEarned?: number
}

interface RoundClue {
  playerId: string
  text: string
  createdAt: string
}

interface RoundVote {
  voterId: string
  targetId: string
}

interface RoundDetail {
  id: string
  roundNumber: number
  villagerWord: string
  redHandedWord: string
  eliminatedId: string | null
  eliminatedRole: string | null
  clues: RoundClue[]
  votes: RoundVote[]
}

interface ChatMsg {
  id: string
  userId: string
  username: string
  text: string
  createdAt: string
}

type WinnerTeam = 'villagers' | 'red_handed' | 'jester' | 'evil_twins' | 'draw'

interface GameDetail {
  id: string
  startedAt: string
  endedAt: string
  winnerTeam: WinnerTeam
  myRole: string
  participations: DetailPlayer[]
  rounds: RoundDetail[]
  chatMessages: ChatMsg[]
}

const ROLE_CONFIG: Record<string, { emoji: string; key: string; fallback: string }> = {
  villager:     { emoji: '🏘️', key: 'game.roleVillager',    fallback: 'Villager' },
  red_handed:   { emoji: '🎭', key: 'game.roleRedHanded',   fallback: 'Imposter' },
  detective:    { emoji: '🔍', key: 'game.roleDetective',   fallback: 'Detective' },
  double_agent: { emoji: '🕵️', key: 'game.roleDoubleAgent', fallback: 'Double Agent' },
  doubleAgent:  { emoji: '🕵️', key: 'game.roleDoubleAgent', fallback: 'Double Agent' },
}

function getRoleCfg(role: string) {
  return ROLE_CONFIG[role] ?? ROLE_CONFIG.villager
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

type Outcome = 'win' | 'loss' | 'draw'

function getOutcome(winner: string, myRole: string): Outcome {
  if (winner === 'draw') return 'draw'
  const role = myRole as PlayerRole
  const won =
    (winner === 'villagers'  && isVillagerSideRole(role)) ||
    (winner === 'red_handed' && isRedHandedSideRole(role)) ||
    (winner === 'jester'     && isJesterRole(role)) ||
    (winner === 'evil_twins' && isTwinRole(role))
  return won ? 'win' : 'loss'
}

export default function GameDetailScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { gameId } = useLocalSearchParams<{ gameId: string }>()
  const user = useAuthStore((s) => s.user)
  const { isTablet, px } = useResponsive()
  const contentStyle = isTablet
    ? { maxWidth: 700, alignSelf: 'center' as const, width: '100%' as const }
    : {}

  const [game, setGame] = useState<GameDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set([1]))

  const fetchGame = useCallback(async () => {
    if (!gameId) return
    const data = await api.get<GameDetail>(`/history/${gameId}`)
    setGame(data)
  }, [gameId])

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchGame()
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false))
  }, [fetchGame])

  const handleRefresh = useCallback(async () => {
    HapticManager.light()
    setRefreshing(true)
    setError(null)
    try {
      await fetchGame()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }, [fetchGame])

  const playersById = useMemo(() => {
    const map = new Map<string, DetailPlayer>()
    game?.participations.forEach((p) => map.set(p.userId, p))
    return map
  }, [game])

  const me = useMemo(
    () => game?.participations.find((p) => p.userId === user?.id),
    [game, user?.id],
  )
  const outcome = useMemo<Outcome>(() => {
    if (!game) return 'loss'
    if (!me) return game.winnerTeam === 'draw' ? 'draw' : 'loss'
    return getOutcome(game.winnerTeam, me.role)
  }, [game, me])
  const won = outcome === 'win'
  const isDraw = outcome === 'draw'

  const toggleRound = useCallback((roundNumber: number) => {
    HapticManager.selection()
    setExpandedRounds((prev) => {
      const next = new Set(prev)
      if (next.has(roundNumber)) next.delete(roundNumber)
      else next.add(roundNumber)
      return next
    })
  }, [])

  const goToProfile = useCallback(
    (userId: string) => {
      if (userId === user?.id) return
      HapticManager.selection()
      router.push(`/profile/${userId}` as any)
    },
    [router, user?.id],
  )

  const handleShare = useCallback(async () => {
    if (!game || !me) return
    HapticManager.medium()
    const roleCfg = getRoleCfg(me.role)
    const roleName = String(t(roleCfg.key, { defaultValue: roleCfg.fallback }))
    const rounds = game.rounds.length
    const message = String(
      won
        ? t('gameDetail.shareWin', {
            role: roleName,
            rounds,
            defaultValue: `I won as ${roleName} in ${rounds} rounds — playing Red-Handed!`,
          })
        : t('gameDetail.shareLoss', {
            role: roleName,
            rounds,
            defaultValue: `I played as ${roleName} for ${rounds} rounds in Red-Handed. Tough one!`,
          }),
    )
    const title = String(
      t('gameDetail.shareTitle', { defaultValue: 'My Red-Handed game' }),
    )
    try {
      await Share.share(Platform.OS === 'ios' ? { message } : { title, message })
    } catch {
      // user cancelled or share unavailable — silent
    }
  }, [game, me, won, t])

  if (loading && !game) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-950" edges={['bottom']}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={contentStyle}>
            <View className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 mb-4">
              <View className="h-8 w-32 bg-neutral-800 rounded mx-auto mb-3" />
              <View className="h-6 w-48 bg-neutral-800 rounded mx-auto" />
            </View>
            {Array.from({ length: 3 }).map((_, i) => (
              <View
                key={i}
                className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 mb-3 h-20"
              />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  if ((error || !game) && !loading) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-950 items-center justify-center px-6">
        <Text className="text-red-400 text-sm text-center mb-4">
          {error ?? t('common.error')}
        </Text>
        <TouchableOpacity
          onPress={handleRefresh}
          className="px-5 py-2.5 rounded-xl bg-violet-600"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold text-sm">{t('common.retry')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  if (!game) return null

  const firstRoundWords = game.rounds[0]
  const startMs = new Date(game.startedAt).getTime()
  const endMs = game.endedAt ? new Date(game.endedAt).getTime() : NaN
  const durationMin =
    Number.isFinite(startMs) && Number.isFinite(endMs)
      ? Math.max(1, Math.round((endMs - startMs) / 60000))
      : null

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#8b5cf6"
            colors={['#8b5cf6']}
          />
        }
      >
        <View style={contentStyle}>
          {/* Outcome Banner with share button */}
          <View
            className={`mt-4 p-5 rounded-2xl border items-center ${
              isDraw
                ? 'bg-amber-950/50 border-amber-800'
                : won
                  ? 'bg-emerald-950/50 border-emerald-800'
                  : 'bg-red-950/50 border-red-800'
            }`}
            style={{ marginHorizontal: px }}
          >
            <Text className="text-3xl mb-2">{isDraw ? '🤝' : won ? '🏆' : '💀'}</Text>
            <Text
              className={`text-xl font-bold ${
                isDraw ? 'text-amber-400' : won ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {isDraw
                ? t('history.draw', 'Draw')
                : won
                  ? t('gameDetail.victory', 'Victory')
                  : t('gameDetail.defeat', 'Defeat')}
            </Text>
            <Text className="text-neutral-500 text-xs mt-1">
              {game.winnerTeam === 'draw'
                ? t('results.drawDesc', 'The game ended with no winner')
                : game.winnerTeam === 'villagers'
                  ? t('results.villagersWon', 'Villagers found the imposters')
                  : game.winnerTeam === 'red_handed'
                    ? t('results.redHandedWon', 'Imposters escaped detection')
                    : game.winnerTeam === 'jester'
                      ? t('results.jesterWon', 'The Jester won')
                      : t('results.evilTwinsWon', 'The Evil Twins won')}
            </Text>
            <Text className="text-neutral-600 text-xs mt-2">
              {(() => {
                const d = new Date(game.startedAt)
                return Number.isNaN(d.getTime()) ? '' : dateFormatter.format(d)
              })()}
            </Text>

            {/* Quick stats chips */}
            <View className="flex-row flex-wrap items-center justify-center gap-1.5 mt-3">
              <View className="px-2.5 py-1 rounded-full border border-neutral-700 bg-neutral-800/60">
                <Text className="text-neutral-300 text-[11px] font-semibold">
                  {game.rounds.length === 1
                    ? t('gameDetail.roundCount', { count: 1, defaultValue: '1 round' })
                    : t('gameDetail.roundCountPlural', {
                        count: game.rounds.length,
                        defaultValue: `${game.rounds.length} rounds`,
                      })}
                </Text>
              </View>
              <View className="px-2.5 py-1 rounded-full border border-neutral-700 bg-neutral-800/60">
                <Text className="text-neutral-300 text-[11px] font-semibold">
                  {t('gameDetail.playerCount', {
                    count: game.participations.length,
                    defaultValue: `${game.participations.length} players`,
                  })}
                </Text>
              </View>
              {durationMin !== null && (
                <View className="px-2.5 py-1 rounded-full border border-neutral-700 bg-neutral-800/60">
                  <Text className="text-neutral-300 text-[11px] font-semibold">
                    {t('gameDetail.min', {
                      count: durationMin,
                      defaultValue: `${durationMin} min`,
                    })}
                  </Text>
                </View>
              )}
            </View>

            {/* Share */}
            <TouchableOpacity
              onPress={handleShare}
              className="mt-4 px-5 py-2.5 rounded-xl bg-violet-600 active:bg-violet-700 flex-row items-center gap-2"
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('gameDetail.share', 'Share')}
            >
              <Text className="text-base">📤</Text>
              <Text className="text-white font-semibold text-sm">
                {t('gameDetail.share', 'Share')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Word Reveal */}
          {firstRoundWords && firstRoundWords.villagerWord && (
            <View
              className="mt-3 flex-row gap-3"
              style={{ marginHorizontal: px }}
            >
              <View className="flex-1 rounded-2xl bg-violet-950/40 border border-violet-800/40 p-3">
                <Text className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">
                  {t('gameDetail.villagerWord', 'Villager Word')}
                </Text>
                <Text className="text-white font-extrabold text-base" numberOfLines={2}>
                  {firstRoundWords.villagerWord}
                </Text>
              </View>
              <View className="flex-1 rounded-2xl bg-amber-950/40 border border-amber-800/40 p-3">
                <Text className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">
                  {t('gameDetail.redHandedWord', 'Imposter Word')}
                </Text>
                <Text className="text-amber-300 font-extrabold text-base" numberOfLines={2}>
                  {firstRoundWords.redHandedWord}
                </Text>
              </View>
            </View>
          )}

          {/* Players Section */}
          <View className="mt-5" style={{ marginHorizontal: px }}>
            <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3 px-1">
              {t('gameDetail.players', 'Players')}
            </Text>
            <View className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden">
              {game.participations.map((player, index) => {
                const role = getRoleCfg(player.role)
                const isMe = player.userId === user?.id
                const survived = player.survived
                const isLast = index === game.participations.length - 1

                return (
                  <TouchableOpacity
                    key={player.userId}
                    onPress={() => goToProfile(player.userId)}
                    disabled={isMe}
                    activeOpacity={isMe ? 1 : 0.7}
                    className={`flex-row items-center px-4 py-3 ${
                      !isLast ? 'border-b border-neutral-800' : ''
                    } ${isMe ? '' : 'active:bg-neutral-800/40'}`}
                  >
                    <View className="w-9 h-9 rounded-full bg-neutral-800 items-center justify-center mr-3">
                      <Text className="text-base">{role.emoji}</Text>
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-white text-sm font-semibold">
                          {player.username}
                        </Text>
                        {isMe && (
                          <View className="px-1.5 py-0.5 rounded bg-violet-900/60 border border-violet-700/40">
                            <Text className="text-violet-400 text-[10px] font-bold">
                              {t('gameDetail.you', 'YOU')}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-neutral-500 text-xs">
                        {t(role.key, role.fallback)}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
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
                            ? t('gameDetail.survived', 'Survived')
                            : t('gameDetail.elim', 'Elim.')}
                        </Text>
                      </View>
                      {!isMe && <Text className="text-neutral-600 text-xs">›</Text>}
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          {/* Rounds Section */}
          <View className="mt-5" style={{ marginHorizontal: px }}>
            <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3 px-1">
              {t('gameDetail.rounds', 'Rounds')}
            </Text>
            <View className="gap-3">
              {game.rounds.map((round) => {
                const expanded = expandedRounds.has(round.roundNumber)
                const eliminatedPlayer = round.eliminatedId
                  ? playersById.get(round.eliminatedId)
                  : null
                const eliminatedRoleCfg = round.eliminatedRole
                  ? getRoleCfg(round.eliminatedRole)
                  : eliminatedPlayer
                    ? getRoleCfg(eliminatedPlayer.role)
                    : null

                // Tally votes
                const tally: Record<string, number> = {}
                round.votes.forEach((v) => {
                  tally[v.targetId] = (tally[v.targetId] ?? 0) + 1
                })
                const tallySorted = Object.entries(tally).sort((a, b) => b[1] - a[1])
                const maxCount = tallySorted[0]?.[1] ?? 0

                return (
                  <View
                    key={round.id}
                    className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden"
                  >
                    <TouchableOpacity
                      onPress={() => toggleRound(round.roundNumber)}
                      className="flex-row items-center justify-between px-4 py-3"
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-center gap-2 flex-1">
                        <Text className="text-white font-semibold text-sm">
                          {t('gameDetail.round', {
                            number: round.roundNumber,
                            defaultValue: `Round ${round.roundNumber}`,
                          })}
                        </Text>
                        {eliminatedPlayer ? (
                          <View className="px-2 py-0.5 rounded-md bg-red-950 border border-red-800/50">
                            <Text className="text-red-400 text-[10px] font-bold" numberOfLines={1}>
                              {eliminatedPlayer.username}
                            </Text>
                          </View>
                        ) : (
                          <Text className="text-neutral-500 text-[11px]">
                            · {t('gameDetail.noElimination', 'No elimination')}
                          </Text>
                        )}
                      </View>
                      <Text className="text-neutral-600 text-sm">
                        {expanded ? '▲' : '▼'}
                      </Text>
                    </TouchableOpacity>

                    {expanded && (
                      <View className="px-4 pb-4 gap-4 border-t border-neutral-800 pt-3">
                        {/* Words for this round */}
                        {round.villagerWord && round.redHandedWord && (
                          <View className="flex-row gap-2">
                            <View className="flex-1 rounded-xl bg-violet-950/40 border border-violet-800/40 p-2.5">
                              <Text className="text-[9px] font-bold uppercase tracking-wider text-neutral-500 mb-0.5">
                                {t('gameDetail.villagerWord', 'Villager Word')}
                              </Text>
                              <Text className="text-white font-bold text-sm" numberOfLines={1}>
                                {round.villagerWord}
                              </Text>
                            </View>
                            <View className="flex-1 rounded-xl bg-amber-950/40 border border-amber-800/40 p-2.5">
                              <Text className="text-[9px] font-bold uppercase tracking-wider text-neutral-500 mb-0.5">
                                {t('gameDetail.redHandedWord', 'Imposter Word')}
                              </Text>
                              <Text className="text-amber-300 font-bold text-sm" numberOfLines={1}>
                                {round.redHandedWord}
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Clues */}
                        <View>
                          <Text className="text-xs font-semibold text-neutral-500 mb-2">
                            {t('gameDetail.clues', 'Clues')}
                          </Text>
                          {round.clues.length === 0 ? (
                            <Text className="text-neutral-600 text-xs italic">
                              {t('gameDetail.noClues', 'No clues recorded')}
                            </Text>
                          ) : (
                            <View className="gap-1.5">
                              {round.clues.map((clue, i) => {
                                const player = playersById.get(clue.playerId)
                                const name = player?.username ?? clue.playerId.slice(0, 8)
                                return (
                                  <TouchableOpacity
                                    key={i}
                                    onPress={() => goToProfile(clue.playerId)}
                                    disabled={!player || player.userId === user?.id}
                                    activeOpacity={0.7}
                                    className="flex-row items-start gap-2"
                                  >
                                    <Text className="text-violet-400 text-xs font-semibold min-w-[80px]">
                                      {name}
                                    </Text>
                                    <Text className="text-neutral-300 text-xs flex-1">
                                      {clue.text}
                                    </Text>
                                  </TouchableOpacity>
                                )
                              })}
                            </View>
                          )}
                        </View>

                        {/* Votes with tally bars */}
                        <View>
                          <Text className="text-xs font-semibold text-neutral-500 mb-2">
                            {t('gameDetail.votes', 'Votes')}
                          </Text>
                          {round.votes.length === 0 ? (
                            <Text className="text-neutral-600 text-xs italic">
                              {t('gameDetail.noVotesCast', 'No votes cast')}
                            </Text>
                          ) : (
                            <>
                              <View className="gap-1.5 mb-2">
                                {tallySorted.map(([uid, count]) => {
                                  const player = playersById.get(uid)
                                  const name = player?.username ?? uid.slice(0, 8)
                                  const pct = (count / round.votes.length) * 100
                                  return (
                                    <View key={uid} className="flex-row items-center gap-2">
                                      <Text
                                        className="text-xs text-neutral-400 font-semibold"
                                        style={{ width: 80 }}
                                        numberOfLines={1}
                                      >
                                        {name}
                                      </Text>
                                      <View className="flex-1 h-3 bg-neutral-800 rounded-full overflow-hidden">
                                        <View
                                          className={`h-full ${
                                            count === maxCount ? 'bg-amber-500' : 'bg-neutral-600'
                                          }`}
                                          style={{ width: `${pct}%` }}
                                        />
                                      </View>
                                      <Text className="text-xs font-bold text-neutral-300 w-5 text-right">
                                        {count}
                                      </Text>
                                    </View>
                                  )
                                })}
                              </View>
                              <View className="gap-0.5">
                                {round.votes.map((vote, i) => {
                                  const voter = playersById.get(vote.voterId)
                                  const target = playersById.get(vote.targetId)
                                  return (
                                    <View
                                      key={i}
                                      className="flex-row items-center gap-1.5"
                                    >
                                      <Text className="text-neutral-500 text-[11px]" numberOfLines={1}>
                                        {voter?.username ?? vote.voterId.slice(0, 8)}
                                      </Text>
                                      <Text className="text-neutral-700 text-[11px]">→</Text>
                                      <Text className="text-neutral-300 text-[11px] font-semibold" numberOfLines={1}>
                                        {target?.username ?? vote.targetId.slice(0, 8)}
                                      </Text>
                                    </View>
                                  )
                                })}
                              </View>
                            </>
                          )}
                        </View>

                        {/* Elimination result */}
                        {eliminatedPlayer ? (
                          <View className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-red-950/40 border border-red-800/30">
                            <Text className="text-sm">💀</Text>
                            <Text className="text-red-400 text-xs font-semibold flex-1" numberOfLines={1}>
                              {t('gameDetail.wasEliminated', {
                                name: eliminatedPlayer.username,
                                defaultValue: `${eliminatedPlayer.username} was eliminated`,
                              })}
                            </Text>
                            {eliminatedRoleCfg && (
                              <Text className="text-neutral-500 text-xs">
                                {eliminatedRoleCfg.emoji}{' '}
                                {t(eliminatedRoleCfg.key, eliminatedRoleCfg.fallback)}
                              </Text>
                            )}
                          </View>
                        ) : (
                          <View className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-neutral-800/40 border border-neutral-700/30">
                            <Text className="text-neutral-500 text-xs">
                              {t('gameDetail.noElimination', 'No elimination')}
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

          {/* Game Chat Replay */}
          {game.chatMessages && game.chatMessages.length > 0 && (
            <View className="mt-5" style={{ marginHorizontal: px }}>
              <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3 px-1">
                💬 {t('gameDetail.gameChat', 'Game Chat')}
              </Text>
              <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-3 gap-2">
                {game.chatMessages.map((msg) => {
                  const isMe = msg.userId === user?.id
                  const time = (() => {
                    const d = new Date(msg.createdAt)
                    return Number.isNaN(d.getTime()) ? '' : timeFormatter.format(d)
                  })()
                  return (
                    <TouchableOpacity
                      key={msg.id}
                      onPress={() => goToProfile(msg.userId)}
                      disabled={isMe}
                      activeOpacity={isMe ? 1 : 0.7}
                      className={`flex-row ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <View
                        className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                          isMe
                            ? 'bg-violet-600/80 rounded-tr-sm'
                            : 'bg-neutral-800 rounded-tl-sm'
                        }`}
                      >
                        <Text
                          className={`text-[10px] mb-0.5 ${
                            isMe ? 'text-violet-200' : 'text-neutral-500'
                          }`}
                        >
                          {msg.username} · {time}
                        </Text>
                        <Text
                          className={`text-sm ${isMe ? 'text-white' : 'text-neutral-200'}`}
                        >
                          {msg.text}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
