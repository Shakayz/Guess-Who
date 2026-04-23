import { useEffect, useRef } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { useSegments } from 'expo-router'
import { MusicManager } from '../lib/music'

export function MenuMusic() {
  const segments = useSegments()
  const isGame = segments[0] === 'game'
  const isGameRef = useRef(isGame)
  isGameRef.current = isGame

  useEffect(() => {
    let cancelled = false
    MusicManager.init().then(() => {
      if (cancelled) return
      if (isGame || !MusicManager.isEnabled()) {
        MusicManager.pause()
      } else {
        MusicManager.play()
      }
    })
    return () => {
      cancelled = true
    }
  }, [isGame])

  // Pause while backgrounded; resume when returning to foreground on a menu
  // route with music still enabled.
  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      if (state === 'active') {
        if (!isGameRef.current && MusicManager.isEnabled()) {
          MusicManager.play()
        }
      } else if (state === 'background' || state === 'inactive') {
        MusicManager.pause()
      }
    }
    const sub = AppState.addEventListener('change', handler)
    return () => sub.remove()
  }, [])

  return null
}
