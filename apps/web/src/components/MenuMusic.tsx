import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { MusicManager } from '../lib/music'

export function MenuMusic() {
  const { pathname } = useLocation()
  const isGame = pathname.startsWith('/game/')

  useEffect(() => {
    MusicManager.init()
    if (isGame || !MusicManager.isEnabled()) {
      MusicManager.pause()
    } else {
      MusicManager.play()
    }
  }, [isGame])

  // Browsers block audio.play() until the first user gesture. If the initial
  // play() rejected because of that, this one-shot listener kicks it off as
  // soon as the user interacts anywhere on the page.
  useEffect(() => {
    if (isGame) return
    const unlock = () => {
      if (!MusicManager.isEnabled()) return
      MusicManager.play()
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [isGame])

  return null
}
