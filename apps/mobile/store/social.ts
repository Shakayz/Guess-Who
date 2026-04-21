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

export interface AchievementToast {
  id: string
  key: string
  name: string
  icon: string
  difficulty: string
  starsReward: number
}

export interface FriendAcceptedToast {
  id: string
  username: string
}

export interface GiftToast {
  id: string
  senderUsername: string
  coinAmount: number
  premiumPlanId: string | null
  message: string | null
}

export interface DmToast {
  id: string
  senderId: string
  senderUsername: string
  text: string
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
  achievementToasts: AchievementToast[]
  pushAchievementToast: (data: Omit<AchievementToast, 'id'>) => void
  dismissAchievementToast: (id: string) => void
  friendAcceptedToasts: FriendAcceptedToast[]
  pushFriendAcceptedToast: (username: string) => void
  dismissFriendAcceptedToast: (id: string) => void
  giftToasts: GiftToast[]
  pushGiftToast: (data: Omit<GiftToast, 'id'>) => void
  dismissGiftToast: (id: string) => void
  dmToasts: DmToast[]
  pushDmToast: (data: Omit<DmToast, 'id'>) => void
  dismissDmToast: (id: string) => void
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
  achievementToasts: [],
  pushAchievementToast: (data) =>
    set((s) => ({
      achievementToasts: [
        ...s.achievementToasts,
        { ...data, id: `${data.key}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
      ],
    })),
  dismissAchievementToast: (id) =>
    set((s) => ({
      achievementToasts: s.achievementToasts.filter((t) => t.id !== id),
    })),
  friendAcceptedToasts: [],
  pushFriendAcceptedToast: (username) =>
    set((s) => ({
      friendAcceptedToasts: [
        ...s.friendAcceptedToasts,
        { id: `fa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, username },
      ],
    })),
  dismissFriendAcceptedToast: (id) =>
    set((s) => ({
      friendAcceptedToasts: s.friendAcceptedToasts.filter((t) => t.id !== id),
    })),
  giftToasts: [],
  pushGiftToast: (data) =>
    set((s) => ({
      giftToasts: [
        ...s.giftToasts,
        { ...data, id: `gift-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
      ],
    })),
  dismissGiftToast: (id) =>
    set((s) => ({
      giftToasts: s.giftToasts.filter((t) => t.id !== id),
    })),
  dmToasts: [],
  pushDmToast: (data) =>
    set((s) => ({
      dmToasts: [
        ...s.dmToasts.filter((t) => t.senderId !== data.senderId),
        { ...data, id: `dm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
      ],
    })),
  dismissDmToast: (id) =>
    set((s) => ({
      dmToasts: s.dmToasts.filter((t) => t.id !== id),
    })),
}))
