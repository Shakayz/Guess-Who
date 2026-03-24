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
import * as AppleAuthentication from 'expo-apple-authentication'
import * as WebBrowser from 'expo-web-browser'
import { useAuthStore } from '../store/auth'
import { api } from '../lib/api'

WebBrowser.maybeCompleteAuthSession()

type Mode = 'signin' | 'signup'

export default function AuthScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [mode, setMode] = useState<Mode>('signin')
  const [form, setForm] = useState({ email: '', password: '', username: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const update = (field: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
  }

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await api.post<{ token: string; user: { id: string; username: string; email: string } }>(
        mode === 'signin' ? '/auth/signin' : '/auth/signup',
        form,
      )
      setAuth(data.token, data.user)
      router.replace('/')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApple = async () => {
    setError(null)
    setLoading(true)
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      })
      const name = credential.fullName
        ? `${credential.fullName.givenName ?? ''} ${credential.fullName.familyName ?? ''}`.trim()
        : undefined
      const data = await api.post<{ token: string; user: { id: string; username: string; email: string } }>(
        '/auth/apple/verify',
        { identityToken: credential.identityToken, name },
      )
      setAuth(data.token, data.user)
      router.replace('/')
    } catch (err: any) {
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        setError(err.message ?? 'Apple sign-in failed')
      }
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
            <View className="w-full max-w-sm">

              {/* Logo */}
              <View className="items-center mb-10">
                <View className="w-16 h-16 rounded-2xl bg-violet-700 items-center justify-center mb-5">
                  <Text className="text-3xl">🎭</Text>
                </View>
                <Text className="text-3xl font-extrabold text-white tracking-tight">Imposter Game</Text>
                <Text className="text-neutral-500 text-sm mt-1.5">Deceive. Detect. Dominate.</Text>
              </View>

              {/* OAuth buttons */}
              <View className="gap-3 mb-5">
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={12}
                  style={{ width: '100%', height: 48 }}
                  onPress={handleApple}
                />
                <TouchableOpacity
                  onPress={() => setError('Google sign-in: configure VITE_GOOGLE_CLIENT_ID')}
                  className="flex-row items-center justify-center gap-3 py-3 rounded-xl bg-white border border-neutral-200"
                  activeOpacity={0.8}
                >
                  <Text className="text-2xl">G</Text>
                  <Text className="text-neutral-900 font-semibold text-sm">Continue with Google</Text>
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <View className="flex-row items-center gap-3 mb-5">
                <View className="flex-1 h-px bg-neutral-800" />
                <Text className="text-neutral-600 text-xs font-medium">or</Text>
                <View className="flex-1 h-px bg-neutral-800" />
              </View>

              {/* Card */}
              <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

                {/* Mode tabs */}
                <View className="flex-row rounded-xl bg-neutral-800 p-1 mb-6">
                  {(['signin', 'signup'] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => switchMode(m)}
                      className={[
                        'flex-1 py-2 rounded-lg items-center',
                        mode === m ? 'bg-neutral-950' : '',
                      ].join(' ')}
                    >
                      <Text className={[
                        'text-sm font-semibold',
                        mode === m ? 'text-white' : 'text-neutral-500',
                      ].join(' ')}>
                        {m === 'signin' ? t('auth.signIn') : t('auth.signUp')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Username (signup only) */}
                {mode === 'signup' && (
                  <View className="mb-3">
                    <TextInput
                      className="bg-neutral-800 text-white px-4 py-3 rounded-xl border border-neutral-700"
                      placeholder={t('auth.username')}
                      placeholderTextColor="#737373"
                      value={form.username}
                      onChangeText={update('username')}
                      autoCapitalize="none"
                      autoComplete="username"
                      maxLength={20}
                    />
                  </View>
                )}

                {/* Email */}
                <View className="mb-3">
                  <TextInput
                    className="bg-neutral-800 text-white px-4 py-3 rounded-xl border border-neutral-700"
                    placeholder={t('auth.email')}
                    placeholderTextColor="#737373"
                    value={form.email}
                    onChangeText={update('email')}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>

                {/* Password */}
                <View className="mb-4">
                  <TextInput
                    className="bg-neutral-800 text-white px-4 py-3 rounded-xl border border-neutral-700"
                    placeholder={t('auth.password')}
                    placeholderTextColor="#737373"
                    value={form.password}
                    onChangeText={update('password')}
                    secureTextEntry
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  />
                </View>

                {/* Error */}
                {error && (
                  <View className="flex-row items-center gap-2 px-3 py-2.5 rounded-xl bg-red-950 border border-red-800 mb-4">
                    <Text className="text-red-400 text-sm">⚠ {error}</Text>
                  </View>
                )}

                {/* Submit */}
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={loading}
                  className={[
                    'py-3 rounded-xl items-center',
                    loading ? 'bg-violet-800 opacity-60' : 'bg-violet-600',
                  ].join(' ')}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className="text-white font-semibold text-base">
                      {mode === 'signin' ? t('auth.signIn') : t('auth.signUp')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Footer hint */}
              <View className="flex-row justify-center mt-6">
                <Text className="text-neutral-600 text-xs">
                  {mode === 'signin' ? t('auth.noAccount') : t('auth.alreadyHaveAccount')}{' '}
                </Text>
                <TouchableOpacity onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
                  <Text className="text-violet-500 text-xs font-medium">
                    {mode === 'signin' ? t('auth.signUp') : t('auth.signIn')}
                  </Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
