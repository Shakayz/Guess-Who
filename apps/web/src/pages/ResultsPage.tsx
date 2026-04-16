import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { useNavigate, Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/game'
import { useAuthStore } from '../store/auth'
import { NavBar } from '../components/NavBar'
import { Avatar, Badge } from '@red-handed/ui'
import { RANK_CONFIG } from '@red-handed/shared'
import type { RankTier, Round } from '@red-handed/shared'
import { getSocket } from '../lib/socket'
import { SoundManager } from '../lib/sounds'
import { PlayerActionMenu } from '../components/PlayerActionMenu'
import { CoinsRevealCard } from '../components/CoinsRevealCard'

/** Full-screen cinematic intro overlay that auto-dismisses */
const OutcomeCinematic = memo(({ didWin, onDone }: { didWin: boolean; onDone: () => void }) => {
  const { t } = useTranslation()
  const [stage, setStage] = useState<'in' | 'hold' | 'out'>('in')

  useEffect(() => {
    const t1 = setTimeout(() => setStage('hold'), 400)
    const t2 = setTimeout(() => setStage('out'), 3400)
    const t3 = setTimeout(onDone, 3900)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  // ── Rich particle systems: burst + confetti rain ───────────────────
  const BURST = useMemo(() => Array.from({ length: 28 }, (_, i) => {
    const angle = (i / 28) * 360
    const dist  = 160 + Math.random() * 120
    return {
      dx: Math.round(Math.cos((angle * Math.PI) / 180) * dist),
      dy: Math.round(Math.sin((angle * Math.PI) / 180) * dist),
      size: 5 + Math.round(Math.random() * 10),
      delay: Math.random() * 0.08,
      duration: 0.9 + Math.random() * 0.5,
      hue: i % 5,
    }
  }), [])

  const CONFETTI = useMemo(() => Array.from({ length: 80 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.6,
    duration: 2.4 + Math.random() * 1.6,
    size: 6 + Math.random() * 8,
    rot: Math.random() * 360,
    sway: -30 + Math.random() * 60,
    hue: i % 6,
  })), [])

  const victoryHues = ['#fbbf24','#f59e0b','#fde68a','#ffffff','#34d399','#60a5fa']
  const defeatHues  = ['#f87171','#ef4444','#fca5a5','#fda4af','#a3a3a3','#ffffff']
  const palette = didWin ? victoryHues : defeatHues

  return (
    <>
      <style>{`
        @keyframes cin-particle {
          0%   { transform: translate(0,0) scale(1) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0) rotate(540deg); opacity: 0; }
        }
        @keyframes cin-shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-12px); }
          40%      { transform: translateX(12px); }
          60%      { transform: translateX(-6px); }
          80%      { transform: translateX(6px); }
        }
        @keyframes cin-drop {
          0%   { transform: translateY(-120px) scale(0.4) rotate(-20deg); opacity: 0; }
          55%  { transform: translateY(14px) scale(1.15) rotate(6deg); opacity: 1; }
          75%  { transform: translateY(-6px) scale(0.95) rotate(-2deg); }
          100% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes cin-rise {
          0%   { transform: translateY(40px) scale(0.95); opacity: 0; letter-spacing: 0.05em; }
          60%  { transform: translateY(-6px) scale(1.04); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; letter-spacing: 0.2em; }
        }
        @keyframes cin-flash {
          0%,100% { opacity: 0; }
          15%      { opacity: 0.55; }
          40%      { opacity: 0; }
        }
        @keyframes cin-rays {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes cin-shock {
          0%   { transform: translate(-50%,-50%) scale(0.2);  opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(3.5);  opacity: 0; }
        }
        @keyframes cin-confetti {
          0%   { transform: translate3d(0, -120vh, 0) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translate3d(var(--sway), 120vh, 0) rotate(720deg); opacity: 0; }
        }
        @keyframes cin-icon-pulse {
          0%,100% { transform: scale(1);    filter: drop-shadow(0 0 20px rgba(255,215,0,0.6)); }
          50%     { transform: scale(1.06); filter: drop-shadow(0 0 32px rgba(255,215,0,0.9)); }
        }
      `}</style>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
        onClick={onDone}
        style={{
          background: didWin
            ? 'radial-gradient(ellipse at center, rgba(16,80,40,0.97) 0%, rgba(5,10,5,0.99) 80%)'
            : 'radial-gradient(ellipse at center, rgba(80,10,10,0.97) 0%, rgba(5,5,10,0.99) 80%)',
          opacity: stage === 'out' ? 0 : 1,
          transition: stage === 'out' ? 'opacity 0.5s ease' : 'opacity 0.3s ease',
        }}
      >
        {/* Screen flash */}
        <div
          className={['absolute inset-0 pointer-events-none', didWin ? 'bg-amber-300' : 'bg-red-600'].join(' ')}
          style={{ animation: 'cin-flash 0.7s ease forwards', animationDelay: '0.05s', opacity: 0 }}
        />

        {/* Rotating god-rays (victory only) */}
        {didWin && (
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              width: '220vmin',
              height: '220vmin',
              background:
                'conic-gradient(from 0deg, transparent 0deg, rgba(251,191,36,0.18) 14deg, transparent 28deg, ' +
                'transparent 60deg, rgba(52,211,153,0.14) 74deg, transparent 88deg, ' +
                'transparent 120deg, rgba(251,191,36,0.16) 134deg, transparent 148deg, ' +
                'transparent 180deg, rgba(52,211,153,0.12) 194deg, transparent 208deg, ' +
                'transparent 240deg, rgba(251,191,36,0.16) 254deg, transparent 268deg, ' +
                'transparent 300deg, rgba(52,211,153,0.12) 314deg, transparent 328deg)',
              animation: 'cin-rays 12s linear infinite',
              filter: 'blur(2px)',
              opacity: stage === 'out' ? 0 : 1,
              transition: 'opacity 0.5s ease',
            }}
          />
        )}

        {/* Expanding shock ring */}
        <div
          className="absolute left-1/2 top-1/2 rounded-full border-[6px] pointer-events-none"
          style={{
            width: 260,
            height: 260,
            borderColor: didWin ? '#fbbf24' : '#ef4444',
            boxShadow: `0 0 80px ${didWin ? 'rgba(251,191,36,0.65)' : 'rgba(239,68,68,0.65)'}`,
            animation: 'cin-shock 1.0s cubic-bezier(0.16,1,0.3,1) forwards',
          }}
        />

        {/* Falling confetti (victory only) */}
        {didWin && stage !== 'in' && CONFETTI.map((c) => (
          <div
            key={c.id}
            className="absolute pointer-events-none rounded-sm"
            style={{
              left: `${c.left}%`,
              top: 0,
              width: c.size,
              height: c.size * 1.5,
              background: palette[c.hue],
              boxShadow: `0 0 6px ${palette[c.hue]}`,
              transform: `rotate(${c.rot}deg)`,
              ['--sway' as any]: `${c.sway}px`,
              animation: `cin-confetti ${c.duration}s linear ${c.delay}s forwards`,
            }}
          />
        ))}

        {/* Radial burst particles */}
        {stage !== 'in' && BURST.map((p, i) => {
          const color = palette[p.hue]
          return (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 rounded-full pointer-events-none"
              style={{
                width: p.size, height: p.size,
                background: color,
                boxShadow: `0 0 ${p.size * 2}px ${color}`,
                '--dx': `${p.dx}px`,
                '--dy': `${p.dy}px`,
                animation: `cin-particle ${p.duration}s cubic-bezier(0.22,1,0.36,1) forwards`,
                animationDelay: `${p.delay}s`,
              } as React.CSSProperties}
            />
          )
        })}

        <div
          className="text-center pointer-events-none select-none relative z-10 px-4"
          style={{ animation: !didWin && stage !== 'in' ? 'cin-shake 0.5s ease 0.2s both' : undefined }}
        >
          <div
            style={{
              animation: stage !== 'in'
                ? 'cin-drop 0.75s cubic-bezier(0.34,1.56,0.64,1) both, cin-icon-pulse 2.4s ease-in-out 0.8s infinite'
                : undefined,
              fontSize: 112,
              filter: didWin
                ? 'drop-shadow(0 8px 24px rgba(251,191,36,0.7))'
                : 'drop-shadow(0 8px 24px rgba(239,68,68,0.6))',
            }}
          >
            {didWin ? '🏆' : '💀'}
          </div>
          <h1
            className="font-black mt-3"
            style={{
              fontSize: 64,
              color: didWin ? '#fbbf24' : '#f87171',
              textShadow: didWin
                ? '0 0 40px rgba(251,191,36,0.85), 0 0 80px rgba(251,191,36,0.4)'
                : '0 0 40px rgba(248,113,113,0.7), 0 0 80px rgba(248,113,113,0.3)',
              animation: stage !== 'in' ? 'cin-rise 0.6s cubic-bezier(0.16,1,0.3,1) 0.2s both' : undefined,
              opacity: stage === 'in' ? 0 : 1,
            }}
          >
            {didWin ? t('results.victory', 'VICTORY') : t('results.defeat', 'DEFEAT')}
          </h1>
          <p
            className="text-neutral-300 text-sm mt-4 uppercase tracking-[0.3em] font-semibold"
            style={{
              animation: stage !== 'in' ? 'cin-rise 0.5s ease 0.45s both' : undefined,
              opacity: stage === 'in' ? 0 : 0.8,
            }}
          >
            {didWin
              ? t('results.victorySubtitle', 'Sharp minds. Bright team.')
              : t('results.defeatSubtitle', 'Try again. The village awaits.')}
          </p>
          <p
            className="text-neutral-500 text-xs mt-6"
            style={{
              animation: stage === 'hold' ? 'cin-rise 0.5s ease 0.2s both' : undefined,
              opacity: stage === 'hold' || stage === 'out' ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
          >
            {t('results.tapToContinue', 'Tap to continue')}
          </p>
        </div>
      </div>
    </>
  )
})

/** Collapsible round recap row */
const RoundRecap = memo(({ round, players }: { round: Round; players: { userId: string; username: string }[] }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const getName = (id: string) => players.find(p => p.userId === id)?.username ?? id.slice(0, 8)
  const eliminated = round.eliminatedPlayerId
    ? players.find(p => p.userId === round.eliminatedPlayerId)
    : null

  return (
    <div className="rounded-xl border border-neutral-800/70 overflow-hidden bg-neutral-900/30 hover:border-neutral-700/70 transition-colors">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex flex-col gap-2 px-4 py-3 text-left hover:bg-neutral-800/40 transition-colors"
      >
        <div className="flex items-center gap-3 w-full">
          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-900/80 to-brand-950/80 border border-brand-700/60 flex items-center justify-center text-xs font-bold text-brand-400 flex-shrink-0 shadow-sm shadow-brand-950/40">
            {round.roundNumber}
          </span>
          <div className="flex-1 min-w-0">
            {eliminated ? (
              <span className="text-sm text-neutral-300">
                💀 <span className="font-semibold text-white">{eliminated.username}</span>
                {' '}
                <span className="text-neutral-500 text-xs">
                  ({round.eliminatedRole === 'red_handed' ? `🎭 ${t('game.roleRedHanded', 'Red-Handed')}` : round.eliminatedRole === 'double_agent' ? `🕵️ ${t('game.roleDoubleAgent', 'Double Agent')}` : round.eliminatedRole === 'detective' ? `🔍 ${t('game.roleDetective', 'Detective')}` : `👤 ${t('game.roleVillager', 'Villager')}`})
                </span>
              </span>
            ) : (
              <span className="text-sm text-neutral-500">🤝 {t('game.tie', "No elimination — tie")}</span>
            )}
          </div>
          <span className="text-neutral-600 text-xs">{round.clues.length} {t('game.phaseClues', 'clues')} {open ? '▲' : '▼'}</span>
        </div>
        {round.wordReveal && (
          <div className="flex items-center gap-3 ml-9 text-xs">
            <span className="text-brand-400 font-semibold">{round.wordReveal.villagerWord}</span>
            <span className="text-neutral-700">vs</span>
            <span className="text-amber-400 font-semibold">{round.wordReveal.redHandedWord}</span>
          </div>
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-neutral-800/60">
          {/* Words */}
          {round.wordReveal && (
            <div className="grid grid-cols-2 gap-2 pt-3">
              <div className="rounded-lg bg-brand-950/40 border border-brand-800/40 p-2 text-center">
                <p className="text-[10px] text-neutral-500 mb-0.5">Villager Word</p>
                <p className="text-white font-bold">{round.wordReveal.villagerWord}</p>
              </div>
              <div className="rounded-lg bg-amber-950/40 border border-amber-800/40 p-2 text-center">
                <p className="text-[10px] text-neutral-500 mb-0.5">RedHanded Word</p>
                <p className="text-amber-300 font-bold">{round.wordReveal.redHandedWord}</p>
              </div>
            </div>
          )}
          {/* Clues */}
          {round.clues.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">{t('game.phaseClues', 'Clues')}</p>
              {round.clues.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs text-neutral-500 mt-0.5 w-4 text-center">{i + 1}.</span>
                  <div className="flex-1 bg-neutral-800/60 rounded-lg px-2.5 py-1.5">
                    <p className="text-[10px] text-neutral-500">{getName(c.playerId)}</p>
                    <p className="text-sm text-white">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Votes */}
          {round.votes.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 mb-1.5">{t('common.votes', 'Votes')}</p>
              <div className="space-y-1">
                {round.votes.map((v, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    <span className="text-neutral-400">{getName(v.voterId)}</span>
                    <span className="text-neutral-700">→</span>
                    <span className="text-white font-medium">{getName(v.targetId)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

type HonorType = 'teamplayer' | 'sharp_mind' | 'good_sport'

interface GameChatMessage {
  id: string
  userId: string
  username: string
  text: string
  createdAt: string
}

const HONOR_ICON: Record<HonorType, string> = {
  teamplayer: '🤝',
  sharp_mind: '🧠',
  good_sport: '🎖️',
}

// Animated number counter hook
function useAnimatedNumber(target: number, duration = 1200): number {
  const [value, setValue] = useState(0)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    startRef.current = null
    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }
    // Delay start for staggered effect
    const timeout = setTimeout(() => {
      rafRef.current = requestAnimationFrame(animate)
    }, 300)
    return () => {
      clearTimeout(timeout)
      cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration])

  return value
}

export default function ResultsPage() {
  const navigate = useNavigate()
  const { code } = useParams<{ code: string }>()
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const { result, room, myRole, completedRounds, reset } = useGameStore()

  const [showCinematic, setShowCinematic] = useState(true)
  const [honorGiven, setHonorGiven] = useState<Record<string, HonorType>>({})
  const [honorTarget, setHonorTarget] = useState<string | null>(null)
  const [rankUp, setRankUp] = useState<{ oldTier: RankTier; newTier: RankTier; newLP: number } | null>(null)
  const [showRankCelebration, setShowRankCelebration] = useState(false)

  // Game chat state
  const [chatMessages, setChatMessages] = useState<GameChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const winner = result?.winner ?? 'draw'
  const rewards = result?.rewards
  const players = room?.players?.length ? room.players : []
  const isRedHandedSide = myRole === 'red_handed' || myRole === 'double_agent' || myRole === 'infiltrator' ||
    myRole === 'kamikaze' || myRole === 'corruptor' || myRole === 'inverter' || myRole === 'twin_red_handed'
  const isVillagerSide = myRole === 'villager' || myRole === 'detective' || myRole === 'guardian' ||
    myRole === 'mayor' || myRole === 'judge' || myRole === 'revenant' || myRole === 'twin_villager'
  const isJester = myRole === 'jester'
  const isTwin = myRole === 'twin_villager' || myRole === 'twin_red_handed'
  const isDraw = winner === 'draw'
  // Evil twins override: the surviving twin whose partner died LOSES individually
  // even if their natural team won. We detect this by checking the final round's
  // player list for both twins' statuses.
  const twinPartnerDead = (() => {
    if (!isTwin || !players.length) return false
    const me = players.find((p: any) => p.userId === user?.id)
    if (!me || !(me as any).twinPartnerUserId) return false
    const partner = players.find((p: any) => p.userId === (me as any).twinPartnerUserId)
    return !!partner && partner.status !== 'alive'
  })()
  const didWin = !isDraw && (
    (winner === 'villagers' && isVillagerSide && !twinPartnerDead) ||
    (winner === 'red_handed' && isRedHandedSide && !twinPartnerDead) ||
    (winner === 'jester'     && isJester) ||
    (winner === 'evil_twins' && isTwin)
  )
  const gameMode = (room?.settings as any)?.gameMode ?? 'normal'
  const isRanked = gameMode === 'ranked'
  const isLobby = room?.settings?.isPrivate ?? false

  // Animated counters — must be called before any conditional return (hooks rule)
  const animatedXP = useAnimatedNumber(Math.abs(rewards?.xpEarned ?? 0))
  const animatedLP = useAnimatedNumber(Math.abs(rewards?.lpChange ?? 0))

  // Play outcome sound on mount
  useEffect(() => {
    SoundManager.play(didWin ? 'success' : 'error')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const sock = getSocket() as any

    const handleChatHistory = (data: { messages: GameChatMessage[] }) => setChatMessages(data.messages)
    const handleChatMessage = (msg: GameChatMessage) => setChatMessages((prev) => {
      const next = [...prev, msg]
      return next.length > 200 ? next.slice(-200) : next
    })
    const handleRankUpdated = (data: { oldTier: RankTier; newTier: RankTier; newLP: number; promoted: boolean }) => {
      if (data.promoted) {
        setRankUp({ oldTier: data.oldTier, newTier: data.newTier, newLP: data.newLP })
        setShowRankCelebration(true)
        setTimeout(() => setShowRankCelebration(false), 5000)
      }
    }

    // If the host starts a new game while this player is still on the results screen,
    // auto-navigate them to the game so they don't miss it.
    const handleNewGame = ({ yourWord, yourRole, yourVillagerWord }: any) => {
      const roomCode = code ?? room?.code
      if (!roomCode) return
      useGameStore.getState().setRoleAndWord(yourRole, yourWord, yourVillagerWord)
      navigate(`/game/${roomCode}`)
    }

    sock.on('gamechat:history', handleChatHistory)
    sock.on('gamechat:message', handleChatMessage)
    sock.on('rank:updated', handleRankUpdated)
    sock.on('game:started', handleNewGame)
    sock.emit('gamechat:history')

    return () => {
      sock.off('gamechat:history', handleChatHistory)
      sock.off('gamechat:message', handleChatMessage)
      sock.off('rank:updated', handleRankUpdated)
      sock.off('game:started', handleNewGame)
    }
  }, [code])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleChatSend = () => {
    const text = chatInput.trim()
    if (!text) return
    ;(getSocket() as any).emit('gamechat:send', { text })
    setChatInput('')
  }

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleChatSend()
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  const handleHonor = (targetUserId: string, honorType: HonorType) => {
    setHonorGiven((prev) => ({ ...prev, [targetUserId]: honorType }))
    setHonorTarget(null)
    getSocket().emit('honor:give' as any, { targetUserId, honorType })
  }

  const handlePlayAgain = () => {
    const roomCode = code ?? room?.code   // route param is most reliable
    reset()
    navigate(roomCode ? `/lobby/${roomCode}` : '/')
  }

  // Guard: if no game result data, show fallback
  if (!result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-neutral-400 text-sm">{t('results.noGameData', 'No game data available.')}</p>
        <button onClick={() => { reset(); navigate('/') }} className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors">
          {t('results.backHome', 'Back to Home')}
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {showCinematic && (
        <OutcomeCinematic didWin={didWin} onDone={() => setShowCinematic(false)} />
      )}

      <NavBar />

      {/* Rank Up Celebration Overlay */}
      {showRankCelebration && rankUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="text-center animate-bounce-in px-8 py-10">
            <p className="text-6xl mb-4">{RANK_CONFIG[rankUp.newTier]?.icon ?? '🏅'}</p>
            <p className="text-xs uppercase tracking-widest text-neutral-400 mb-2 font-semibold">{t('results.rankUp')}</p>
            <div className="flex items-center justify-center gap-3 mb-3">
              <span className="text-neutral-500 text-lg">{RANK_CONFIG[rankUp.oldTier]?.icon}</span>
              <span className="text-neutral-500">→</span>
              <span className="text-3xl">{RANK_CONFIG[rankUp.newTier]?.icon}</span>
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-1">
              {RANK_CONFIG[rankUp.newTier]?.label}
            </h2>
            <p className="text-neutral-400 text-sm">{rankUp.newLP} LP</p>
            <button
              onClick={() => setShowRankCelebration(false)}
              className="mt-6 px-6 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors"
            >
              {t('results.continue')}
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 p-4 pb-20 sm:pb-12">
        <div className="max-w-lg mx-auto space-y-4 animate-slide-up">

          {/* Outcome hero */}
          <div className={[
            'card relative overflow-hidden text-center py-8',
            winner === 'jester'     ? 'border-pink-700/40'
            : winner === 'evil_twins' ? 'border-purple-700/40'
            : didWin                  ? 'border-emerald-700/40'
            :                           'border-red-800/40',
          ].join(' ')}>
            <div className={[
              'absolute inset-0 opacity-10',
              winner === 'jester'       ? 'bg-gradient-to-br from-pink-500 to-transparent'
              : winner === 'evil_twins' ? 'bg-gradient-to-br from-purple-500 to-transparent'
              : didWin                  ? 'bg-gradient-to-br from-emerald-500 to-transparent'
              :                           'bg-gradient-to-br from-red-600 to-transparent',
            ].join(' ')} />
            <div className={[
              'absolute top-0 inset-x-0 h-0.5',
              winner === 'jester'       ? 'bg-gradient-to-r from-transparent via-pink-500 to-transparent'
              : winner === 'evil_twins' ? 'bg-gradient-to-r from-transparent via-purple-500 to-transparent'
              : didWin                  ? 'bg-gradient-to-r from-transparent via-emerald-500 to-transparent'
              :                           'bg-gradient-to-r from-transparent via-red-500 to-transparent',
            ].join(' ')} />
            <div className="relative">
              <p className={['text-6xl mb-3', didWin ? 'animate-bounce-in' : ''].join(' ')}>
                {winner === 'jester'       ? '🃏'
                 : winner === 'evil_twins' ? '👯'
                 : didWin                  ? '🏆'
                 :                           '💀'}
              </p>
              <h1 className={[
                'text-3xl font-extrabold tracking-tight mb-1',
                winner === 'jester'       ? 'text-pink-400'
                : winner === 'evil_twins' ? 'text-purple-400'
                : didWin                  ? 'text-emerald-400'
                :                           'text-red-400',
              ].join(' ')}>
                {isDraw
                  ? t('results.draw', "It's a Draw!")
                  : winner === 'jester' && isJester
                    ? t('results.jesterVictory', 'The Jester Wins!')
                    : winner === 'evil_twins' && isTwin
                      ? t('results.evilTwinsVictory', 'The Evil Twins Win!')
                      : didWin ? t('results.victory') : t('results.defeat')}
              </h1>
              <p className="text-neutral-400 text-sm">
                {isDraw
                  ? t('results.drawDesc', 'The game lasted 30 rounds with no winner')
                  : winner === 'jester'
                    ? t('results.jesterWonDesc', 'The Jester was voted out and won alone!')
                    : winner === 'evil_twins'
                      ? t('results.evilTwinsWonDesc', 'Both twins survived — they win together!')
                      : winner === 'villagers'
                        ? t('results.villagersWon')
                        : t('results.redHandedWon')}
              </p>
              {twinPartnerDead && !didWin && isTwin && (
                <p className="text-purple-400 text-xs mt-2 font-semibold">
                  {t('results.twinPartnerDead', 'Your twin died — you lose individually even though your team won.')}
                </p>
              )}
            </div>
          </div>

          {/* Word reveal — show the two words from the game */}
          {result.finalRound?.wordReveal && (
            <div className="grid grid-cols-2 gap-3">
              <div className="card text-center py-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">{t('game.villagerWord', 'Villager Word')}</p>
                <p className="text-xl font-extrabold text-white">{result.finalRound.wordReveal.villagerWord}</p>
              </div>
              <div className="card text-center py-4 border-amber-800/30">
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">{t('game.redHandedWord', 'Red-Handed Word')}</p>
                <p className="text-xl font-extrabold text-amber-400">{result.finalRound.wordReveal.redHandedWord}</p>
              </div>
            </div>
          )}

          {/* Animated Rewards */}
          <div className="card border-neutral-800/60">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">{t('results.rewards')}</p>

            {/* Hero: modern "coins won" reveal card */}
            <CoinsRevealCard
              baseEarned={rewards?.starCoinsEarned ?? 0}
              dailyBonus={rewards?.dailyBonusEarned ?? 0}
              streakBonus={rewards?.streakBonusEarned ?? 0}
              gameCost={rewards?.gameCostPaid ?? 0}
              newStreakCount={rewards?.newStreakCount ?? 0}
            />

            {/* XP / LP secondary chips (coins live in the hero card above) */}
            {(!isLobby || isRanked) && (
              <div className={['grid gap-3 mt-3', isRanked && !isLobby ? 'grid-cols-2' : 'grid-cols-1'].join(' ')}>
                {!isLobby && (
                  <div className="flex flex-col items-center gap-1 p-4 rounded-xl bg-gradient-to-b from-blue-950/40 to-neutral-800/60 border border-blue-800/30 animate-count-up shadow-sm shadow-blue-950/30 relative overflow-hidden" style={{ animationDelay: '0.3s' }}>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/5 to-transparent -translate-x-full animate-[shimmer_2s_ease-in-out_1.4s_1_forwards]" style={{ backgroundSize: '200% 100%' }} />
                    <span className="text-2xl">⚡</span>
                    <span className="text-xl font-bold text-blue-300 tabular-nums">+{animatedXP}</span>
                    <span className="text-xs text-neutral-500">{t('results.xp')}</span>
                  </div>
                )}
                {isRanked && (
                  <div className={[
                    'flex flex-col items-center gap-1 p-4 rounded-xl border animate-count-up relative overflow-hidden',
                    (rewards?.lpChange ?? 0) >= 0
                      ? 'bg-gradient-to-b from-emerald-950/40 to-neutral-800/60 border-emerald-800/30 shadow-sm shadow-emerald-950/30'
                      : 'bg-gradient-to-b from-red-950/40 to-neutral-800/60 border-red-800/30 shadow-sm shadow-red-950/30',
                  ].join(' ')} style={{ animationDelay: '0.5s' }}>
                    <span className="text-2xl">📊</span>
                    <span className={[
                      'text-xl font-bold tabular-nums',
                      (rewards?.lpChange ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400',
                    ].join(' ')}>
                      {(rewards?.lpChange ?? 0) >= 0 ? '+' : '-'}{animatedLP}
                    </span>
                    <span className="text-xs text-neutral-500">{t('results.lp')}</span>
                  </div>
                )}
              </div>
            )}

            {(rewards?.achievements?.length ?? 0) > 0 && (
              <div className="mt-3 pt-3 border-t border-neutral-800">
                <p className="text-xs text-neutral-500 mb-2">{t('results.achievementsUnlocked')}</p>
                <div className="flex flex-wrap gap-2">
                  {rewards!.achievements.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-950/60 border border-brand-800/40 text-brand-400 text-xs font-semibold animate-scale-in">
                      🏅 {a.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Player reveal */}
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">{t('results.playerRoles')}</p>
            <div className="space-y-2">
              {players.map((p, idx) => {
                const role = (p as any).role as string | undefined
                const survived = (p as any).survived as boolean | undefined
                const isMe = p.userId === user?.id
                return (
                  <div
                    key={p.id}
                    className={[
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors animate-slide-up',
                      isMe ? 'border-brand-800/50 bg-brand-950/20' : 'border-neutral-800 bg-neutral-900/40',
                    ].join(' ')}
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    <Avatar username={p.username} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isMe ? (
                          <span className="font-semibold text-white text-sm truncate">{p.username}</span>
                        ) : (
                          <Link
                            to={`/player/${p.userId}`}
                            className="font-semibold text-white text-sm truncate hover:text-brand-400 transition-colors"
                          >
                            {p.username}
                          </Link>
                        )}
                        {isMe && <span className="text-[10px] text-brand-400 font-bold">{t('results.you')}</span>}
                      </div>
                    </div>
                    <span className={[
                      'text-xs font-semibold px-2 py-0.5 rounded-full',
                      role === 'red_handed' || role === 'double_agent' || role === 'infiltrator' ||
                      role === 'kamikaze' || role === 'corruptor' || role === 'inverter' || role === 'twin_red_handed'
                        ? 'bg-red-950/60 text-red-400 border border-red-800/40'
                        : role === 'jester'
                          ? 'bg-pink-950/60 text-pink-400 border border-pink-800/40'
                          : role === 'twin_villager'
                            ? 'bg-purple-950/60 text-purple-400 border border-purple-800/40'
                            : 'bg-brand-950/60 text-brand-400 border border-brand-800/40',
                    ].join(' ')}>
                      {role === 'red_handed' ? t('results.redHanded')
                        : role === 'double_agent' ? t('results.doubleAgent')
                        : role === 'detective' ? t('results.detective')
                        : role === 'guardian' ? t('results.guardian', 'Guardian')
                        : role === 'mayor' ? t('results.mayor', 'Mayor')
                        : role === 'infiltrator' ? t('results.infiltrator', 'Infiltrator')
                        : role === 'jester' ? t('results.jester', 'Jester')
                        : role === 'judge' ? t('results.judge', 'Judge')
                        : role === 'revenant' ? t('results.revenant', 'Revenant')
                        : role === 'kamikaze' ? t('results.kamikaze', 'Kamikaze')
                        : role === 'corruptor' ? t('results.corruptor', 'Corruptor')
                        : role === 'inverter' ? t('results.inverter', 'Inverter')
                        : role === 'twin_villager' ? t('results.twinVillager', 'Evil Twin (Villager)')
                        : role === 'twin_red_handed' ? t('results.twinRedHanded', 'Evil Twin (RedHanded)')
                        : t('results.villager')}
                    </span>
                    {survived !== undefined && (
                      <span className={[
                        'text-xs',
                        survived ? 'text-emerald-500' : 'text-neutral-600',
                      ].join(' ')}>
                        {survived ? t('results.survived') : t('results.eliminated')}
                      </span>
                    )}
                    {!isMe && (
                      <PlayerActionMenu targetUserId={p.userId} targetUsername={p.username}>
                        {(openMenu) => (
                          <button
                            onClick={(e) => { e.stopPropagation(); openMenu() }}
                            className="w-6 h-6 flex items-center justify-center rounded-lg text-neutral-600 hover:text-neutral-400 hover:bg-neutral-800 transition-colors text-xs"
                            title="More options"
                          >
                            ⋯
                          </button>
                        )}
                      </PlayerActionMenu>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Game Recap — round-by-round */}
          {completedRounds.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Game Recap</p>
                <span className="text-xs text-neutral-600">{completedRounds.length} round{completedRounds.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {completedRounds.map((round) => (
                  <RoundRecap key={round.id} round={round} players={players} />
                ))}
              </div>
            </div>
          )}

          {/* Give honor */}
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">{t('results.giveHonor')}</p>
            <div className="space-y-2">
              {players
                .filter((p) => p.userId !== user?.id)
                .map((p) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <Avatar username={p.username} size="xs" />
                    <span className="flex-1 text-sm text-white font-medium">{p.username}</span>
                    {honorGiven[p.userId] ? (
                      <span className="text-xs text-emerald-400 font-semibold animate-scale-in">
                        {HONOR_ICON[honorGiven[p.userId]]}{' '}
                        {t(`honor.${honorGiven[p.userId] === 'sharp_mind' ? 'sharpMind' : honorGiven[p.userId] === 'good_sport' ? 'goodSport' : 'teamplayer'}`)}
                      </span>
                    ) : honorTarget === p.userId ? (
                      <div className="flex flex-col gap-1.5 items-end animate-slide-up">
                        {(['teamplayer', 'sharp_mind', 'good_sport'] as HonorType[]).map((type) => {
                          const honorColors: Record<HonorType, string> = {
                            teamplayer: 'bg-emerald-950/60 hover:bg-emerald-900/60 border-emerald-800/40 text-emerald-300 hover:text-emerald-200',
                            sharp_mind: 'bg-blue-950/60 hover:bg-blue-900/60 border-blue-800/40 text-blue-300 hover:text-blue-200',
                            good_sport: 'bg-amber-950/60 hover:bg-amber-900/60 border-amber-800/40 text-amber-300 hover:text-amber-200',
                          }
                          return (
                            <button
                              key={type}
                              onClick={() => handleHonor(p.userId, type)}
                              className={['flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all hover:-translate-y-0.5 hover:shadow-sm', honorColors[type]].join(' ')}
                            >
                              <span>{HONOR_ICON[type]}</span>
                              <span>{t(`honor.${type === 'sharp_mind' ? 'sharpMind' : type === 'good_sport' ? 'goodSport' : 'teamplayer'}`)}</span>
                            </button>
                          )
                        })}
                        <button
                          onClick={() => setHonorTarget(null)}
                          className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors"
                        >
                          {t('results.cancel')}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setHonorTarget(p.userId)}
                        className="text-xs px-3 py-1.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all border border-neutral-700/50 hover:border-neutral-600 font-medium hover:-translate-y-0.5 hover:shadow-sm"
                      >
                        {t('results.plusHonor')}
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* Game Chat */}
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">{t('results.gameChat')}</p>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-3 pr-1">
              {chatMessages.length === 0 ? (
                <p className="text-neutral-600 text-sm text-center py-4">{t('results.noMessages')}</p>
              ) : (
                (() => {
                  let lastUser = ''
                  return chatMessages.map((msg) => {
                    const isMe = msg.userId === user?.id
                    const showName = msg.userId !== lastUser
                    lastUser = msg.userId
                    return (
                      <div
                        key={msg.id}
                        className={['flex gap-2', isMe ? 'flex-row-reverse' : 'flex-row'].join(' ')}
                      >
                        {showName && !isMe && (
                          <div className="w-7 h-7 rounded-full bg-brand-600/60 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5">
                            {msg.username.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        {(!showName || isMe) && <div className="w-7 flex-shrink-0" />}
                        <div className="flex flex-col max-w-[75%]">
                          {showName && (
                            <span className={['text-[10px] text-neutral-500 mb-0.5', isMe ? 'text-right' : ''].join(' ')}>
                              {isMe ? t('results.you') : msg.username} · {formatTime(msg.createdAt)}
                            </span>
                          )}
                          <div className={[
                            'px-3 py-1.5 rounded-2xl text-sm',
                            isMe
                              ? 'bg-brand-600/80 text-white rounded-tr-sm self-end'
                              : 'bg-neutral-800 text-neutral-200 rounded-tl-sm',
                          ].join(' ')}>
                            {msg.text}
                          </div>
                        </div>
                      </div>
                    )
                  })
                })()
              )}
              <div ref={chatBottomRef} />
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-neutral-800">
              <input
                type="text"
                placeholder={t('results.chatPlaceholder')}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                className="flex-1 px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-brand-600 transition-colors"
              />
              <button
                onClick={handleChatSend}
                disabled={!chatInput.trim()}
                className="px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('results.send')}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handlePlayAgain}
              className="flex-1 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-lg transition-all shadow-lg shadow-brand-600/30 hover:shadow-brand-600/50 active:scale-[0.98]"
            >
              {t('results.playAgain')}
            </button>
            <button
              onClick={() => { reset(); navigate('/') }}
              className="px-5 py-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold transition-colors"
            >
              {t('results.exit', 'Exit')}
            </button>
          </div>

        </div>
      </main>
    </div>
  )
}
