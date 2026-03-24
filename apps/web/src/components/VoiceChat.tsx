/**
 * VoiceChat — stub component for Phase 4 WebRTC voice chat.
 *
 * Full implementation will use LiveKit or mediasoup for peer-to-peer / SFU audio.
 * This stub shows the voice chat UI panel and tracks mute state for future integration.
 *
 * TODO (Phase 4):
 *  - Integrate @livekit/client or mediasoup-client
 *  - Connect to signalling server endpoint (POST /api/rooms/:code/voice-token)
 *  - Implement push-to-talk mode via onMouseDown/onMouseUp / onTouchStart/onTouchEnd
 *  - Add open-mic mode toggle
 *  - Handle mobile Expo compatibility via react-native-webrtc
 */

import React, { useState } from 'react'

interface Props {
  roomCode: string
  players: { userId: string; username: string }[]
  currentUserId: string
}

export function VoiceChat({ roomCode: _roomCode, players, currentUserId }: Props) {
  const [muted, setMuted] = useState(true)
  const [connected] = useState(false) // Will be true once WebRTC is integrated

  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">🎙️ Voice Chat</p>

      {!connected ? (
        <div className="flex flex-col items-center py-4 text-center gap-3">
          <span className="text-3xl">🔊</span>
          <p className="text-white font-semibold text-sm">Voice Chat — Coming Soon</p>
          <p className="text-neutral-500 text-xs max-w-xs">
            Real-time voice chat will be available in Phase 4. WebRTC integration (LiveKit / mediasoup) is planned.
          </p>
          <div className="px-3 py-1 rounded-full bg-neutral-800 text-neutral-500 text-xs font-semibold">
            Phase 4 Feature
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-1 mb-3">
            {players.map((p) => (
              <div key={p.userId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-neutral-800/60">
                <span className="text-sm">{p.userId === currentUserId ? '🎙️' : '🔇'}</span>
                <span className="text-sm text-white flex-1">{p.username}</span>
                {p.userId === currentUserId && (
                  <span className="text-[10px] text-brand-400 font-semibold">YOU</span>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => setMuted((m) => !m)}
            className={[
              'w-full py-2 rounded-xl font-semibold text-sm transition-colors',
              muted
                ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400'
                : 'bg-brand-600 hover:bg-brand-500 text-white',
            ].join(' ')}
          >
            {muted ? '🔇 Unmute' : '🎙️ Mute'}
          </button>
        </>
      )}
    </div>
  )
}
