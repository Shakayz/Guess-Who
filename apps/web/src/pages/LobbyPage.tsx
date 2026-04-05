import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Locale } from '@imposter/shared'
import { useAuthStore } from '../store/auth'
import { useGameStore } from '../store/game'
import { connectSocket, getSocket } from '../lib/socket'
import { api } from '../lib/api'
import { RoomCodeDisplay, PlayerCard } from '@imposter/ui'
import { NavBar } from '../components/NavBar'
import { WORD_CATEGORIES } from '@imposter/shared'
import type { Room, GameMode, WordCategory } from '@imposter/shared'

interface Friend {
  friendshipId: string
  user: { id: string; username: string; avatarUrl: string | null }
}

const LANGUAGE_OPTIONS: { value: Locale; country: string; label: string }[] = [
  { value: 'en', country: 'gb', label: 'English' },
  { value: 'fr', country: 'fr', label: 'Français' },
  { value: 'es', country: 'es', label: 'Español' },
  { value: 'pt', country: 'br', label: 'Português' },
  { value: 'ar', country: 'sa', label: 'العربية' },
  { value: 'it', country: 'it', label: 'Italiano' },
  { value: 'zh', country: 'cn', label: '中文' },
  { value: 'de', country: 'de', label: 'Deutsch' },
]

interface Settings {
  maxPlayers: number
  imposterCount: number
  speakingTimeSeconds: number
  votingTimeSeconds: number
  gameMode: GameMode
  categories: WordCategory[]
  enableDetective: boolean
  enableDoubleAgent: boolean
  maxRounds: number
  language: Locale
}

function NumStepper({
  label, value, min, max, step = 1,
  format, onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number
  format?: (v: number) => string; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-neutral-300 flex-1">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold transition-colors"
        >−</button>
        <span className="text-sm font-mono font-semibold text-white w-14 text-center">
          {format ? format(value) : value}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold transition-colors"
        >+</button>
      </div>
    </div>
  )
}

function SettingsPanel({
  settings, onChange,
}: { settings: Settings; onChange: (s: Settings) => void }) {
  const { t, i18n } = useTranslation()

  const toggleCategory = (key: WordCategory) => {
    const cats = settings.categories.includes(key)
      ? settings.categories.filter((c) => c !== key)
      : [...settings.categories, key]
    onChange({ ...settings, categories: cats })
  }

  const handleModeChange = (mode: GameMode) => {
    onChange({
      ...settings,
      gameMode: mode,
      enableDetective: mode === 'normal' ? false : settings.enableDetective,
      enableDoubleAgent: mode === 'normal' ? false : settings.enableDoubleAgent,
    })
  }

  return (
    <div className="card space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">{t('lobby.roomSettings')}</p>

      {/* Game mode */}
      <div>
        <p className="text-xs text-neutral-500 mb-2">{t('lobby.gameMode')}</p>
        <div className="flex gap-2">
          <button
            onClick={() => handleModeChange('normal')}
            className={[
              'flex-1 py-2 rounded-xl text-sm font-semibold transition-all border',
              settings.gameMode === 'normal'
                ? 'bg-brand-950/60 border-brand-700/50 text-brand-400'
                : 'bg-neutral-800/60 border-neutral-700/50 text-neutral-400 hover:text-white',
            ].join(' ')}
          >
            🎭 {t('lobby.normal')}
          </button>
          <button
            onClick={() => handleModeChange('special')}
            className={[
              'flex-1 py-2 rounded-xl text-sm font-semibold transition-all border',
              settings.gameMode === 'special'
                ? 'bg-purple-950/60 border-purple-700/50 text-purple-400'
                : 'bg-neutral-800/60 border-neutral-700/50 text-neutral-400 hover:text-white',
            ].join(' ')}
          >
            ✨ {t('lobby.special')}
          </button>
        </div>
        <p className="text-xs text-neutral-600 mt-1.5">
          {settings.gameMode === 'special' ? t('lobby.specialDesc') : t('lobby.normalDesc')}
        </p>
      </div>

      {/* Special roles */}
      {settings.gameMode === 'special' && (
        <div className="space-y-2">
          <p className="text-xs text-neutral-500">{t('lobby.specialRoles')}</p>
          <div className="flex gap-2">
            <button
              onClick={() => onChange({ ...settings, enableDetective: !settings.enableDetective })}
              className={[
                'flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all border',
                settings.enableDetective
                  ? 'bg-sky-950/60 border-sky-700/50 text-sky-400'
                  : 'bg-neutral-800/60 border-neutral-700/50 text-neutral-400 hover:text-white',
              ].join(' ')}
            >
              {t('lobby.detective')}
            </button>
            <button
              onClick={() => onChange({ ...settings, enableDoubleAgent: !settings.enableDoubleAgent })}
              className={[
                'flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all border',
                settings.enableDoubleAgent
                  ? 'bg-rose-950/60 border-rose-700/50 text-rose-400'
                  : 'bg-neutral-800/60 border-neutral-700/50 text-neutral-400 hover:text-white',
              ].join(' ')}
            >
              {t('lobby.doubleAgent')}
            </button>
          </div>
          {settings.enableDetective && (
            <p className="text-[10px] text-neutral-600">{t('lobby.detectiveDesc')}</p>
          )}
          {settings.enableDoubleAgent && (
            <p className="text-[10px] text-neutral-600">{t('lobby.doubleAgentDesc')}</p>
          )}
        </div>
      )}

      {/* Category picker */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-neutral-500">{t('lobby.categories')}</p>
          <div className="flex gap-2">
            <button
              onClick={() => onChange({ ...settings, categories: WORD_CATEGORIES.map((c) => c.key as WordCategory) })}
              className="text-[10px] text-brand-400 hover:text-brand-300"
            >{t('lobby.catAll')}</button>
            <span className="text-neutral-700">·</span>
            <button
              onClick={() => onChange({ ...settings, categories: [] })}
              className="text-[10px] text-neutral-500 hover:text-neutral-400"
            >{t('lobby.catNone')}</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {WORD_CATEGORIES.map((cat) => {
            const selected = settings.categories.includes(cat.key as WordCategory)
            return (
              <button
                key={cat.key}
                onClick={() => toggleCategory(cat.key as WordCategory)}
                className={[
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  selected
                    ? 'bg-brand-950/60 border-brand-700/50 text-brand-300'
                    : settings.categories.length === 0
                      ? 'bg-neutral-800/40 border-neutral-700/30 text-neutral-400'
                      : 'bg-neutral-900/40 border-neutral-800/40 text-neutral-600',
                ].join(' ')}
              >
                <span>{cat.icon}</span>
                <span className="truncate">{t(`home.cat.${cat.key}`, cat.label)}</span>
              </button>
            )
          })}
        </div>
        {settings.categories.length === 0 && (
          <p className="text-[10px] text-neutral-600 mt-1">{t('lobby.catNoFilter')}</p>
        )}
      </div>

      {/* Language */}
      <div>
        <p className="text-xs text-neutral-500 mb-2">{t('lobby.language')}</p>
        <div className="grid grid-cols-4 gap-1.5">
          {LANGUAGE_OPTIONS.map((lang) => (
            <button
              key={lang.value}
              onClick={() => onChange({ ...settings, language: lang.value })}
              className={[
                'flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl text-xs font-semibold transition-all border',
                settings.language === lang.value
                  ? 'bg-brand-950/60 border-brand-700/50 text-brand-300'
                  : 'bg-neutral-800/60 border-neutral-700/50 text-neutral-400 hover:text-white',
              ].join(' ')}
            >
              <img src={`https://flagcdn.com/w20/${lang.country}.png`} alt="" className="w-5 h-3.5 object-cover rounded-sm" />
              <span className="truncate w-full text-center text-[10px]">{lang.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-neutral-600 mt-1">{t('lobby.languageDesc')}</p>
      </div>

      {/* Numeric settings */}
      <div className="space-y-3 pt-1 border-t border-neutral-800">
        <NumStepper label={t('lobby.maxPlayers')}   value={settings.maxPlayers}           min={3}  max={20} onChange={(v) => onChange({ ...settings, maxPlayers: v })} />
        <NumStepper label={t('lobby.imposters')}    value={settings.imposterCount}        min={1}  max={4}  onChange={(v) => onChange({ ...settings, imposterCount: v })} />
        <NumStepper
          label={t('lobby.rounds')}
          value={settings.maxRounds}
          min={0} max={20}
          format={(v) => v === 0 ? '∞' : `${v}`}
          onChange={(v) => onChange({ ...settings, maxRounds: v })}
        />
        <NumStepper label={t('lobby.speakingTime')} value={settings.speakingTimeSeconds}  min={10} max={120} step={5} format={(v) => `${v}s`} onChange={(v) => onChange({ ...settings, speakingTimeSeconds: v })} />
        <NumStepper label={t('lobby.votingTime')}   value={settings.votingTimeSeconds}    min={15} max={120} step={5} format={(v) => `${v}s`} onChange={(v) => onChange({ ...settings, votingTimeSeconds: v })} />
      </div>
    </div>
  )
}

export default function LobbyPage() {
  const { code } = useParams<{ code: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const { room, setRoom, setRoleAndWord, setRound } = useGameStore()

  // Block joining a DIFFERENT lobby while in an active game
  const activeRoom = useGameStore((s) => s.room)
  const isInActiveGame = activeRoom && (activeRoom.status === 'in_progress' || activeRoom.status === 'voting')
  const isDifferentGame = isInActiveGame && activeRoom.code !== code
  useEffect(() => {
    if (isDifferentGame) {
      navigate('/', { replace: true })
    }
  }, [isDifferentGame, navigate])
  const [isReady, setIsReady] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [joinToast, setJoinToast] = useState<string | null>(null)
  const [socketError, setSocketError] = useState<string | null>(null)
  const prevPlayerCountRef = useRef(0)
  const langSyncedRef = useRef(false)
  const [showInvite, setShowInvite] = useState(false)
  const [friends, setFriends] = useState<Friend[]>([])
  const [friendSearch, setFriendSearch] = useState('')
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [settings, setSettings] = useState<Settings>({
    maxPlayers: 10,
    imposterCount: 2,
    speakingTimeSeconds: 30,
    votingTimeSeconds: 30,
    gameMode: 'normal',
    categories: [],
    enableDetective: false,
    enableDoubleAgent: false,
    maxRounds: 0,
    language: (i18n.language.split('-')[0] as Locale) || 'en',
  })
  const [copied, setCopied] = useState(false)

  const handleSettingsChange = (s: Settings) => {
    setSettings(s)
    getSocket().emit('room:settings' as any, {
      gameMode: s.gameMode,
      categories: s.categories,
      enableDetective: s.enableDetective,
      enableDoubleAgent: s.enableDoubleAgent,
      maxRounds: s.maxRounds,
      maxPlayers: s.maxPlayers,
      imposterCount: s.imposterCount,
      speakingTimeSeconds: s.speakingTimeSeconds,
      votingTimeSeconds: s.votingTimeSeconds,
      language: s.language,
    })
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 1500)
  }

  useEffect(() => {
    if (!code) return
    connectSocket()
    const socket = getSocket()
    socket.emit('room:join', { roomCode: code })

    // Re-join on reconnect so the player stays in the socket.io room even after a brief disconnect
    const handleConnect = () => {
      socket.emit('room:join', { roomCode: code })
    }
    socket.on('connect', handleConnect)

    const modeParam = searchParams.get('mode')
    if (modeParam === 'normal' || modeParam === 'special') {
      setTimeout(() => {
        getSocket().emit('room:settings' as any, { gameMode: modeParam })
      }, 500)
    }

    socket.on('room:updated', (r) => {
      // If the game already started (e.g. we missed game:started), navigate immediately
      if ((r as any).status === 'in_progress' || (r as any).status === 'voting') {
        navigate(`/game/${code}`)
        return
      }
      setRoom(r as Room)
      if (r.players && r.players.length > prevPlayerCountRef.current) {
        const newPlayer = r.players[r.players.length - 1]
        if (newPlayer && newPlayer.userId !== user?.id) {
          setJoinToast(t('lobby.joinedRoom', { name: newPlayer.username }))
          setTimeout(() => setJoinToast(null), 2500)
        }
      }
      prevPlayerCountRef.current = r.players?.length ?? 0
      if (r.players && user) {
        const me = r.players.find((p: any) => p.userId === user.id)
        if (me) setIsReady(!!me.isReady)
      }
      if (r.settings) {
        const serverCats: WordCategory[] = (r.settings as any).categories ?? []
        const roomLang = (r.settings.language as Locale) ?? 'en'
        setSettings((prev) => ({
          ...prev,
          maxPlayers: r.settings.maxPlayers,
          imposterCount: r.settings.imposterCount,
          speakingTimeSeconds: r.settings.speakingTimeSeconds,
          votingTimeSeconds: r.settings.votingTimeSeconds,
          gameMode: (r.settings as any).gameMode ?? 'normal',
          categories: serverCats,
          enableDetective: (r.settings as any).enableDetective ?? false,
          enableDoubleAgent: (r.settings as any).enableDoubleAgent ?? false,
          maxRounds: r.maxRounds ?? 0,
          language: roomLang,
        }))
        // Switch UI language to match the room's language (only on first join)
        if (!langSyncedRef.current && i18n.language.split('-')[0] !== roomLang) {
          i18n.changeLanguage(roomLang)
          document.documentElement.dir = roomLang === 'ar' ? 'rtl' : 'ltr'
        }
        langSyncedRef.current = true
      }
    })
    socket.on('game:started', ({ round, yourWord, yourRole, yourVillagerWord }) => {
      setRoleAndWord(yourRole, yourWord, yourVillagerWord)
      setRound(round as any)
      navigate(`/game/${code}`)
    })
    socket.on('error', (err) => {
      const msg = (err as any).code === 'LANGUAGE_MISMATCH'
        ? t('room.languageMismatch')
        : err.message
      setSocketError(msg)
      setTimeout(() => setSocketError(null), 4000)
    })

    return () => {
      socket.off('connect', handleConnect)
      socket.off('room:updated')
      socket.off('game:started')
      socket.off('error')
    }
  }, [code])

  const toggleReady = () => {
    getSocket().emit('player:ready', !isReady)
    setIsReady((r) => !r)
  }

  const startGame = () => getSocket().emit('game:start')

  const toggleInvite = async () => {
    const next = !showInvite
    setShowInvite(next)
    if (next && friends.length === 0) {
      try {
        const data = await api.get<{ friends: Friend[] }>('/friends')
        setFriends(data.friends)
      } catch {}
    }
  }

  const copyRoomCode = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const el = document.createElement('textarea')
      el.value = code
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const shareRoom = async () => {
    if (!code) return
    const url = `${window.location.origin}/lobby/${code}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join my Imposter game!', text: `Join room ${code}`, url })
      } catch {}
    } else {
      copyRoomCode()
    }
  }

  const sendInvite = (friendId: string) => {
    if (!code) return
    getSocket().emit('room:invite' as any, { toUserId: friendId, roomCode: code })
    setInvitedIds((prev) => new Set([...prev, friendId]))
  }

  const isMatchmade = (room?.settings as any)?.isMatchmade ?? false
  const isHost = !isMatchmade && room?.hostId === user?.id
  const players = room?.players ?? []
  const allReady = players.length >= 2 && players.every((p) => p.isReady || p.userId === room?.hostId)
  const minPlayers = 3
  const activeCats = settings.categories.length > 0
    ? settings.categories.length
    : WORD_CATEGORIES.length

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      {joinToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-neutral-800 border border-neutral-700 text-sm text-white font-semibold shadow-xl animate-slide-up flex items-center gap-2">
          <span className="text-emerald-400">+</span>
          {joinToast}
        </div>
      )}

      {socketError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-red-950/90 border border-red-700/60 text-sm text-red-300 font-semibold shadow-xl animate-slide-up flex items-center gap-2">
          <span>⚠</span>
          {socketError}
        </div>
      )}

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4 animate-slide-up">

          <div className="text-center mb-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">{t('room.roomCode')}</p>
            <h1 className="text-2xl font-extrabold text-white">{t('lobby.waiting')}</h1>
            <p className="text-neutral-500 text-sm mt-1">{t('lobby.shareHint')}</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            {code && <RoomCodeDisplay code={code} />}
            <button
              onClick={shareRoom}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white border border-neutral-700 transition-all"
            >
              {t('lobby.share')}
            </button>
          </div>

          {/* Player list */}
          <div className="card space-y-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{t('lobby.players')}</p>
              <span className="text-xs text-neutral-500 tabular-nums">
                {players.length} / {settings.maxPlayers}
              </span>
            </div>
            {players.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-neutral-800 border-2 border-dashed border-neutral-700 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
                <p className="text-neutral-500 text-sm">{t('lobby.waitingToJoin')}</p>
                <p className="text-neutral-600 text-xs mt-1">{t('lobby.needAtLeast', { count: minPlayers })}</p>
              </div>
            ) : (
              players.map((p) => (
                <PlayerCard key={p.id} player={p} isCurrentUser={p.userId === user?.id} />
              ))
            )}
          </div>

          {players.length > 0 && players.length < minPlayers && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-950/40 border border-amber-800/30 text-amber-400 text-xs">
              <span>⚠</span>
              <span>{t('lobby.needMore', { min: minPlayers, more: minPlayers - players.length })}</span>
            </div>
          )}

          {/* Settings toggle (host) */}
          {isHost && (
            <button
              onClick={() => setShowSettings((s) => !s)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/50 transition-colors text-sm"
            >
              <span className="text-neutral-300 font-medium">⚙ {t('lobby.roomSettings')}</span>
              <div className="flex items-center gap-2 text-neutral-500 text-xs">
                {settingsSaved && (
                  <span className="text-emerald-400 font-semibold animate-fade-in">{t('lobby.saved')}</span>
                )}
                <span className={settings.gameMode === 'special' ? 'text-purple-400' : 'text-brand-400'}>
                  {settings.gameMode === 'special' ? `✨ ${t('lobby.special')}` : `🎮 ${t('lobby.normal')}`}
                </span>
                <span>·</span>
                <span>{activeCats} {t('lobby.catsShort')}</span>
                <span>{showSettings ? '▴' : '▾'}</span>
              </div>
            </button>
          )}

          {isHost && showSettings && (
            <SettingsPanel settings={settings} onChange={handleSettingsChange} />
          )}

          {/* Invite friends */}
          <button
            onClick={toggleInvite}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/50 transition-colors text-sm"
          >
            <span className="text-neutral-300 font-medium">{t('lobby.inviteFriends')}</span>
            <span className="text-neutral-500 text-xs">{showInvite ? '▴' : '▾'}</span>
          </button>

          {showInvite && (
            <div className="card space-y-3 animate-slide-up">
              <input
                className="input-field w-full text-sm"
                placeholder={t('lobby.searchFriends')}
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
              />
              {friends.length === 0 ? (
                <p className="text-neutral-500 text-xs text-center py-2">{t('lobby.noFriends')}</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {friends
                    .filter((f) =>
                      !friendSearch.trim() ||
                      f.user.username.toLowerCase().includes(friendSearch.toLowerCase())
                    )
                    .map((f) => (
                      <div key={f.friendshipId} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-neutral-800/50">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-300 flex-shrink-0">
                            {f.user.username[0]?.toUpperCase()}
                          </div>
                          <span className="text-sm text-white font-medium truncate">{f.user.username}</span>
                        </div>
                        <button
                          onClick={() => sendInvite(f.user.id)}
                          disabled={invitedIds.has(f.user.id)}
                          className={[
                            'flex-shrink-0 px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                            invitedIds.has(f.user.id)
                              ? 'bg-emerald-900/40 border border-emerald-700/40 text-emerald-400 cursor-default'
                              : 'bg-brand-600 hover:bg-brand-500 text-white',
                          ].join(' ')}
                        >
                          {invitedIds.has(f.user.id) ? t('lobby.invited') : t('lobby.invite')}
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Settings summary (non-host) */}
          {!isHost && (
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-500">
              <span>{settings.gameMode === 'special' ? '✨' : '🎮'}</span>
              <span>{settings.gameMode === 'special' ? t('lobby.special') : t('lobby.normal')}</span>
              <span>·</span>
              <span>{settings.maxPlayers} {t('lobby.max')}</span>
              <span>·</span>
              <span>{settings.imposterCount} {t('lobby.imposters').toLowerCase()}</span>
              <span>·</span>
              <span>{settings.maxRounds === 0 ? t('lobby.roundsInfinity') : t('lobby.roundsCount', { count: settings.maxRounds })}</span>
              {settings.gameMode === 'special' && settings.enableDetective && (
                <><span>·</span><span>{t('lobby.detective')}</span></>
              )}
              {settings.gameMode === 'special' && settings.enableDoubleAgent && (
                <><span>·</span><span>{t('lobby.doubleAgent')}</span></>
              )}
              {settings.categories.length > 0 && (
                <><span>·</span><span>{settings.categories.length} {t('lobby.categories').toLowerCase()}</span></>
              )}
            </div>
          )}

          {/* Ready progress */}
          {players.length >= 2 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500">{t('lobby.readyStatus')}</span>
                <span className={[
                  'font-semibold tabular-nums',
                  allReady ? 'text-emerald-400' : 'text-neutral-400',
                ].join(' ')}>
                  {t('lobby.readyCount', {
                    ready: players.filter((p) => p.isReady || p.isHost).length,
                    total: players.length,
                  })}
                </span>
              </div>
              <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className={[
                    'h-full rounded-full transition-all duration-500',
                    allReady ? 'bg-emerald-500' : 'bg-brand-500',
                  ].join(' ')}
                  style={{ width: `${(players.filter((p) => p.isReady || p.isHost).length / Math.max(players.length, 1)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => { getSocket().emit('room:leave'); navigate('/') }}
              className="px-4 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-sm transition-colors"
            >
              {t('lobby.leave')}
            </button>
            {isMatchmade ? (
              <div className="flex-1 py-3 rounded-xl bg-brand-950/60 border border-brand-700/40 text-brand-400 font-semibold text-center flex items-center justify-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                {t('lobby.autoStarting', 'Game starting automatically...')}
              </div>
            ) : !isHost ? (
              <button
                onClick={toggleReady}
                className={[
                  'flex-1 py-3 rounded-xl font-semibold transition-all',
                  isReady
                    ? 'bg-emerald-700/60 hover:bg-red-900/60 text-emerald-300 hover:text-red-300 border border-emerald-700/50'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20',
                ].join(' ')}
              >
                {isReady ? `✓ ${t('lobby.ready')}` : t('lobby.notReady')}
              </button>
            ) : (
              <button
                onClick={startGame}
                disabled={players.length < minPlayers || !allReady}
                className="flex-1 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-brand-600/20"
              >
                {t('lobby.startGame')}
              </button>
            )}
          </div>

          {isHost && !allReady && players.length >= minPlayers && (
            <p className="text-xs text-neutral-500 text-center">{t('lobby.waitingAllReady')}</p>
          )}
        </div>
      </main>
    </div>
  )
}
