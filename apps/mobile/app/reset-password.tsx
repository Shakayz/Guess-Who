import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { useResponsive } from '../lib/responsive'
import { createLogger } from '../lib/logger'

const log = createLogger('reset-password')

export default function ResetPasswordScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { token } = useLocalSearchParams<{ token: string }>()
  const { isTablet, fontScale } = useResponsive()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    log.info('reset-password attempt')
    try {
      await api.post('/auth/reset-password', { token, password })
      setSuccess(true)
      log.info('reset-password success')
      setTimeout(() => router.replace('/auth'), 3000)
    } catch (err: any) {
      log.warn('reset-password failed', { error: err.message })
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-950">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 items-center justify-center p-6">
            <View style={{ width: '100%', maxWidth: isTablet ? 480 : 380, alignSelf: 'center' }}>
              {/* Logo */}
              <View className="items-center mb-10">
                <View
                  className="rounded-2xl bg-violet-700 items-center justify-center mb-5"
                  style={{ width: isTablet ? 80 : 64, height: isTablet ? 80 : 64 }}
                >
                  <Text style={{ fontSize: isTablet ? 40 : 30 }}>🎭</Text>
                </View>
                <Text className="font-extrabold text-white tracking-tight" style={{ fontSize: isTablet ? 28 : 24 }}>
                  {t('auth.resetPassword')}
                </Text>
              </View>

              {/* Card */}
              <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
                {success ? (
                  <View className="items-center py-4">
                    <View className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-800 items-center justify-center mb-4">
                      <Text style={{ fontSize: 20 }}>✓</Text>
                    </View>
                    <Text className="text-emerald-400 text-sm font-medium text-center">
                      {t('auth.passwordReset')}
                    </Text>
                  </View>
                ) : (
                  <View>
                    <View className="mb-3">
                      <Text className="text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">
                        {t('auth.newPassword')}
                      </Text>
                      <TextInput
                        className="bg-neutral-800 text-white px-4 rounded-xl border border-neutral-700/80"
                        style={{ paddingVertical: 13, fontSize: 15 * fontScale }}
                        placeholder="••••••••"
                        placeholderTextColor="#525252"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoComplete="new-password"
                        autoFocus
                      />
                    </View>

                    <View className="mb-5">
                      <Text className="text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">
                        {t('auth.confirmPassword')}
                      </Text>
                      <TextInput
                        className="bg-neutral-800 text-white px-4 rounded-xl border border-neutral-700/80"
                        style={{ paddingVertical: 13, fontSize: 15 * fontScale }}
                        placeholder="••••••••"
                        placeholderTextColor="#525252"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        autoComplete="new-password"
                      />
                    </View>

                    {error && (
                      <View className="flex-row items-center gap-2 px-3 py-2.5 rounded-xl bg-red-950 border border-red-800 mb-4">
                        <Text className="text-red-400" style={{ fontSize: 13 * fontScale }}>⚠ {error}</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={handleSubmit}
                      disabled={loading || !token || !password.trim()}
                      className={[
                        'rounded-xl items-center overflow-hidden',
                        loading || !token || !password.trim() ? 'bg-violet-800 opacity-60' : 'bg-violet-600',
                      ].join(' ')}
                      activeOpacity={0.8}
                      style={{ paddingVertical: 14 }}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text className="text-white font-extrabold tracking-wide" style={{ fontSize: 15 * fontScale }}>
                          {t('auth.resetPassword')}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Back to login */}
              <TouchableOpacity
                onPress={() => router.replace('/auth')}
                className="mt-6 items-center"
              >
                <Text className="text-violet-500 text-xs font-medium">
                  {t('auth.backToLogin')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
