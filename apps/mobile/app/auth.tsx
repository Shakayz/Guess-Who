import React, { useState, useEffect } from 'react'
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
import * as AuthSession from 'expo-auth-session'
import * as Crypto from 'expo-crypto'
import { useAuthStore } from '../store/auth'
import { api } from '../lib/api'
import i18n from '../i18n'
import { useResponsive } from '../lib/responsive'
import { createLogger } from '../lib/logger'

const log = createLogger('auth-screen')

WebBrowser.maybeCompleteAuthSession()

// ─── Constants ───────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = '' // TODO: fill in your Google OAuth client ID

const LANGUAGES = ['en', 'fr', 'ar', 'es', 'it', 'pt', 'zh'] as const

const googleDiscovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Mode = 'signin' | 'signup'

interface GoogleVerifyResponse {
  token?: string
  user?: { id: string; username: string; email: string }
  setupToken?: string
}

// ─── AuthScreen ──────────────────────────────────────────────────────────────

export default function AuthScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const { isTablet, fontScale } = useResponsive()

  const [mode, setMode] = useState<Mode>('signin')
  const [form, setForm] = useState({ email: '', password: '', username: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Google OAuth username setup state
  const [setupToken, setSetupToken] = useState<string | null>(null)
  const [setupUsername, setSetupUsername] = useState('')

  // Language switcher state
  const [currentLangIndex, setCurrentLangIndex] = useState(
    LANGUAGES.indexOf(i18n.language as typeof LANGUAGES[number]) >= 0
      ? LANGUAGES.indexOf(i18n.language as typeof LANGUAGES[number])
      : 0,
  )

  // ─── Google OAuth ────────────────────────────────────────────────────────

  const [googleRequest, googleResponse, googlePromptAsync] =
    AuthSession.useAuthRequest(
      {
        clientId: GOOGLE_CLIENT_ID,
        scopes: ['openid', 'profile', 'email'],
        responseType: AuthSession.ResponseType.Token,
        usePKCE: false,
      },
      googleDiscovery,
    )

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const accessToken = googleResponse.params.access_token
      if (accessToken) {
        handleGoogleToken(accessToken)
      }
    } else if (googleResponse?.type === 'error') {
      setError(googleResponse.error?.message ?? 'Google sign-in failed')
      setLoading(false)
    } else if (googleResponse?.type === 'dismiss') {
      setLoading(false)
    }
  }, [googleResponse])

  const handleGoogleToken = async (accessToken: string) => {
    setError(null)
    setLoading(true)
    log.info('google oauth token received, verifying')
    try {
      const data = await api.post<GoogleVerifyResponse>(
        '/auth/google/verify',
        { accessToken },
      )

      if (data.setupToken) {
        // New user -- need to pick a username
        log.info('google oauth: username setup required')
        setSetupToken(data.setupToken)
        setLoading(false)
        return
      }

      if (data.token && data.user) {
        log.info('google oauth success', { userId: data.user.id })
        setAuth(data.token, data.user)
        router.replace('/')
      }
    } catch (err: any) {
      log.warn('google oauth failed', { error: err.message })
      setError(err.message ?? 'Google sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Google sign-in: configure GOOGLE_CLIENT_ID')
      return
    }
    setError(null)
    setLoading(true)
    await googlePromptAsync()
  }

  // ─── Username setup (for new Google OAuth users) ─────────────────────────

  const handleSetupUsername = async () => {
    if (!setupUsername.trim()) {
      setError('Please enter a username')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const data = await api.post<{ token: string; user: { id: string; username: string; email: string } }>(
        '/auth/setup-username',
        { setupToken, username: setupUsername.trim() },
      )
      setAuth(data.token, data.user)
      setSetupToken(null)
      setSetupUsername('')
      router.replace('/')
    } catch (err: any) {
      setError(err.message ?? 'Username setup failed')
    } finally {
      setLoading(false)
    }
  }

  // ─── Language switcher ───────────────────────────────────────────────────

  const cycleLanguage = () => {
    const nextIndex = (currentLangIndex + 1) % LANGUAGES.length
    setCurrentLangIndex(nextIndex)
    i18n.changeLanguage(LANGUAGES[nextIndex])
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const update = (field: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
  }

  // ─── Email / password ────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)
    log.info('auth attempt', { mode })
    try {
      const data = await api.post<{ token: string; user: { id: string; username: string; email: string } }>(
        mode === 'signin' ? '/auth/signin' : '/auth/signup',
        form,
      )
      log.info('auth success', { userId: data.user?.id, mode })
      setAuth(data.token, data.user)
      router.replace('/')
    } catch (err: any) {
      log.warn('auth failed', { mode, error: err.message })
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ─── Apple ───────────────────────────────────────────────────────────────

  const handleApple = async () => {
    setError(null)
    setLoading(true)
    log.info('apple oauth attempt')
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

  // ─── Username setup screen ──────────────────────────────────────────────

  if (setupToken) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-950">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View className="flex-1 items-center justify-center p-6">
            <View style={{ width: '100%', maxWidth: isTablet ? 480 : 380, alignSelf: 'center' }}>
              <View className="items-center mb-10">
                <View className="rounded-2xl bg-violet-700 items-center justify-center mb-5" style={{ width: isTablet ? 80 : 64, height: isTablet ? 80 : 64 }}>
                  <Text style={{ fontSize: isTablet ? 40 : 30 }}>🎭</Text>
                </View>
                <Text className="font-extrabold text-white tracking-tight" style={{ fontSize: isTablet ? 28 : 24 }}>
                  Choose a Username
                </Text>
                <Text className="text-neutral-500 text-sm mt-1.5">
                  Pick a display name for your account
                </Text>
              </View>

              <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
                <View className="mb-4">
                  <TextInput
                    className="bg-neutral-800 text-white px-4 py-3 rounded-xl border border-neutral-700"
                    placeholder="Username"
                    placeholderTextColor="#737373"
                    value={setupUsername}
                    onChangeText={setSetupUsername}
                    autoCapitalize="none"
                    autoComplete="username"
                    maxLength={20}
                    autoFocus
                  />
                </View>

                {error && (
                  <View className="flex-row items-center gap-2 px-3 py-2.5 rounded-xl bg-red-950 border border-red-800 mb-4">
                    <Text className="text-red-400 text-sm">⚠ {error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleSetupUsername}
                  disabled={loading || !setupUsername.trim()}
                  className={[
                    'py-3 rounded-xl items-center',
                    loading || !setupUsername.trim() ? 'bg-violet-800 opacity-60' : 'bg-violet-600',
                  ].join(' ')}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className="text-white font-semibold text-base">Continue</Text>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setSetupToken(null)
                  setSetupUsername('')
                  setError(null)
                }}
                className="mt-4 items-center"
              >
                <Text className="text-neutral-500 text-xs">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  // ─── Main auth screen ───────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-neutral-950">
      {/* Language switcher */}
      <View className="flex-row justify-end px-4 pt-2">
        <TouchableOpacity
          onPress={cycleLanguage}
          className="px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700"
          activeOpacity={0.7}
        >
          <Text className="text-white text-xs font-bold uppercase">
            {LANGUAGES[currentLangIndex].toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>

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
                  className="rounded-2xl bg-violet-700 items-center justify-center mb-5 overflow-hidden"
                  style={{ width: isTablet ? 80 : 64, height: isTablet ? 80 : 64 }}
                >
                  <View className="absolute top-0 left-0 right-0 h-1/2 bg-white/10 rounded-t-2xl" />
                  <Text style={{ fontSize: isTablet ? 40 : 30 }}>🎭</Text>
                </View>
                <Text className="font-extrabold text-white tracking-tight" style={{ fontSize: isTablet ? 36 : 30 }}>Imposter Game</Text>
                <View className="flex-row items-center gap-1.5 mt-2 px-3 py-1 rounded-full border border-violet-800/40 bg-violet-950/30">
                  <View className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                  <Text className="text-violet-400 font-semibold" style={{ fontSize: 12 * fontScale }}>Deceive. Detect. Dominate.</Text>
                </View>
              </View>

              {/* OAuth buttons */}
              <View className="gap-2.5 mb-5">
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={14}
                  style={{ width: '100%', height: 50 }}
                  onPress={handleApple}
                />
                <TouchableOpacity
                  onPress={handleGoogleSignIn}
                  disabled={loading}
                  className="flex-row items-center justify-center gap-2.5 rounded-xl bg-white border border-neutral-200 overflow-hidden"
                  activeOpacity={0.85}
                  style={{ height: 50 }}
                >
                  <View className="w-5 h-5 rounded-full bg-neutral-100 items-center justify-center">
                    <Text style={{ fontSize: 14, lineHeight: 18, fontWeight: '700', color: '#4285F4' }}>G</Text>
                  </View>
                  <Text className="text-neutral-900 font-semibold" style={{ fontSize: 15 * fontScale }}>Continue with Google</Text>
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <View className="flex-row items-center gap-3 mb-5">
                <View className="flex-1 h-px bg-neutral-800" />
                <Text className="text-neutral-600 text-xs font-medium uppercase tracking-widest">or</Text>
                <View className="flex-1 h-px bg-neutral-800" />
              </View>

              {/* Card */}
              <View className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden">
                {/* Top accent */}
                <View className="absolute top-0 left-0 right-0 h-0.5 bg-violet-700/60" />

                <View className="p-6">
                {/* Mode tabs */}
                <View className="flex-row rounded-xl bg-neutral-800/80 p-1 mb-6 border border-neutral-700/50">
                  {(['signin', 'signup'] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => switchMode(m)}
                      className={[
                        'flex-1 py-2 rounded-lg items-center',
                        mode === m ? 'bg-neutral-950 border border-neutral-700/60' : '',
                      ].join(' ')}
                    >
                      <Text className={[
                        'font-semibold',
                        mode === m ? 'text-white' : 'text-neutral-500',
                      ].join(' ')} style={{ fontSize: 13 * fontScale }}>
                        {m === 'signin' ? t('auth.signIn') : t('auth.signUp')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Username (signup only) */}
                {mode === 'signup' && (
                  <View className="mb-3">
                    <Text className="text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">{t('auth.username')}</Text>
                    <TextInput
                      className="bg-neutral-800 text-white px-4 rounded-xl border border-neutral-700/80"
                      style={{ paddingVertical: 13, fontSize: 15 * fontScale }}
                      placeholder={t('auth.username')}
                      placeholderTextColor="#525252"
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
                  <Text className="text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">{t('auth.email')}</Text>
                  <TextInput
                    className="bg-neutral-800 text-white px-4 rounded-xl border border-neutral-700/80"
                    style={{ paddingVertical: 13, fontSize: 15 * fontScale }}
                    placeholder={t('auth.email')}
                    placeholderTextColor="#525252"
                    value={form.email}
                    onChangeText={update('email')}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>

                {/* Password */}
                <View className="mb-5">
                  <Text className="text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">{t('auth.password')}</Text>
                  <TextInput
                    className="bg-neutral-800 text-white px-4 rounded-xl border border-neutral-700/80"
                    style={{ paddingVertical: 13, fontSize: 15 * fontScale }}
                    placeholder="••••••••"
                    placeholderTextColor="#525252"
                    value={form.password}
                    onChangeText={update('password')}
                    secureTextEntry
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  />
                </View>

                {/* Forgot password */}
                {mode === 'signin' && (
                  <TouchableOpacity
                    onPress={() => router.push('/forgot-password')}
                    className="items-end mb-2"
                  >
                    <Text className="text-violet-500 text-xs font-medium">
                      {t('auth.forgotPassword')}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Error */}
                {error && (
                  <View className="flex-row items-center gap-2 px-3 py-2.5 rounded-xl bg-red-950 border border-red-800 mb-4">
                    <Text className="text-red-400" style={{ fontSize: 13 * fontScale }}>⚠ {error}</Text>
                  </View>
                )}

                {/* Submit */}
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={loading}
                  className={[
                    'rounded-xl items-center overflow-hidden',
                    loading ? 'bg-violet-800 opacity-60' : 'bg-violet-600',
                  ].join(' ')}
                  activeOpacity={0.8}
                  style={{ paddingVertical: 14 }}
                >
                  <View className="absolute top-0 left-0 right-0 h-1/2 rounded-t-xl" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }} />
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className="text-white font-extrabold tracking-wide" style={{ fontSize: 15 * fontScale }}>
                      {mode === 'signin' ? t('auth.signIn') : t('auth.signUp')}
                    </Text>
                  )}
                </TouchableOpacity>
                </View>
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
