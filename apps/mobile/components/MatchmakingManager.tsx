import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/auth'
import { useMatchmakingStore } from '../store/matchmaking'
import { connectSocket, getSocket } from '../lib/socket'
import { createLogger } from '../lib/logger'
import type { MatchmakingStatus } from '@red-handed/shared'

const log = createLogger('matchmaking')

/**
 * Global, mount-once matchmaking manager. Mirrors the web's MatchmakingManager:
 * keeps the queue listeners alive across tab navigation, navigates to the
 * lobby on match found, and replays `matchmaking:join` on socket reconnect so
 * the server's queue eviction on disconnect doesn't leave the client with a
 * ghost banner that never resolves.
 */
export function MatchmakingManager() {
  const { t } = useTranslation()
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const isSearching = useMatchmakingStore((s) => s.isSearching)
  const setStatus = useMatchmakingStore((s) => s.setStatus)
  const stopSearch = useMatchmakingStore((s) => s.stopSearch)
  const setRequiredStars = useMatchmakingStore((s) => s.setRequiredStars)
  const setErrorMessage = useMatchmakingStore((s) => s.setErrorMessage)

  // Logging out drops us from the server queue via disconnect; clear the
  // store so the banner doesn't linger against a logged-out session.
  useEffect(() => {
    if (!token && isSearching) stopSearch()
  }, [token, isSearching, stopSearch])

  useEffect(() => {
    if (!isSearching) return
    connectSocket()
    const sock = getSocket() as any
    if (!sock) return

    const handleStatus = (d: MatchmakingStatus) => setStatus(d)
    const handleFound = (d: { roomCode: string }) => {
      stopSearch()
      router.push(`/lobby/${d.roomCode}`)
    }
    const handleError = (d: { reason?: string; required?: number; message?: string }) => {
      stopSearch()
      if (d?.reason === 'INSUFFICIENT_STARS') {
        setRequiredStars(d.required ?? 10)
      } else {
        setErrorMessage(d?.message ?? t('common.error'))
      }
    }
    const handleConnect = () => {
      const payload = useMatchmakingStore.getState().joinPayload
      if (!useMatchmakingStore.getState().isSearching || !payload) return
      log.info('socket reconnected, re-joining queue', { gameMode: payload.gameMode })
      sock.emit('matchmaking:join', {
        gameMode: payload.gameMode,
        categories: payload.categories,
        vocalMode: payload.vocalMode,
        vocalSpeakingTimeSeconds: payload.vocalSpeakingTimeSeconds ?? 10,
        locale: payload.locale,
      })
    }

    sock.on('matchmaking:status', handleStatus)
    sock.on('matchmaking:found', handleFound)
    sock.on('matchmaking:error', handleError)
    sock.on('connect', handleConnect)

    // Heartbeat: keep the socket alive while the user browses other tabs so
    // periodic status broadcasts keep flowing through to the banner.
    const heartbeat = setInterval(() => {
      const s = getSocket()
      if (s && !s.connected) {
        log.info('heartbeat: socket disconnected, reconnecting')
        connectSocket()
      }
    }, 5000)

    return () => {
      clearInterval(heartbeat)
      sock.off('matchmaking:status', handleStatus)
      sock.off('matchmaking:found', handleFound)
      sock.off('matchmaking:error', handleError)
      sock.off('connect', handleConnect)
    }
  }, [isSearching, t, router, setStatus, stopSearch, setRequiredStars, setErrorMessage])

  return null
}
