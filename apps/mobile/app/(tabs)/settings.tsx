import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import * as Notifications from 'expo-notifications'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuthStore } from '../../store/auth'
import { api } from '../../lib/api'
import i18n from '../../i18n'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'zh', label: '中文' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ru', label: 'Русский' },
  { code: 'hi', label: 'हिन्दी' },
] as const

type LangCode = typeof LANGUAGES[number]['code']

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3 px-1">
      {title}
    </Text>
  )
}

function SettingRow({
  label,
  subtitle,
  right,
}: {
  label: string
  subtitle?: string
  right: React.ReactNode
}) {
  return (
    <View className="flex-row items-center justify-between py-3">
      <View className="flex-1 pr-4">
        <Text className="text-sm font-semibold text-white">{label}</Text>
        {subtitle && <Text className="text-xs text-neutral-500 mt-0.5">{subtitle}</Text>}
      </View>
      {right}
    </View>
  )
}

export default function SettingsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { clearAuth } = useAuthStore()

  const [soundEnabled, setSoundEnabled] = useState(true)
  const [notifEnabled, setNotifEnabled] = useState(false)
  const [currentLang, setCurrentLang] = useState<LangCode>(
    (i18n.language?.split('-')[0] as LangCode) ?? 'en'
  )
  const [showLangPicker, setShowLangPicker] = useState(false)

  // Change password form
  const [showPwForm, setShowPwForm] = useState(false)
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  // Delete account modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    AsyncStorage.getItem('sound_enabled').then((val) => {
      if (val !== null) setSoundEnabled(val !== 'false')
    })
    Notifications.getPermissionsAsync().then(({ status }) => {
      setNotifEnabled(status === 'granted')
    })
  }, [])

  const handleSoundToggle = (value: boolean) => {
    setSoundEnabled(value)
    AsyncStorage.setItem('sound_enabled', String(value))
  }

  const handleNotifToggle = async (value: boolean) => {
    if (value) {
      const { status } = await Notifications.requestPermissionsAsync()
      setNotifEnabled(status === 'granted')
    } else {
      setNotifEnabled(false)
    }
  }

  const handleLangSelect = (code: LangCode) => {
    setCurrentLang(code)
    i18n.changeLanguage(code)
    setShowLangPicker(false)
  }

  const handleChangePassword = async () => {
    setPwError(null)
    if (pwForm.next.length < 8) {
      setPwError('New password must be at least 8 characters')
      return
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError('New passwords do not match')
      return
    }
    setPwLoading(true)
    try {
      await api.put('/users/me/password', {
        currentPassword: pwForm.current,
        newPassword: pwForm.next,
      })
      setPwSuccess(true)
      setPwForm({ current: '', next: '', confirm: '' })
      setShowPwForm(false)
      Alert.alert('Success', 'Your password has been changed.')
    } catch (err: any) {
      setPwError(err.message ?? 'Failed to change password')
    } finally {
      setPwLoading(false)
    }
  }

  const openDeleteModal = () => {
    setDeleteConfirmText('')
    setDeleteError(null)
    setShowDeleteModal(true)
  }

  const closeDeleteModal = () => {
    if (deleteLoading) return
    setShowDeleteModal(false)
    setDeleteConfirmText('')
    setDeleteError(null)
  }

  const handleConfirmDelete = async () => {
    if (deleteConfirmText !== 'DELETE') return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      await api.delete('/users/me')
      clearAuth()
      router.replace('/auth')
    } catch (err: any) {
      setDeleteError(err.message ?? 'Failed to delete account')
    } finally {
      setDeleteLoading(false)
    }
  }

  const currentLangLabel = LANGUAGES.find((l) => l.code === currentLang)?.label ?? 'English'

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Sound */}
        <View className="bg-neutral-900 border border-neutral-800 rounded-2xl px-4 mb-4">
          <SectionHeader title="Sound" />
          <SettingRow
            label="Sound Effects"
            subtitle="Play sounds during the game"
            right={
              <Switch
                value={soundEnabled}
                onValueChange={handleSoundToggle}
                trackColor={{ false: '#404040', true: '#7c3aed' }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* Notifications */}
        <View className="bg-neutral-900 border border-neutral-800 rounded-2xl px-4 mb-4">
          <SectionHeader title="Notifications" />
          <SettingRow
            label="Push Notifications"
            subtitle="Get notified about game invites"
            right={
              <Switch
                value={notifEnabled}
                onValueChange={handleNotifToggle}
                trackColor={{ false: '#404040', true: '#7c3aed' }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* Language */}
        <View className="bg-neutral-900 border border-neutral-800 rounded-2xl px-4 mb-4">
          <SectionHeader title="Language" />
          <TouchableOpacity
            onPress={() => setShowLangPicker((v) => !v)}
            className="flex-row items-center justify-between py-3"
          >
            <View>
              <Text className="text-sm font-semibold text-white">App Language</Text>
              <Text className="text-xs text-neutral-500 mt-0.5">{currentLangLabel}</Text>
            </View>
            <Text className="text-neutral-500 text-sm">{showLangPicker ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showLangPicker && (
            <View className="border-t border-neutral-800 pt-2 pb-1">
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  onPress={() => handleLangSelect(lang.code)}
                  className={[
                    'flex-row items-center justify-between py-2.5 px-1',
                    lang.code === currentLang ? 'opacity-100' : 'opacity-70',
                  ].join(' ')}
                >
                  <Text
                    className={[
                      'text-sm font-medium',
                      lang.code === currentLang ? 'text-violet-400' : 'text-white',
                    ].join(' ')}
                  >
                    {lang.label}
                  </Text>
                  {lang.code === currentLang && (
                    <Text className="text-violet-400 text-sm">✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Account */}
        <View className="bg-neutral-900 border border-neutral-800 rounded-2xl px-4 mb-4">
          <SectionHeader title="Account" />

          {/* Change Password */}
          <TouchableOpacity
            onPress={() => {
              setShowPwForm((v) => !v)
              setPwError(null)
              setPwSuccess(false)
            }}
            className="flex-row items-center justify-between py-3 border-b border-neutral-800"
          >
            <Text className="text-sm font-semibold text-white">Change Password</Text>
            <Text className="text-neutral-500 text-sm">{showPwForm ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showPwForm && (
            <View className="pt-3 pb-2 space-y-2">
              <TextInput
                secureTextEntry
                placeholder="Current password"
                placeholderTextColor="#525252"
                value={pwForm.current}
                onChangeText={(v) => setPwForm((f) => ({ ...f, current: v }))}
                className="bg-neutral-800 text-white px-3 py-2.5 rounded-xl border border-neutral-700 text-sm mb-2"
              />
              <TextInput
                secureTextEntry
                placeholder="New password"
                placeholderTextColor="#525252"
                value={pwForm.next}
                onChangeText={(v) => setPwForm((f) => ({ ...f, next: v }))}
                className="bg-neutral-800 text-white px-3 py-2.5 rounded-xl border border-neutral-700 text-sm mb-2"
              />
              <TextInput
                secureTextEntry
                placeholder="Confirm new password"
                placeholderTextColor="#525252"
                value={pwForm.confirm}
                onChangeText={(v) => setPwForm((f) => ({ ...f, confirm: v }))}
                className="bg-neutral-800 text-white px-3 py-2.5 rounded-xl border border-neutral-700 text-sm mb-2"
              />
              {pwError && (
                <Text className="text-red-400 text-xs mb-1">{pwError}</Text>
              )}
              {pwSuccess && (
                <Text className="text-emerald-400 text-xs mb-1">Password changed successfully.</Text>
              )}
              <TouchableOpacity
                onPress={handleChangePassword}
                disabled={pwLoading}
                className="bg-violet-600 rounded-xl py-2.5 items-center mt-1"
                style={{ opacity: pwLoading ? 0.5 : 1 }}
              >
                {pwLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-semibold text-sm">Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Delete Account */}
          <TouchableOpacity
            onPress={openDeleteModal}
            className="flex-row items-center justify-between py-3 mt-1"
          >
            <View>
              <Text className="text-sm font-semibold text-red-400">Delete Account</Text>
              <Text className="text-xs text-neutral-500 mt-0.5">Permanently delete all data</Text>
            </View>
            <Text className="text-neutral-600 text-sm">›</Text>
          </TouchableOpacity>
        </View>

        {/* Legal */}
        <View className="bg-neutral-900 border border-neutral-800 rounded-2xl px-4 mb-4">
          <SectionHeader title="Legal" />
          <TouchableOpacity
            onPress={() => router.push('/terms')}
            className="flex-row items-center justify-between py-3 border-b border-neutral-800"
          >
            <Text className="text-sm font-semibold text-white">Terms of Service</Text>
            <Text className="text-neutral-500 text-sm">›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/privacy')}
            className="flex-row items-center justify-between py-3 border-b border-neutral-800"
          >
            <Text className="text-sm font-semibold text-white">Privacy Policy</Text>
            <Text className="text-neutral-500 text-sm">›</Text>
          </TouchableOpacity>
          <View className="flex-row items-center justify-between py-3">
            <Text className="text-sm text-neutral-500">App Version</Text>
            <Text className="text-xs text-neutral-600 font-mono">1.0.0</Text>
          </View>
        </View>
      </ScrollView>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
        statusBarTranslucent
      >
        <View className="flex-1 bg-black/70 items-center justify-center px-4">
          <View className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full" style={{ maxWidth: 400 }}>
            <Text className="text-lg font-bold text-white mb-3">Delete Account</Text>
            <Text className="text-sm text-neutral-400 mb-3 leading-5">
              This action is{' '}
              <Text className="text-red-400 font-semibold">permanent and irreversible</Text>. All your data
              including rank, coins, and game history will be deleted.
            </Text>
            <Text className="text-sm text-neutral-400 mb-3">
              Type <Text className="font-mono text-white">DELETE</Text> to confirm.
            </Text>
            <TextInput
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Type DELETE to confirm"
              placeholderTextColor="#525252"
              autoCapitalize="characters"
              autoCorrect={false}
              className="bg-neutral-800 border border-neutral-700 text-white px-3 py-2.5 rounded-xl text-sm mb-3"
            />
            {deleteError && (
              <Text className="text-red-400 text-xs mb-2">{deleteError}</Text>
            )}
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={closeDeleteModal}
                disabled={deleteLoading}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 items-center"
                activeOpacity={0.7}
              >
                <Text className="text-neutral-300 text-sm font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmDelete}
                disabled={deleteConfirmText !== 'DELETE' || deleteLoading}
                className="flex-1 py-2.5 rounded-xl bg-red-700 items-center"
                style={{ opacity: deleteConfirmText !== 'DELETE' || deleteLoading ? 0.4 : 1 }}
                activeOpacity={0.8}
              >
                {deleteLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white text-sm font-semibold">Delete Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
