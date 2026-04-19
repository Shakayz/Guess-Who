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
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { getSocket } from '../../lib/socket'
import { useAuthStore } from '../../store/auth'
import { useSocialStore } from '../../store/social'
import { useResponsive } from '../../lib/responsive'
import DmChatModal from '../../components/DmChatModal'

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
  id: string
  fromId: string
  fromUsername: string
}

interface Friend {
  id: string
  friendId: string
  friendUsername: string
  friendAvatarUrl: string | null
}

/* ---------- Constants ---------- */

const DEBOUNCE_MS = 400

/* ---------- Component ---------- */

export default function FriendsScreen() {
  const { t } = useTranslation()
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

  // Friends
  const [friends, setFriends] = useState<Friend[]>([])
  const [friendsLoading, setFriendsLoading] = useState(true)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())

  // Active DM chat
  const [activeDm, setActiveDm] = useState<{ id: string; username: string } | null>(null)

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

  useEffect(() => {
    fetchRequests()
    fetchFriends()
  }, [fetchRequests, fetchFriends])

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
      } catch (err: any) {
        Alert.alert(t('common.error'), err.message)
      }
    },
    [t],
  )

  /* ---------- Friend request actions ---------- */

  const handleAccept = useCallback(
    async (id: string) => {
      try {
        await api.put(`/friends/${id}/accept`, {})
        setRequests((prev) => prev.filter((r) => r.id !== id))
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
        setRequests((prev) => prev.filter((r) => r.id !== id))
      } catch (err: any) {
        Alert.alert(t('common.error'), err.message)
      }
    },
    [t],
  )

  /* ---------- Friend actions ---------- */

  const handleInvite = useCallback((friendId: string) => {
    const socket = getSocket()
    socket.emit('room:invite', { toUserId: friendId })
    setInvitedIds((prev) => new Set(prev).add(friendId))
  }, [])

  const handleDm = useCallback(
    (friendId: string, friendUsername: string) => {
      setActiveDm({ id: friendId, username: friendUsername })
    },
    [],
  )

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
                    (f) => f.friendId === result.id,
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
              {requests.map((req, index) => (
                <View
                  key={req.id}
                  className={`flex-row items-center px-4 py-3 ${
                    index < requests.length - 1
                      ? 'border-b border-neutral-800'
                      : ''
                  }`}
                >
                  <View className="w-8 h-8 rounded-full bg-neutral-800 items-center justify-center mr-3">
                    <Text className="text-white text-sm font-bold">
                      {getInitial(req.fromUsername)}
                    </Text>
                  </View>
                  <Text className="text-white text-sm font-semibold flex-1">
                    {req.fromUsername}
                  </Text>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => handleAccept(req.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600"
                      activeOpacity={0.8}
                    >
                      <Text className="text-white text-xs font-semibold">
                        Accept
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDecline(req.id)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700"
                      activeOpacity={0.8}
                    >
                      <Text className="text-neutral-400 text-xs font-semibold">
                        Decline
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Friends List */}
        <View className="mt-5" style={{ paddingHorizontal: px }}>
          <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3 px-1">
            {t('nav.friends')}
          </Text>
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
                const invited = invitedIds.has(friend.friendId)

                return (
                  <View
                    key={friend.id}
                    className={`flex-row items-center px-4 py-3 ${
                      index < friends.length - 1
                        ? 'border-b border-neutral-800'
                        : ''
                    }`}
                  >
                    <View className="w-10 h-10 rounded-full bg-violet-900/40 border border-violet-700/30 items-center justify-center mr-3">
                      <Text className="text-violet-400 text-base font-bold">
                        {getInitial(friend.friendUsername)}
                      </Text>
                    </View>
                    <Text className="text-white text-sm font-semibold flex-1">
                      {friend.friendUsername}
                    </Text>
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => handleInvite(friend.friendId)}
                        disabled={invited}
                        className={`px-3 py-1.5 rounded-lg ${
                          invited ? 'bg-neutral-800' : 'bg-violet-600'
                        }`}
                        activeOpacity={0.8}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            invited ? 'text-neutral-500' : 'text-white'
                          }`}
                        >
                          {invited
                            ? t('lobby.invited')
                            : t('lobby.invite')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          handleDm(friend.friendId, friend.friendUsername)
                        }
                        className="px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700"
                        activeOpacity={0.8}
                      >
                        <Text className="text-neutral-400 text-xs font-semibold">
                          DM
                        </Text>
                      </TouchableOpacity>
                    </View>
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

      {activeDm && (
        <DmChatModal
          visible={!!activeDm}
          friendId={activeDm.id}
          friendUsername={activeDm.username}
          onClose={() => setActiveDm(null)}
        />
      )}
    </SafeAreaView>
  )
}
