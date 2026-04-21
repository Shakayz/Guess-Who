import React from 'react'
import { useSocialStore } from '../store/social'
import DmChatModal from './DmChatModal'

/**
 * Mounts DmChatModal at the root so the modal stays available no matter which
 * tab the user is on — letting the DM toast tap-to-open flow work across the
 * whole app (otherwise the modal only existed under the Friends tab).
 */
export function GlobalDmChatHost() {
  const activeDm = useSocialStore((s) => s.activeDm)
  const setActiveDm = useSocialStore((s) => s.setActiveDm)

  if (!activeDm) return null

  return (
    <DmChatModal
      visible
      friendId={activeDm.friendId}
      friendUsername={activeDm.friendUsername}
      onClose={() => setActiveDm(null)}
    />
  )
}
