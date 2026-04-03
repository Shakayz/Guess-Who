import { create } from 'zustand'

interface ActiveDm {
  friendId: string
  friendUsername: string
}

interface PendingFriendRequest {
  friendshipId: string
  fromId: string
  fromUsername: string
}

interface SocialStore {
  activeDm: ActiveDm | null
  setActiveDm: (dm: ActiveDm | null) => void
  unreadCounts: Record<string, number>
  incrementUnread: (friendId: string) => void
  clearUnread: (friendId: string) => void
  pendingInvite: { fromUsername: string; roomCode: string } | null
  setPendingInvite: (invite: { fromUsername: string; roomCode: string } | null) => void
  pendingFriendRequest: PendingFriendRequest | null
  setPendingFriendRequest: (req: PendingFriendRequest | null) => void
}

export const useSocialStore = create<SocialStore>((set) => ({
  activeDm: null,
  setActiveDm: (dm) => set({ activeDm: dm }),
  unreadCounts: {},
  incrementUnread: (friendId) =>
    set((s) => ({
      unreadCounts: {
        ...s.unreadCounts,
        [friendId]: (s.unreadCounts[friendId] ?? 0) + 1,
      },
    })),
  clearUnread: (friendId) =>
    set((s) => {
      const { [friendId]: _, ...rest } = s.unreadCounts
      return { unreadCounts: rest }
    }),
  pendingInvite: null,
  setPendingInvite: (invite) => set({ pendingInvite: invite }),
  pendingFriendRequest: null,
  setPendingFriendRequest: (req) => set({ pendingFriendRequest: req }),
}))
