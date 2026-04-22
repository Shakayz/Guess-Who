import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { NavBar } from '../components/NavBar'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth'
import { Avatar } from '@red-handed/ui'

interface GameDetailPlayer {
  userId: string
  username: string
  avatarUrl: string | null
  role: string
  survived: boolean
  starCoinsEarned: number
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

interface GameDetail {
  id: string
  startedAt: string
  endedAt: string
  winnerTeam: 'villagers' | 'red_handed'
  gameMode?: 'normal' | 'special' | 'ranked'
  myRole: 'villager' | 'red_handed'
  participations: GameDetailPlayer[]
  rounds: RoundDetail[]
  chatMessages: ChatMsg[]
}

const ROLE_CONFIG: Record<string, { emoji: string; key: string; fallback: string }> = {
  villager:        { emoji: '🏘️', key: 'game.roleVillager',       fallback: 'Villager' },
  red_handed:      { emoji: '🎭', key: 'game.roleRedHanded',      fallback: 'Imposter' },
  detective:       { emoji: '🔍', key: 'game.roleDetective',      fallback: 'Detective' },
  double_agent:    { emoji: '🕵️', key: 'game.roleDoubleAgent',    fallback: 'Double Agent' },
  doubleAgent:     { emoji: '🕵️', key: 'game.roleDoubleAgent',    fallback: 'Double Agent' },
  guardian:        { emoji: '🛡️', key: 'game.roleGuardian',       fallback: 'Guardian' },
  mayor:           { emoji: '🎩', key: 'game.roleMayor',          fallback: 'Mayor' },
  infiltrator:     { emoji: '🥷', key: 'game.roleInfiltrator',    fallback: 'Infiltrator' },
  jester:          { emoji: '🃏', key: 'game.roleJester',         fallback: 'Jester' },
  judge:           { emoji: '⚖️', key: 'game.roleJudge',          fallback: 'Judge' },
  revenant:        { emoji: '👻', key: 'game.roleRevenant',       fallback: 'Revenant' },
  kamikaze:        { emoji: '💣', key: 'game.roleKamikaze',       fallback: 'Kamikaze' },
  corruptor:       { emoji: '💰', key: 'game.roleCorruptor',      fallback: 'Corruptor' },
  inverter:        { emoji: '🔄', key: 'game.roleInverter',       fallback: 'Inverter' },
  twin_villager:   { emoji: '👥', key: 'game.roleTwinVillager',   fallback: 'Evil Twin (Villager)' },
  twin_red_handed: { emoji: '👥', key: 'game.roleTwinRedHanded',  fallback: 'Evil Twin (Imposter)' },
}

function getRoleCfg(role: string) {
  return ROLE_CONFIG[role] ?? { emoji: '👤', key: 'game.roleVillager', fallback: role }
}

function RoundAccordion({ round, players, t }: { round: RoundDetail; players: GameDetailPlayer[]; t: (key: string, opts?: any) => string }) {
  const [open, setOpen] = useState(true)

  const getPlayer = (userId: string) =>
    players.find((p) => p.userId === userId)
  const getUsername = (userId: string) =>
    getPlayer(userId)?.username ?? userId.slice(0, 8)
  const getAvatar = (userId: string) =>
    getPlayer(userId)?.avatarUrl ?? null

  const eliminatedPlayer = round.eliminatedId
    ? players.find((p) => p.userId === round.eliminatedId)
    : null

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-800/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-brand-400 font-bold text-sm">{t('gameDetail.round', { number: round.roundNumber })}</span>
          {round.eliminatedId && (
            <span className="text-xs text-neutral-500">
              · {eliminatedPlayer?.username ?? 'Unknown'} {t('gameDetail.eliminated')}
            </span>
          )}
          {!round.eliminatedId && (
            <span className="text-xs text-neutral-500">· {t('gameDetail.noElimination')}</span>
          )}
        </div>
        <span className="text-neutral-500 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-neutral-800">

          {/* Words */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <div className="rounded-xl bg-brand-950/40 border border-brand-800/40 p-3 text-center">
              <p className="text-xs text-neutral-500 mb-1">{t('gameDetail.villagerWord')}</p>
              <p className="text-white font-bold text-lg">{round.villagerWord}</p>
            </div>
            <div className="rounded-xl bg-amber-950/40 border border-amber-800/40 p-3 text-center">
              <p className="text-xs text-neutral-500 mb-1">{t('gameDetail.redHandedWord')}</p>
              <p className="text-amber-300 font-bold text-lg">{round.redHandedWord}</p>
            </div>
          </div>

          {/* Elimination */}
          {round.eliminatedId && (
            <div className="rounded-xl bg-red-950/20 border border-red-800/40 p-3 flex items-center gap-3">
              <span className="text-2xl">💀</span>
              <div>
                <p className="text-white font-semibold text-sm">
                  {t('gameDetail.wasEliminated', { name: eliminatedPlayer?.username ?? 'Unknown' })}
                </p>
                <p className="text-neutral-500 text-xs">
                  {(() => {
                    const rawRole = round.eliminatedRole ?? eliminatedPlayer?.role ?? 'unknown'
                    const cfg = getRoleCfg(rawRole)
                    return t('gameDetail.role', { role: `${cfg.emoji} ${t(cfg.key, cfg.fallback)}` })
                  })()}
                </p>
              </div>
            </div>
          )}

          {/* Clues */}
          {round.clues.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-2">{t('gameDetail.clues')}</p>
              <div className="space-y-2">
                {round.clues.map((clue, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Avatar src={getAvatar(clue.playerId)} username={getUsername(clue.playerId)} size="sm" />
                    <div className="flex-1 bg-neutral-800/60 rounded-xl px-3 py-2">
                      <p className="text-xs text-neutral-500 mb-0.5">{getUsername(clue.playerId)}</p>
                      <p className="text-white text-sm">{clue.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-2">{t('gameDetail.clues')}</p>
              <p className="text-xs text-neutral-600 italic">{t('gameDetail.noClues', 'No clues recorded for this round')}</p>
            </div>
          )}

          {/* Votes — with tally */}
          {round.votes.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-2">{t('gameDetail.votes')}</p>
              {/* Tally per target */}
              {(() => {
                const tally: Record<string, number> = {}
                round.votes.forEach(v => { tally[v.targetId] = (tally[v.targetId] ?? 0) + 1 })
                const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1])
                const max = sorted[0]?.[1] ?? 0
                return (
                  <div className="space-y-1.5 mb-3">
                    {sorted.map(([uid, count]) => (
                      <div key={uid} className="flex items-center gap-2">
                        <Avatar src={getAvatar(uid)} username={getUsername(uid)} size="xs" />
                        <span className="text-xs text-neutral-400 w-24 truncate">{getUsername(uid)}</span>
                        <div className="flex-1 h-4 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className={['h-full rounded-full transition-all', count === max ? 'bg-amber-500' : 'bg-neutral-600'].join(' ')}
                            style={{ width: `${(count / round.votes.length) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-neutral-300 w-4 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                )
              })()}
              {/* Individual votes */}
              <div className="space-y-0.5">
                {round.votes.map((vote, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-neutral-500">
                    <span>{getUsername(vote.voterId)}</span>
                    <span className="text-neutral-700">→</span>
                    <span className="text-neutral-400">{getUsername(vote.targetId)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function GameDetailPage() {
  const { t } = useTranslation()
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [data, setData] = useState<GameDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!gameId) return
    setLoading(true)
    api
      .get<GameDetail>(`/history/${gameId}`)
      .then((res) => {
        setData(res)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [gameId])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  const didWin =
    data &&
    ((data.winnerTeam === 'villagers' && data.myRole === 'villager') ||
      (data.winnerTeam === 'red_handed' && data.myRole === 'red_handed'))

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 p-6">
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="h-8 w-32 bg-neutral-800 rounded animate-pulse" />
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 animate-pulse">
              <div className="h-16 w-48 bg-neutral-800 rounded mx-auto" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 animate-pulse h-20" />
            ))}
          </div>
        </main>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 p-6 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-400 font-semibold">{t('history.loadError')}</p>
            <p className="text-neutral-500 text-sm mt-1">{error}</p>
            <button
              onClick={() => navigate('/history')}
              className="mt-4 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm transition-colors"
            >
              {t('gameDetail.backToHistory')}
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-6">
        <div className="max-w-2xl mx-auto space-y-4 animate-slide-up">

          {/* Back button */}
          <button
            onClick={() => navigate('/history')}
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white transition-colors"
          >
            {t('gameDetail.backToHistory')}
          </button>

          {/* Header card */}
          <div className={[
            'rounded-2xl border p-6 text-center relative overflow-hidden',
            didWin
              ? 'border-emerald-700/40 bg-emerald-950/10'
              : 'border-red-800/40 bg-red-950/10',
          ].join(' ')}>
            <div className={[
              'absolute top-0 inset-x-0 h-0.5',
              didWin
                ? 'bg-gradient-to-r from-transparent via-emerald-500 to-transparent'
                : 'bg-gradient-to-r from-transparent via-red-500 to-transparent',
            ].join(' ')} />
            <p className="text-5xl mb-2">{didWin ? '🏆' : '💀'}</p>
            <h1 className={[
              'text-2xl font-extrabold tracking-tight mb-1',
              didWin ? 'text-emerald-400' : 'text-red-400',
            ].join(' ')}>
              {didWin ? t('gameDetail.victory') : t('gameDetail.defeat')}
            </h1>
            <p className="text-neutral-400 text-sm">{formatDate(data.startedAt)}</p>
            <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
              <span className={[
                'text-xs font-bold px-2.5 py-1 rounded-full border',
                data.myRole === 'red_handed'
                  ? 'bg-amber-950 text-amber-400 border-amber-800/60'
                  : 'bg-brand-950/60 text-brand-400 border-brand-800/60',
              ].join(' ')}>
                {data.myRole === 'red_handed' ? t('gameDetail.redHandedRole') : t('gameDetail.villagerRole')}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full border border-neutral-700 text-neutral-400 bg-neutral-800/60">
                {data.rounds.length !== 1 ? t('gameDetail.roundCountPlural', { count: data.rounds.length }) : t('gameDetail.roundCount', { count: data.rounds.length })}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full border border-neutral-700 text-neutral-400 bg-neutral-800/60">
                {t('gameDetail.playerCount', { count: data.participations.length })}
              </span>
              {data.endedAt && data.startedAt && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full border border-neutral-700 text-neutral-400 bg-neutral-800/60">
                  {t('gameDetail.min', { count: Math.round((new Date(data.endedAt).getTime() - new Date(data.startedAt).getTime()) / 60000) })}
                </span>
              )}
              {data.gameMode && (
                <span className={[
                  'text-xs font-bold px-2.5 py-1 rounded-full border',
                  data.gameMode === 'special'
                    ? 'bg-fuchsia-950/60 text-fuchsia-400 border-fuchsia-800/60'
                    : data.gameMode === 'ranked'
                      ? 'bg-sky-950/60 text-sky-400 border-sky-800/60'
                      : 'bg-neutral-800/60 text-neutral-300 border-neutral-700',
                ].join(' ')}>
                  {data.gameMode === 'special'
                    ? t('gameDetail.gameTypeSpecial')
                    : data.gameMode === 'ranked'
                      ? t('gameDetail.gameTypeRanked')
                      : t('gameDetail.gameTypeNormal')}
                </span>
              )}
            </div>

            {/* Word reveal */}
            {data.rounds.length > 0 && data.rounds[0].villagerWord && (
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-xl bg-brand-950/40 border border-brand-800/40 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">{t('gameDetail.villagerWord')}</p>
                  <p className="text-lg font-extrabold text-white">{data.rounds[0].villagerWord}</p>
                </div>
                <div className="rounded-xl bg-amber-950/40 border border-amber-800/40 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">{t('gameDetail.redHandedWord')}</p>
                  <p className="text-lg font-extrabold text-amber-400">{data.rounds[0].redHandedWord}</p>
                </div>
              </div>
            )}
          </div>

          {/* Players grid */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">{t('gameDetail.players')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {data.participations.map((p) => {
                const isMe = p.userId === user?.id
                const roleCfg = getRoleCfg(p.role)
                const roleLabel = t(roleCfg.key, roleCfg.fallback)
                const inner = (
                  <>
                    <Avatar src={p.avatarUrl} username={p.username} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-white text-xs font-semibold truncate">{p.username}</span>
                        {isMe && <span className="text-[9px] text-brand-400 font-bold">{t('gameDetail.you')}</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                        <span className="text-base shrink-0">{roleCfg.emoji}</span>
                        <span className="text-[10px] text-neutral-300 font-medium truncate" title={roleLabel}>
                          {roleLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={[
                          'text-[10px]',
                          p.survived ? 'text-emerald-500' : 'text-neutral-600',
                        ].join(' ')}>
                          {p.survived ? t('gameDetail.survived') : t('gameDetail.elim')}
                        </span>
                      </div>
                    </div>
                  </>
                )

                const baseCls = 'flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors'

                if (isMe) {
                  return (
                    <div
                      key={p.userId}
                      className={[baseCls, 'border-brand-800/50 bg-brand-950/20'].join(' ')}
                    >
                      {inner}
                    </div>
                  )
                }

                return (
                  <Link
                    key={p.userId}
                    to={`/player/${p.userId}`}
                    className={[
                      baseCls,
                      'border-neutral-800 bg-neutral-900/40 hover:border-brand-700/60 hover:bg-neutral-800/60 cursor-pointer',
                    ].join(' ')}
                  >
                    {inner}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Rounds accordion */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">{t('gameDetail.rounds')}</p>
            <div className="space-y-2">
              {data.rounds.map((round) => (
                <RoundAccordion key={round.id} round={round} players={data.participations} t={t} />
              ))}
            </div>
          </div>

          {/* Game chat replay */}
          {data.chatMessages.length > 0 && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">💬 {t('gameDetail.gameChat')}</p>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {data.chatMessages.map((msg) => {
                  const isMe = msg.userId === user?.id
                  return (
                    <div
                      key={msg.id}
                      className={['flex gap-2', isMe ? 'flex-row-reverse' : 'flex-row'].join(' ')}
                    >
                      <Avatar src={data.participations.find((p) => p.userId === msg.userId)?.avatarUrl ?? null} username={msg.username} size="sm" />
                      <div className={['max-w-[75%]', isMe ? 'items-end' : 'items-start'].join(' ')}>
                        <p className={['text-xs text-neutral-500 mb-0.5', isMe ? 'text-right' : ''].join(' ')}>
                          {msg.username} · {formatTime(msg.createdAt)}
                        </p>
                        <div className={[
                          'px-3 py-2 rounded-2xl text-sm',
                          isMe
                            ? 'bg-brand-600/80 text-white rounded-tr-sm'
                            : 'bg-neutral-800 text-neutral-200 rounded-tl-sm',
                        ].join(' ')}>
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
