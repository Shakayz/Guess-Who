import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { useSocialStore } from '../../store/social'
import { useResponsive } from '../../lib/responsive'

/* ---------- Types ---------- */

type SearchFriendship =
  | { id: string; status: 'accepted' }
  | { id: string; status: 'pending_outgoing' }
  | { id: string; status: 'pending_incoming' }

interface SearchUser {
  id: string
  username: string
  avatarUrl?: string | null
  friendship?: SearchFriendship | null
}

interface FriendRequest {
  friendshipId: string
  from: {
    id: string
    username: string
    avatarUrl: string | null
  }
  createdAt: string
}

interface Friend {
  friendshipId: string
  user: {
    id: string
    username: string
    avatarUrl: string | null
    isOnline?: boolean
    lastSeenAt?: string | null
  }
}

interface OutgoingRequest {
  friendshipId: string
  to: {
    id: string
    username: string
    avatarUrl: string | null
  }
  createdAt: string
}

interface BlockedUser {
  id: string
  username: string
  avatarUrl: string | null
}

/* ---------- Helpers ---------- */

function formatLastSeen(iso: string | null | undefined, online: boolean): string {
  if (online) return 'Online'
  if (!iso) return 'Offline'
  try {
    const d = new Date(iso)
    const diffMs = Date.now() - d.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    const weeks = Math.floor(days / 7)
    if (weeks < 4) return `${weeks}w ago`
    return 'Long ago'
  } catch {
    return 'Offline'
  }
}

/* ---------- Constants ---------- */

const DEBOUNCE_MS = 400

/* ---------- Component ---------- */

export default function FriendsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Requests
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(true)

  // Outgoing requests (sent by me, still pending)
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([])

  // Friends
  const [friends, setFriends] = useState<Friend[]>([])
  const [friendsLoading, setFriendsLoading] = useState(true)

  // Blocked
  const [blocked, setBlocked] = useState<BlockedUser[]>([])
  const [blockedLoading, setBlockedLoading] = useState(true)
  const [pendingBlockActions, setPendingBlockActions] = useState<Set<string>>(new Set())

  // Per-row action lock (unfriend, cancel, accept, decline) so double-taps
  // don't fire the request twice.
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set())

  // Active DM chat (driven by social store so the toast tap-to-open flow
  // from other tabs can open the modal via setActiveDm).
  const setActiveDm = useSocialStore((s) => s.setActiveDm)
  const unreadCounts = useSocialStore((s) => s.unreadCounts)
  const unreadDmSenders = useSocialStore((s) => s.unreadDmSenders)

  /* ---------- Fetch data on mount ---------- */

  const fetchRequests = useCallback(async () => {
    try {
      const data = await api.get<{ requests: FriendRequest[] }>('/friends/requests')
      setRequests(data.requests)
    } catch {
      // silently fail
    } finally {
      setRequestsLoading(false)
    }
  }, [])

  const fetchFriends = useCallback(async () => {
    try {
      const data = await api.get<{ friends: Friend[] }>('/friends')
      setFriends(data.friends)
    } catch {
      // silently fail
    } finally {
      setFriendsLoading(false)
    }
  }, [])

  const fetchOutgoing = useCallback(async () => {
    try {
      const data = await api.get<{ requests: OutgoingRequest[] }>('/friends/requests/outgoing')
      setOutgoing(data?.requests ?? [])
    } catch {
      // silently fail
    }
  }, [])

  const fetchBlocked = useCallback(async () => {
    try {
      const data = await api.get<BlockedUser[]>('/users/blocked')
      setBlocked(Array.isArray(data) ? data : [])
    } catch {
      // silently fail
    } finally {
      setBlockedLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
    fetchFriends()
    fetchOutgoing()
  }, [fetchRequests, fetchFriends, fetchOutgoing])

  // Blocking happens on the profile screen, which lives in a different tab
  // stack. The friends tab stays mounted while you navigate there, so a plain
  // mount-time fetch leaves the blocked list stale when you come back. Refresh
  // every time the tab regains focus instead.
  useFocusEffect(
    useCallback(() => {
      fetchBlocked()
    }, [fetchBlocked]),
  )

  // Refresh presence + unread-affected data when the tab is re-focused so a
  // friend coming online while we're elsewhere shows up without pull-to-refresh.
  useEffect(() => {
    const iv = setInterval(() => {
      fetchFriends()
    }, 30000)
    return () => clearInterval(iv)
  }, [fetchFriends])

  /* ---------- Search ---------- */

  const handleSearch = useCallback(
    (text: string) => {
      setSearchQuery(text)
      if (debounceRef.current) clearTimeout(debounceRef.current)

      if (text.trim().length < 2) {
        setSearchResults([])
        setSearchLoading(false)
        return
      }

      setSearchLoading(true)
      debounceRef.current = setTimeout(async () => {
        try {
          const data = await api.get<{ users: SearchUser[] }>(
            `/users/search?q=${encodeURIComponent(text.trim())}`,
          )
          const list = Array.isArray(data) ? (data as unknown as SearchUser[]) : data.users
          setSearchResults((list ?? []).filter((u) => u.id !== user?.id))
        } catch {
          setSearchResults([])
        } finally {
          setSearchLoading(false)
        }
      }, DEBOUNCE_MS)
    },
    [user?.id],
  )

  const handleSendRequest = useCallback(
    async (toUserId: string, username: string) => {
      try {
        await api.post('/friends/request', { username })
        setSentRequests((prev) => new Set(prev).add(toUserId))
        // Keep outgoing section in sync so the request shows up immediately
        fetchOutgoing()
      } catch (err: any) {
        Alert.alert(t('common.error'), err.message)
      }
    },
    [t, fetchOutgoing],
  )

  const handleCancelOutgoing = useCallback(
    async (friendshipId: string) => {
      setPendingActions((p) => new Set(p).add(friendshipId))
      try {
        await api.delete(`/friends/${friendshipId}`)
        setOutgoing((prev) => prev.filter((r) => r.friendshipId !== friendshipId))
      } catch (err: any) {
        Alert.alert(t('common.error'), err?.message ?? 'Unable to cancel')
      } finally {
        setPendingActions((p) => {
          const next = new Set(p)
          next.delete(friendshipId)
          return next
        })
      }
    },
    [t],
  )

  const handleUnfriend = useCallback(
    (friendshipId: string, username: string) => {
      Alert.alert(
        'Remove friend?',
        `${username} will no longer see you as a friend.`,
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('friends.unfriend', 'Unfriend'),
            style: 'destructive',
            onPress: async () => {
              setPendingActions((p) => new Set(p).add(friendshipId))
              try {
                await api.delete(`/friends/${friendshipId}`)
                setFriends((prev) => prev.filter((f) => f.friendshipId !== friendshipId))
              } catch (err: any) {
                Alert.alert(t('common.error'), err?.message ?? 'Unable to remove')
              } finally {
                setPendingActions((p) => {
                  const next = new Set(p)
                  next.delete(friendshipId)
                  return next
                })
              }
            },
          },
        ],
      )
    },
    [t],
  )

  /* ---------- Friend request actions ---------- */

  const handleAccept = useCallback(
    async (id: string) => {
      try {
        await api.put(`/friends/${id}/accept`, {})
        setRequests((prev) => prev.filter((r) => r.friendshipId !== id))
        fetchFriends()
      } catch (err: any) {
        Alert.alert(t('common.error'), err.message)
      }
    },
    [fetchFriends, t],
  )

  const handleDecline = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/friends/${id}`)
        setRequests((prev) => prev.filter((r) => r.friendshipId !== id))
      } catch (err: any) {
        Alert.alert(t('common.error'), err.message)
      }
    },
    [t],
  )

  /* ---------- Friend actions ---------- */

  const handleDm = useCallback(
    (friendId: string, friendUsername: string) => {
      setActiveDm({ friendId, friendUsername })
    },
    [setActiveDm],
  )

  const handleUnblock = useCallback(async (userId: string) => {
    setPendingBlockActions((prev) => new Set(prev).add(userId))
    try {
      await api.delete(`/users/${userId}/block`)
      setBlocked((prev) => prev.filter((u) => u.id !== userId))
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message ?? 'Unable to unblock')
    } finally {
      setPendingBlockActions((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }, [t])

  const handleShareInvite = useCallback(async () => {
    const url = 'https://redhanded.game'
    const message = `Join me in Red Handed ! — the real-time social deduction game. Deceive. Detect. Dominate.\n${url}`
    try {
      await Share.share(
        { message, url, title: 'Red Handed !' },
        { dialogTitle: 'Invite friends to Red Handed !' },
      )
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message ?? 'Unable to share')
    }
  }, [t])

  /* ---------- Render helpers ---------- */

  const getInitial = (username: string) =>
    username.charAt(0).toUpperCase()

  const { isTablet, px, fontScale } = useResponsive()
  const contentStyle = isTablet ? { maxWidth: 700, alignSelf: 'center' as const, width: '100%' as const } : {}

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={contentStyle}>
        {/* Search Bar */}
        <View className="pt-3 pb-1" style={{ paddingHorizontal: px }}>
          <TextInput
            className="bg-neutral-900 text-white px-4 py-3 rounded-xl border border-neutral-800 text-sm"
            placeholder="Search players by username..."
            placeholderTextColor="#525252"
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
        </View>

        {/* Search Results */}
        {searchQuery.trim().length >= 2 && (
          <View className="mt-2" style={{ paddingHorizontal: px }}>
            {searchLoading ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#8b5cf6" />
              </View>
            ) : searchResults.length === 0 ? (
              <Text className="text-neutral-600 text-sm text-center py-3">
                No users found
              </Text>
            ) : (
              <View className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden">
                {searchResults.map((result, index) => {
                  const alreadySent = sentRequests.has(result.id)
                  const alreadyFriend = friends.some(
                    (f) => f.user.id === result.id,
                  )

                  return (
                    <View
                      key={result.id}
                      className={`flex-row items-center px-4 py-3 ${
                        index < searchResults.length - 1
                          ? 'border-b border-neutral-800'
                          : ''
                      }`}
                    >
                      <View className="w-8 h-8 rounded-full bg-neutral-800 items-center justify-center mr-3">
                        <Text className="text-white text-sm font-bold">
                          {getInitial(result.username)}
                        </Text>
                      </View>
                      <Text className="text-white text-sm font-semibold flex-1">
                        {result.username}
                      </Text>
                      {alreadyFriend || result.friendship?.status === 'accepted' ? (
                        <Text className="text-neutral-600 text-xs">
                          Already friends
                        </Text>
                      ) : result.friendship?.status === 'pending_outgoing' ? (
                        <Text className="text-neutral-600 text-xs">
                          Pending
                        </Text>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleSendRequest(result.id, result.username)}
                          disabled={alreadySent}
                          className={`px-3 py-1.5 rounded-lg ${
                            alreadySent
                              ? 'bg-neutral-800'
                              : 'bg-violet-600'
                          }`}
                          activeOpacity={0.8}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              alreadySent
                                ? 'text-neutral-500'
                                : 'text-white'
                            }`}
                          >
                            {alreadySent ? 'Sent' : 'Add Friend'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        )}

        {/* Friend Requests */}
        <View className="mt-5" style={{ paddingHorizontal: px }}>
          <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3 px-1">
            Friend Requests
          </Text>
          {requestsLoading ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#8b5cf6" />
            </View>
          ) : requests.length === 0 ? (
            <View className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-5 items-center">
              <Text className="text-neutral-600 text-sm">
                No pending requests
              </Text>
            </View>
          ) : (
            <View className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden">
              {requests.map((req, index) => {
                const fromUsername = req.from?.username ?? ''
                return (
                <View
                  key={req.friendshipId}
                  className={`flex-row items-center px-4 py-3 ${
                    index < requests.length - 1
                      ? 'border-b border-neutral-800'
                      : ''
                  }`}
                >
                  <View className="w-8 h-8 rounded-full bg-neutral-800 items-center justify-center mr-3">
                    <Text className="text-white text-sm font-bold">
                      {getInitial(fromUsername)}
                    </Text>
                  </View>
                  <Text className="text-white text-sm font-semibold flex-1">
                    {fromUsername}
                  </Text>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => handleAccept(req.friendshipId)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600"
                      activeOpacity={0.8}
                    >
                      <Text className="text-white text-xs font-semibold">
                        Accept
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDecline(req.friendshipId)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700"
                      activeOpacity={0.8}
                    >
                      <Text className="text-neutral-400 text-xs font-semibold">
                        Decline
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                )
              })}
            </View>
          )}
        </View>

        {/* Outgoing Requests */}
        {outgoing.length > 0 && (
          <View className="mt-5" style={{ paddingHorizontal: px }}>
            <View className="flex-row items-center mb-3 px-1">
              <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                {t('friends.sentRequests', 'Sent Requests')}
              </Text>
              <View className="ml-2 bg-neutral-700 rounded-full px-1.5 py-0.5">
                <Text className="text-neutral-300 text-[10px] font-bold">
                  {outgoing.length}
                </Text>
              </View>
            </View>
            <View className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden">
              {outgoing.map((req, index) => {
                const toUsername = req.to?.username ?? ''
                const pending = pendingActions.has(req.friendshipId)
                return (
                  <View
                    key={req.friendshipId}
                    className={`flex-row items-center px-4 py-3 ${
                      index < outgoing.length - 1
                        ? 'border-b border-neutral-800'
                        : ''
                    }`}
                  >
                    <View className="w-8 h-8 rounded-full bg-neutral-800 items-center justify-center mr-3">
                      <Text className="text-white text-sm font-bold">
                        {getInitial(toUsername)}
                      </Text>
                    </View>
                    <Text className="text-white text-sm font-semibold flex-1" numberOfLines={1}>
                      {toUsername}
                    </Text>
                    <Text className="text-neutral-500 text-xs mr-2">
                      {t('friends.requestPending', 'Pending')}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleCancelOutgoing(req.friendshipId)}
                      disabled={pending}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700"
                      activeOpacity={0.8}
                    >
                      <Text className="text-neutral-400 text-xs font-semibold">
                        {pending ? '…' : t('common.cancel', 'Cancel')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {/* Friends List */}
        <View className="mt-5" style={{ paddingHorizontal: px }}>
          <View className="flex-row items-center mb-3 px-1">
            <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              {t('nav.friends')}
            </Text>
            {friends.length > 0 && (
              <Text className="text-neutral-600 ml-2 text-xs">
                ({friends.filter((f) => f.user.isOnline).length}/{friends.length} online)
              </Text>
            )}
          </View>
          {friendsLoading ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#8b5cf6" />
            </View>
          ) : friends.length === 0 ? (
            <View className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-5 items-center">
              <Text className="text-4xl mb-3">👥</Text>
              <Text className="text-neutral-500 text-sm text-center">
                {t('lobby.noFriends')}
              </Text>
            </View>
          ) : (
            <View className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden">
              {friends.map((friend, index) => {
                const username = friend.user.username ?? ''
                const online = !!friend.user.isOnline
                const presenceLabel = formatLastSeen(friend.user.lastSeenAt, online)
                const unread = unreadCounts[friend.user.id] ?? 0
                const preview = unreadDmSenders[friend.user.id]
                const pending = pendingActions.has(friend.friendshipId)

                return (
                  <View
                    key={friend.friendshipId}
                    className={`flex-row items-center px-4 py-3 ${
                      index < friends.length - 1
                        ? 'border-b border-neutral-800'
                        : ''
                    }`}
                  >
                    <TouchableOpacity
                      onPress={() => router.push(`/profile/${friend.user.id}`)}
                      className="flex-row items-center flex-1 min-w-0"
                      activeOpacity={0.7}
                    >
                      <View className="relative mr-3">
                        <View className="w-11 h-11 rounded-full bg-violet-900/40 border border-violet-700/30 items-center justify-center">
                          <Text className="text-violet-400 text-base font-bold">
                            {getInitial(username)}
                          </Text>
                        </View>
                        {online && (
                          <View className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-neutral-900" />
                        )}
                        {unread > 0 && (
                          <View className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 border-2 border-neutral-900 items-center justify-center">
                            <Text className="text-white text-[10px] font-bold">
                              {unread > 9 ? '9+' : unread}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                          {username}
                        </Text>
                        {preview ? (
                          <Text
                            className="text-violet-300 text-xs mt-0.5 font-medium"
                            numberOfLines={1}
                          >
                            {preview.lastText}
                          </Text>
                        ) : (
                          <Text
                            className={[
                              'text-xs mt-0.5',
                              online ? 'text-emerald-400' : 'text-neutral-500',
                            ].join(' ')}
                            numberOfLines={1}
                          >
                            {presenceLabel}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDm(friend.user.id, username)}
                      className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/15 border border-violet-700/40 ml-2"
                      activeOpacity={0.8}
                    >
                      <Text className="text-violet-300 text-xs font-semibold">
                        {t('friends.message', 'Message')}
                      </Text>
                      {unread > 0 && (
                        <View className="bg-red-500 rounded-full min-w-[16px] h-[16px] px-1 items-center justify-center">
                          <Text className="text-white text-[10px] font-bold">
                            {unread > 9 ? '9+' : unread}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleUnfriend(friend.friendshipId, username)}
                      disabled={pending}
                      accessibilityLabel={t('friends.unfriend', 'Unfriend')}
                      className="w-8 h-8 rounded-full items-center justify-center ml-1"
                      activeOpacity={0.7}
                      hitSlop={6}
                    >
                      <Text className="text-neutral-600 text-lg leading-5">×</Text>
                    </TouchableOpacity>
                  </View>
                )
              })}
            </View>
          )}
        </View>

        {/* Blocked Players */}
        <View className="mt-5" style={{ paddingHorizontal: px }}>
          <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3 px-1">
            {t('friends.blocked', 'Blocked')}
            {blocked.length > 0 && (
              <Text className="text-neutral-600"> ({blocked.length})</Text>
            )}
          </Text>
          {blockedLoading ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#8b5cf6" />
            </View>
          ) : blocked.length === 0 ? (
            <View className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-5 items-center">
              <Text className="text-neutral-600 text-sm">
                {t('friends.noBlocked', 'No blocked players')}
              </Text>
            </View>
          ) : (
            <View className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden">
              {blocked.map((u, index) => {
                const username = u.username ?? ''
                const pending = pendingBlockActions.has(u.id)
                return (
                  <View
                    key={u.id}
                    className={`flex-row items-center px-4 py-3 ${
                      index < blocked.length - 1
                        ? 'border-b border-neutral-800'
                        : ''
                    }`}
                  >
                    <TouchableOpacity
                      onPress={() => router.push(`/profile/${u.id}`)}
                      className="flex-row items-center flex-1"
                      activeOpacity={0.7}
                    >
                      <View className="w-8 h-8 rounded-full bg-neutral-800 items-center justify-center mr-3">
                        <Text className="text-white text-sm font-bold">
                          {getInitial(username)}
                        </Text>
                      </View>
                      <Text className="text-white text-sm font-semibold flex-1">
                        {username}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleUnblock(u.id)}
                      disabled={pending}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700"
                      activeOpacity={0.8}
                    >
                      <Text className="text-neutral-400 text-xs font-semibold">
                        {t('friends.unblock', 'Unblock')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )
              })}
            </View>
          )}
        </View>

        {/* Share Section */}
        <View className="mt-6" style={{ paddingHorizontal: px }}>
          <TouchableOpacity
            onPress={handleShareInvite}
            className="flex-row items-center justify-center gap-2 py-4 rounded-2xl border border-neutral-800 bg-neutral-900"
            activeOpacity={0.7}
          >
            <Text className="text-lg">📤</Text>
            <Text className="text-violet-400 font-semibold text-sm">
              Share invite link
            </Text>
          </TouchableOpacity>
        </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
