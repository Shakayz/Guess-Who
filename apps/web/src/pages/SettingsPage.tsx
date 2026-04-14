import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
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

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const clearAuth = useAuthStore((s) => s.clearAuth)

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
