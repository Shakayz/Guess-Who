import React, { useState, useEffect, useRef } from 'react'
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
  PanResponder,
  LayoutChangeEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import * as Notifications from 'expo-notifications'
import { useAuthStore } from '../store/auth'
import { api } from '../lib/api'
import i18n from '../i18n'
import { LANGUAGES } from '../i18n/languages'
import { SoundManager } from '../lib/sounds'
import { MusicManager } from '../lib/music'

type LangCode = (typeof LANGUAGES)[number]['code']

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

function VolumeSlider({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  const widthRef = useRef(0)
  const [pct, setPct] = useState(value)

  useEffect(() => {
    setPct(value)
  }, [value])

  const updateFromX = (x: number) => {
    const w = widthRef.current || 1
    const p = Math.max(0, Math.min(1, x / w))
    setPct(p)
    onChange(Math.round(p * 20) / 20)
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (e) => updateFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => updateFromX(e.nativeEvent.locationX),
    }),
  ).current

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width
  }

  return (
    <View style={{ opacity: disabled ? 0.5 : 1 }} className="pb-3">
      <View className="flex-row justify-between items-center mb-1.5">
        <Text className="text-xs font-medium text-neutral-400">{label}</Text>
        <Text className="text-xs text-neutral-500">{Math.round(pct * 100)}%</Text>
      </View>
      <View
        onLayout={onLayout}
        {...pan.panHandlers}
        className="h-8 justify-center"
      >
        <View className="h-1.5 rounded-full bg-neutral-700">
          <View
            className="h-1.5 rounded-full bg-violet-600"
            style={{ width: `${pct * 100}%` }}
          />
        </View>
        <View
          className="absolute h-4 w-4 rounded-full bg-white shadow"
          style={{
            left: `${pct * 100}%`,
            marginLeft: -8,
          }}
        />
      </View>
    </View>
  )
}

export default function SettingsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { clearAuth } = useAuthStore()

  const [soundEnabled, setSoundEnabled] = useState(true)
  const [soundVolume, setSoundVolume] = useState(1)
  const [musicEnabled, setMusicEnabled] = useState(true)
  const [musicVolume, setMusicVolume] = useState(0.4)
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
    SoundManager.init().then(() => {
      setSoundEnabled(SoundManager.isEnabled())
      setSoundVolume(SoundManager.getVolume())
    })
    MusicManager.init().then(() => {
      setMusicEnabled(MusicManager.isEnabled())
      setMusicVolume(MusicManager.getVolume())
    })
    Notifications.getPermissionsAsync().then(({ status }) => {
      setNotifEnabled(status === 'granted')
    })
  }, [])

  const handleSoundToggle = (value: boolean) => {
    setSoundEnabled(value)
    SoundManager.setEnabled(value)
  }

  const handleSoundVolume = (v: number) => {
    setSoundVolume(v)
    SoundManager.setVolume(v)
  }

  const handleMusicToggle = (value: boolean) => {
    setMusicEnabled(value)
    MusicManager.setEnabled(value)
    if (value) MusicManager.play()
  }

  const handleMusicVolume = (v: number) => {
    setMusicVolume(v)
    MusicManager.setVolume(v)
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
      setPwError(t('settings.passwordMinLengthError', 'New password must be at least 8 characters'))
      return
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError(t('settings.passwordMismatchError', 'New passwords do not match'))
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
      Alert.alert(t('common.success', 'Success'), t('settings.passwordChangedMessage', 'Your password has been changed.'))
    } catch (err: any) {
      setPwError(err.message ?? t('settings.passwordChangeFailed', 'Failed to change password'))
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
          <SectionHeader title={t('settings.soundSection', 'Sound')} />
          <SettingRow
            label={t('settings.soundEffects', 'Sound Effects')}
            subtitle={t('settings.soundEffectsDesc', 'Play sounds during the game')}
            right={
              <Switch
                value={soundEnabled}
                onValueChange={handleSoundToggle}
                trackColor={{ false: '#404040', true: '#7c3aed' }}
                thumbColor="#fff"
              />
            }
          />
          <VolumeSlider
            label={t('settings.soundVolume', 'Sound volume')}
            value={soundVolume}
            onChange={handleSoundVolume}
            disabled={!soundEnabled}
          />
        </View>

        {/* Music */}
        <View className="bg-neutral-900 border border-neutral-800 rounded-2xl px-4 mb-4">
          <SectionHeader title={t('settings.musicSection', 'Music')} />
          <SettingRow
            label={t('settings.backgroundMusic', 'Background Music')}
            subtitle={t('settings.backgroundMusicDesc', 'Looping track in menus and lobby')}
            right={
              <Switch
                value={musicEnabled}
                onValueChange={handleMusicToggle}
                trackColor={{ false: '#404040', true: '#7c3aed' }}
                thumbColor="#fff"
              />
            }
          />
          <VolumeSlider
            label={t('settings.musicVolume', 'Music volume')}
            value={musicVolume}
            onChange={handleMusicVolume}
            disabled={!musicEnabled}
          />
        </View>

        {/* Notifications */}
        <View className="bg-neutral-900 border border-neutral-800 rounded-2xl px-4 mb-4">
          <SectionHeader title={t('settings.notificationsSection', 'Notifications')} />
          <SettingRow
            label={t('settings.pushNotifications', 'Push Notifications')}
            subtitle={t('settings.pushNotificationsDesc', 'Get notified about game invites')}
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
          <SectionHeader title={t('settings.languageSection', 'Language')} />
          <TouchableOpacity
            onPress={() => setShowLangPicker((v) => !v)}
            className="flex-row items-center justify-between py-3"
          >
            <View>
              <Text className="text-sm font-semibold text-white">{t('settings.appLanguage', 'App Language')}</Text>
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
          <SectionHeader title={t('settings.accountSection', 'Account')} />

          {/* Change Password */}
          <TouchableOpacity
            onPress={() => {
              setShowPwForm((v) => !v)
              setPwError(null)
              setPwSuccess(false)
            }}
            className="flex-row items-center justify-between py-3 border-b border-neutral-800"
          >
            <Text className="text-sm font-semibold text-white">{t('settings.changePassword', 'Change Password')}</Text>
            <Text className="text-neutral-500 text-sm">{showPwForm ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showPwForm && (
            <View className="pt-3 pb-2 space-y-2">
              <TextInput
                secureTextEntry
                placeholder={t('settings.currentPasswordPlaceholder', 'Current password')}
                placeholderTextColor="#525252"
                value={pwForm.current}
                onChangeText={(v) => setPwForm((f) => ({ ...f, current: v }))}
                className="bg-neutral-800 text-white px-3 py-2.5 rounded-xl border border-neutral-700 text-sm mb-2"
              />
              <TextInput
                secureTextEntry
                placeholder={t('settings.newPasswordPlaceholder', 'New password')}
                placeholderTextColor="#525252"
                value={pwForm.next}
                onChangeText={(v) => setPwForm((f) => ({ ...f, next: v }))}
                className="bg-neutral-800 text-white px-3 py-2.5 rounded-xl border border-neutral-700 text-sm mb-2"
              />
              <TextInput
                secureTextEntry
                placeholder={t('settings.confirmPasswordPlaceholder', 'Confirm new password')}
                placeholderTextColor="#525252"
                value={pwForm.confirm}
                onChangeText={(v) => setPwForm((f) => ({ ...f, confirm: v }))}
                className="bg-neutral-800 text-white px-3 py-2.5 rounded-xl border border-neutral-700 text-sm mb-2"
              />
              {pwError && (
                <Text className="text-red-400 text-xs mb-1">{pwError}</Text>
              )}
              {pwSuccess && (
                <Text className="text-emerald-400 text-xs mb-1">{t('settings.passwordChangedSuccess', 'Password changed successfully.')}</Text>
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
                  <Text className="text-white font-semibold text-sm">{t('settings.updatePassword', 'Update Password')}</Text>
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
              <Text className="text-sm font-semibold text-red-400">{t('settings.deleteAccount', 'Delete Account')}</Text>
              <Text className="text-xs text-neutral-500 mt-0.5">{t('settings.deleteAccountDesc', 'Permanently delete all data')}</Text>
            </View>
            <Text className="text-neutral-600 text-sm">›</Text>
          </TouchableOpacity>
        </View>

        {/* Legal */}
        <View className="bg-neutral-900 border border-neutral-800 rounded-2xl px-4 mb-4">
          <SectionHeader title={t('settings.legalSection', 'Legal')} />
          <TouchableOpacity
            onPress={() => router.push('/terms')}
            className="flex-row items-center justify-between py-3 border-b border-neutral-800"
          >
            <Text className="text-sm font-semibold text-white">{t('settings.termsOfService', 'Terms of Service')}</Text>
            <Text className="text-neutral-500 text-sm">›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/privacy')}
            className="flex-row items-center justify-between py-3 border-b border-neutral-800"
          >
            <Text className="text-sm font-semibold text-white">{t('settings.privacyPolicy', 'Privacy Policy')}</Text>
            <Text className="text-neutral-500 text-sm">›</Text>
          </TouchableOpacity>
          <View className="flex-row items-center justify-between py-3">
            <Text className="text-sm text-neutral-500">{t('settings.appVersion', 'App Version')}</Text>
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
            <Text className="text-lg font-bold text-white mb-3">{t('settings.deleteAccount', 'Delete Account')}</Text>
            <Text className="text-sm text-neutral-400 mb-3 leading-5">
              {t('settings.deleteWarning', 'This action is permanent and irreversible. All your data including rank, coins, and game history will be deleted.')}
            </Text>
            <Text className="text-sm text-neutral-400 mb-3">
              {t('settings.deleteTypeToConfirm', 'Type DELETE to confirm.')}
            </Text>
            <TextInput
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder={t('settings.deletePlaceholder', 'Type DELETE to confirm')}
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
                <Text className="text-neutral-300 text-sm font-semibold">{t('common.cancel', 'Cancel')}</Text>
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
                  <Text className="text-white text-sm font-semibold">{t('settings.deleteAccount', 'Delete Account')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
