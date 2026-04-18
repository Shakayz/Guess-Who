import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EMAIL_VERIFICATION_REWARD, EMAIL_VERIFICATION_CODE_TTL_MINUTES } from '@red-handed/shared'
import { NavBar } from '../components/NavBar'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth'

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

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={[
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-neutral-950',
        enabled ? 'bg-brand-600' : 'bg-neutral-700',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          enabled ? 'translate-x-6' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3 px-1">
      {title}
    </p>
  )
}

type MeResponse = { email?: string; emailVerified?: boolean; starCoins?: number }

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const queryClient = useQueryClient()

  // Email verification state
  const [codeInput, setCodeInput] = useState('')
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null)
  const [codeRequested, setCodeRequested] = useState(false)

  const meQuery = useQuery<MeResponse>({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<MeResponse>('/auth/me'),
  })
  const emailVerified = meQuery.data?.emailVerified ?? true

  const sendCodeMutation = useMutation({
    mutationFn: () => api.post<{ success?: boolean; alreadyVerified?: boolean }>('/auth/email/send-code', {}),
    onSuccess: (res) => {
      setVerifyError(null)
      if (res.alreadyVerified) {
        setVerifyMessage('Your email is already verified.')
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
        return
      }
      setCodeRequested(true)
      setVerifyMessage(`Code sent. Check your inbox — it expires in ${EMAIL_VERIFICATION_CODE_TTL_MINUTES} minutes.`)
    },
    onError: (err: any) => {
      setVerifyMessage(null)
      setVerifyError(err.message ?? 'Could not send code. Please try again.')
    },
  })

  const verifyCodeMutation = useMutation({
    mutationFn: (code: string) =>
      api.post<{ success?: boolean; reward?: number; alreadyVerified?: boolean; starCoins?: number }>(
        '/auth/email/verify-code',
        { code },
      ),
    onSuccess: (res) => {
      setVerifyError(null)
      setCodeInput('')
      setCodeRequested(false)
      if (res.alreadyVerified) {
        setVerifyMessage('Email already verified.')
      } else {
        setVerifyMessage(`Email verified! +${res.reward ?? EMAIL_VERIFICATION_REWARD} ⭐ credited.`)
      }
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
    onError: (err: any) => {
      setVerifyMessage(null)
      setVerifyError(err.message ?? 'Verification failed.')
    },
  })

  // Sound
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('sound_enabled') !== 'false'
  })

  // Notifications
  const [notifEnabled, setNotifEnabled] = useState(() => {
    return Notification.permission === 'granted'
  })

  // Change password form
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  // Delete account modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  // Contact support
  const [supportForm, setSupportForm] = useState({ subject: '', message: '' })
  const [supportError, setSupportError] = useState<string | null>(null)
  const [supportSuccess, setSupportSuccess] = useState(false)

  const contactSupportMutation = useMutation({
    mutationFn: (data: { subject: string; message: string }) =>
      api.post<{ success: boolean }>('/support/contact', data),
    onSuccess: () => {
      setSupportSuccess(true)
      setSupportError(null)
      setSupportForm({ subject: '', message: '' })
      setTimeout(() => setSupportSuccess(false), 5000)
    },
    onError: (err: any) => {
      setSupportSuccess(false)
      setSupportError(err.message ?? 'Failed to send message')
    },
  })

  const handleContactSupport = (e: React.FormEvent) => {
    e.preventDefault()
    setSupportError(null)
    const subject = supportForm.subject.trim()
    const message = supportForm.message.trim()
    if (subject.length < 3) {
      setSupportError('Subject must be at least 3 characters.')
      return
    }
    if (message.length < 10) {
      setSupportError('Message must be at least 10 characters.')
      return
    }
    contactSupportMutation.mutate({ subject, message })
  }

  useEffect(() => {
    localStorage.setItem('sound_enabled', String(soundEnabled))
  }, [soundEnabled])

  const handleNotifToggle = async (value: boolean) => {
    if (value) {
      const result = await Notification.requestPermission()
      setNotifEnabled(result === 'granted')
    } else {
      setNotifEnabled(false)
    }
  }

  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.put('/users/me/password', data),
    onSuccess: () => {
      setPwSuccess(true)
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' })
      setPwError(null)
      setTimeout(() => setPwSuccess(false), 3000)
    },
    onError: (err: any) => {
      setPwError(err.message ?? 'Failed to change password')
    },
  })

  const deleteAccountMutation = useMutation({
    mutationFn: () => api.delete('/users/me'),
    onSuccess: () => {
      clearAuth()
      navigate('/auth', { replace: true })
    },
    onError: (err: any) => {
      setPwError(err.message ?? 'Failed to delete account')
    },
  })

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()
    setPwError(null)
    if (pwForm.newPassword.length < 8) {
      setPwError('New password must be at least 8 characters')
      return
    }
    if (pwForm.newPassword !== pwForm.confirm) {
      setPwError('New passwords do not match')
      return
    }
    changePasswordMutation.mutate({
      currentPassword: pwForm.currentPassword,
      newPassword: pwForm.newPassword,
    })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-6 pb-24 md:pb-6 md:p-8">
        <div className="max-w-xl md:max-w-2xl lg:max-w-3xl mx-auto space-y-6 animate-slide-up">
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">Settings</h1>

          {/* Sound */}
          <div className="card">
            <SectionHeader title="Sound" />
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-semibold text-white">Sound Effects</p>
                <p className="text-xs text-neutral-500 mt-0.5">Play sounds during the game</p>
              </div>
              <ToggleSwitch enabled={soundEnabled} onChange={setSoundEnabled} />
            </div>
          </div>

          {/* Notifications */}
          <div className="card">
            <SectionHeader title="Notifications" />
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-semibold text-white">Browser Notifications</p>
                <p className="text-xs text-neutral-500 mt-0.5">Get notified about game invites</p>
              </div>
              <ToggleSwitch enabled={notifEnabled} onChange={handleNotifToggle} />
            </div>
          </div>

          {/* Language */}
          <div className="card">
            <SectionHeader title="Language" />
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-semibold text-white">App Language</p>
                <p className="text-xs text-neutral-500 mt-0.5">Select your preferred language</p>
              </div>
              <select
                value={i18n.language?.split('-')[0] ?? 'en'}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-sm focus:outline-none focus:border-brand-600 transition-colors"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Email verification */}
          <div className="card space-y-3">
            <SectionHeader title="Email" />
            {emailVerified ? (
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Email verified <span className="text-emerald-400">✓</span>
                  </p>
                  {meQuery.data?.email && (
                    <p className="text-xs text-neutral-500 mt-0.5 break-all">{meQuery.data.email}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-white">Verify your email</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Unverified accounts start with 20 ⭐. Verify your email to earn +
                    {EMAIL_VERIFICATION_REWARD} ⭐.
                  </p>
                  {meQuery.data?.email && (
                    <p className="text-xs text-neutral-400 mt-1 break-all">{meQuery.data.email}</p>
                  )}
                </div>

                {!codeRequested ? (
                  <button
                    onClick={() => sendCodeMutation.mutate()}
                    disabled={sendCodeMutation.isPending}
                    className="w-full py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors disabled:opacity-40"
                  >
                    {sendCodeMutation.isPending ? 'Sending…' : 'Send verification code'}
                  </button>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      setVerifyError(null)
                      if (!/^\d{6}$/.test(codeInput)) {
                        setVerifyError('Enter the 6-digit code from your email.')
                        return
                      }
                      verifyCodeMutation.mutate(codeInput)
                    }}
                    className="space-y-2"
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoComplete="one-time-code"
                      placeholder="6-digit code"
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-center text-lg font-mono tracking-[0.5em] placeholder-neutral-600 focus:outline-none focus:border-brand-600 transition-colors"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCodeRequested(false)
                          setCodeInput('')
                          setVerifyError(null)
                          setVerifyMessage(null)
                        }}
                        className="flex-1 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={verifyCodeMutation.isPending || codeInput.length !== 6}
                        className="flex-1 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors disabled:opacity-40"
                      >
                        {verifyCodeMutation.isPending ? 'Verifying…' : 'Verify email'}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => sendCodeMutation.mutate()}
                      disabled={sendCodeMutation.isPending}
                      className="w-full text-xs text-neutral-400 hover:text-white transition-colors disabled:opacity-40"
                    >
                      {sendCodeMutation.isPending ? 'Sending…' : 'Resend code'}
                    </button>
                  </form>
                )}

                {verifyError && <p className="text-red-400 text-xs">{verifyError}</p>}
                {verifyMessage && !verifyError && (
                  <p className="text-emerald-400 text-xs">{verifyMessage}</p>
                )}
              </div>
            )}
          </div>

          {/* Account */}
          <div className="card space-y-5">
            <SectionHeader title="Account" />

            {/* Change Password */}
            <div>
              <p className="text-sm font-semibold text-white mb-3">Change Password</p>
              <form onSubmit={handleChangePassword} className="space-y-2">
                <input
                  type="password"
                  placeholder="Current password"
                  value={pwForm.currentPassword}
                  onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-brand-600 transition-colors"
                  required
                />
                <input
                  type="password"
                  placeholder="New password"
                  value={pwForm.newPassword}
                  onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-brand-600 transition-colors"
                  required
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-brand-600 transition-colors"
                  required
                />
                {pwError && (
                  <p className="text-red-400 text-xs">{pwError}</p>
                )}
                {pwSuccess && (
                  <p className="text-emerald-400 text-xs">Password changed successfully.</p>
                )}
                <button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  className="w-full py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  {changePasswordMutation.isPending ? 'Saving…' : 'Update Password'}
                </button>
              </form>
            </div>

            {/* Delete Account */}
            <div className="border-t border-neutral-800 pt-4">
              <p className="text-sm font-semibold text-white mb-1">Delete Account</p>
              <p className="text-xs text-neutral-500 mb-3">
                Permanently deletes your account and all associated data. This cannot be undone.
              </p>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-800/60 text-red-400 text-sm font-semibold transition-colors"
              >
                Delete My Account
              </button>
            </div>
          </div>

          {/* Contact Support */}
          <div className="card space-y-3">
            <SectionHeader title="Contact Support" />
            <p className="text-xs text-neutral-500 -mt-2">
              Found a bug, have a question, or want to suggest something? Send us a message — we'll reply to your
              account email.
            </p>
            <form onSubmit={handleContactSupport} className="space-y-2">
              <input
                type="text"
                placeholder="Subject"
                value={supportForm.subject}
                onChange={(e) => setSupportForm((f) => ({ ...f, subject: e.target.value }))}
                maxLength={200}
                className="w-full px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-brand-600 transition-colors"
                required
              />
              <textarea
                placeholder="Describe your request or issue…"
                value={supportForm.message}
                onChange={(e) => setSupportForm((f) => ({ ...f, message: e.target.value }))}
                maxLength={5000}
                rows={5}
                className="w-full px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-brand-600 transition-colors resize-y"
                required
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-neutral-600">
                  {supportForm.message.length}/5000
                </span>
                <span className="text-[11px] text-neutral-600">Limit: 3 messages / hour</span>
              </div>
              {supportError && <p className="text-red-400 text-xs">{supportError}</p>}
              {supportSuccess && (
                <p className="text-emerald-400 text-xs">Message sent — we'll get back to you soon.</p>
              )}
              <button
                type="submit"
                disabled={contactSupportMutation.isPending}
                className="w-full py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors disabled:opacity-40"
              >
                {contactSupportMutation.isPending ? 'Sending…' : 'Send Message'}
              </button>
            </form>
          </div>

          {/* Legal */}
          <div className="card">
            <SectionHeader title="Legal" />
            <div className="space-y-1">
              <Link
                to="/terms"
                className="flex items-center justify-between py-2.5 px-1 text-sm text-neutral-300 hover:text-white transition-colors group"
              >
                <span>Terms of Service</span>
                <span className="text-neutral-600 group-hover:text-neutral-400 transition-colors">›</span>
              </Link>
              <div className="h-px bg-neutral-800" />
              <Link
                to="/privacy"
                className="flex items-center justify-between py-2.5 px-1 text-sm text-neutral-300 hover:text-white transition-colors group"
              >
                <span>Privacy Policy</span>
                <span className="text-neutral-600 group-hover:text-neutral-400 transition-colors">›</span>
              </Link>
              <div className="h-px bg-neutral-800" />
              <div className="flex items-center justify-between py-2.5 px-1">
                <span className="text-sm text-neutral-500">App Version</span>
                <span className="text-xs text-neutral-600 font-mono">1.0.0</span>
              </div>
            </div>
          </div>

          {/* Help the developer */}
          <div className="card text-center space-y-2">
            <p className="text-2xl">☕</p>
            <p className="text-sm font-semibold text-white">Help the developer</p>
            <p className="text-xs text-neutral-500">
              Red Handed is built by a tiny team. If you're enjoying the game, you'll soon be able to support
              development here.
            </p>
            <p className="text-[11px] uppercase tracking-widest text-neutral-600 pt-1">
              Buy Me a Coffee · Patreon · Coming soon
            </p>
          </div>
        </div>
      </main>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h2 className="text-lg font-bold text-white">Delete Account</h2>
            <p className="text-sm text-neutral-400">
              This action is <span className="text-red-400 font-semibold">permanent and irreversible</span>. All your
              data including rank, coins, and game history will be deleted.
            </p>
            <p className="text-sm text-neutral-400">
              Type <span className="font-mono text-white">DELETE</span> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-red-600 transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirmText('')
                }}
                className="flex-1 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteAccountMutation.mutate()}
                disabled={deleteConfirmText !== 'DELETE' || deleteAccountMutation.isPending}
                className="flex-1 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-40"
              >
                {deleteAccountMutation.isPending ? 'Deleting…' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
