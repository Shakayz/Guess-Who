/**
 * MenuMusic.test.tsx
 *
 * The component is a no-render side-effect orchestrator. Its job:
 *   - Boot MusicManager once.
 *   - Pause music while the player is on /game/* (gameplay sound effects own
 *     the audio scape; the menu loop would muddy them).
 *   - Re-play when the player navigates away from /game/*.
 *   - Auto-unlock playback on the first user interaction (pointerdown /
 *     keydown) — browsers block audio.play() until a real gesture, so the
 *     initial useEffect's play() can silently fail. The one-shot listener
 *     here is the recovery path.
 */
import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const init = vi.fn()
const play = vi.fn()
const pause = vi.fn()
let isEnabled = true

vi.mock('../../lib/music', () => ({
  MusicManager: {
    init: () => init(),
    play: () => play(),
    pause: () => pause(),
    isEnabled: () => isEnabled,
  },
}))

import { MenuMusic } from '../../components/MenuMusic'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<MenuMusic />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  init.mockReset()
  play.mockReset()
  pause.mockReset()
  isEnabled = true
})

describe('MenuMusic', () => {
  it('initialises the MusicManager on mount', () => {
    renderAt('/')
    expect(init).toHaveBeenCalled()
  })

  it('plays the menu loop on a non-game route', () => {
    renderAt('/leaderboard')
    expect(play).toHaveBeenCalled()
    expect(pause).not.toHaveBeenCalled()
  })

  it('pauses while on /game/* (gameplay owns the audio scape)', () => {
    renderAt('/game/ABC123')
    expect(pause).toHaveBeenCalled()
    expect(play).not.toHaveBeenCalled()
  })

  it('respects the disabled flag — does not play even on a menu route', () => {
    isEnabled = false
    renderAt('/')
    expect(play).not.toHaveBeenCalled()
    expect(pause).toHaveBeenCalled()
  })

  it('attempts to (re)play on the first pointerdown after mount (autoplay-policy unlock)', () => {
    renderAt('/')
    play.mockReset()
    fireEvent.pointerDown(window)
    expect(play).toHaveBeenCalled()
  })

  it('does not attach the unlock listener on game routes (no music to unlock there)', () => {
    renderAt('/game/ABC')
    play.mockReset()
    fireEvent.pointerDown(window)
    expect(play).not.toHaveBeenCalled()
  })

  it('unlock listener is one-shot — a second pointerdown does not re-fire play()', () => {
    renderAt('/')
    play.mockReset()
    fireEvent.pointerDown(window)
    fireEvent.pointerDown(window)
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('unlock listener also fires on keydown so kbd-only users still get audio', () => {
    renderAt('/')
    play.mockReset()
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(play).toHaveBeenCalled()
  })

  it('renders nothing — it is a side-effect-only component', () => {
    const { container } = renderAt('/')
    expect(container.innerHTML).toBe('')
  })
})
