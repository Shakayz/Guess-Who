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
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { useResponsive } from '../lib/responsive'
import { createLogger } from '../lib/logger'

const log = createLogger('forgot-password')

export default function ForgotPasswordScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { isTablet, fontScale } = useResponsive()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)
    log.info('forgot-password attempt', { email })
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
      log.info('forgot-password: reset email requested')
    } catch (err: any) {
      log.warn('forgot-password failed', { error: err.message })
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
                  {t('auth.forgotPassword')}
                </Text>
                <Text className="text-neutral-500 text-sm mt-1.5 text-center px-4">
                  {t('auth.forgotPasswordDesc')}
                </Text>
              </View>

              {/* Card */}
              <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
                {sent ? (
                  <View className="items-center py-4">
                    <View className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-800 items-center justify-center mb-4">
                      <Text style={{ fontSize: 20 }}>✓</Text>
                    </View>
                    <Text className="text-emerald-400 text-sm font-medium text-center">
                      {t('auth.resetLinkSent')}
                    </Text>
                  </View>
                ) : (
                  <View>
                    <View className="mb-4">
                      <Text className="text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">
                        {t('auth.email')}
                      </Text>
                      <TextInput
                        className="bg-neutral-800 text-white px-4 rounded-xl border border-neutral-700/80"
                        style={{ paddingVertical: 13, fontSize: 15 * fontScale }}
                        placeholder={t('auth.email')}
                        placeholderTextColor="#525252"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        autoFocus
                      />
                    </View>

                    {error && (
                      <View className="flex-row items-center gap-2 px-3 py-2.5 rounded-xl bg-red-950 border border-red-800 mb-4">
                        <Text className="text-red-400" style={{ fontSize: 13 * fontScale }}>⚠ {error}</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={handleSubmit}
                      disabled={loading || !email.trim()}
                      className={[
                        'rounded-xl items-center overflow-hidden',
                        loading || !email.trim() ? 'bg-violet-800 opacity-60' : 'bg-violet-600',
                      ].join(' ')}
                      activeOpacity={0.8}
                      style={{ paddingVertical: 14 }}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text className="text-white font-extrabold tracking-wide" style={{ fontSize: 15 * fontScale }}>
                          {t('auth.sendResetLink')}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Back to login */}
              <TouchableOpacity
                onPress={() => router.back()}
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
