import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'

interface ReportModalProps {
  targetUserId: string
  targetUsername: string
  onClose: () => void
}

export function ReportModal({ targetUserId, targetUsername, onClose }: ReportModalProps) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const REPORT_REASONS = [
    { value: 'cheating', label: t('report.reasonCheating', '🚫 Cheating') },
    { value: 'harassment', label: t('report.reasonHarassment', '😡 Harassment') },
    { value: 'hate_speech', label: t('report.reasonHateSpeech', '🔞 Hate Speech') },
    { value: 'inappropriate_name', label: t('report.reasonInappropriateName', '🏷️ Inappropriate Name') },
    { value: 'spam', label: t('report.reasonSpam', '📢 Spam') },
    { value: 'other', label: t('report.reasonOther', '❓ Other') },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason) return
    setLoading(true)
    setError(null)
    try {
      await api.post(`/users/${targetUserId}/report`, { reason, details: details.trim() || undefined })
      setDone(true)
    } catch (err: any) {
      setError(err.message ?? t('report.failedToSubmit', 'Failed to submit report'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚨</span>
            <h2 className="text-white font-bold text-base">{t('report.title', 'Report Player')}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {done ? (
          <div className="px-5 py-8 text-center space-y-3">
            <span className="text-4xl">✅</span>
            <p className="text-white font-semibold">{t('report.submitted', 'Report Submitted')}</p>
            <p className="text-neutral-400 text-sm">
              {t('report.thankYou', "Thank you for helping keep the community safe. We'll review this report.")}
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors"
            >
              {t('report.done', 'Done')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <p className="text-neutral-400 text-sm">
              {t('report.reporting', 'Reporting')} <span className="text-white font-semibold">{targetUsername}</span>
            </p>

            {/* Reason */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-2">
                {t('report.reasonLabel', 'Reason *')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setReason(r.value)}
                    className={[
                      'flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-left text-xs font-medium transition-all',
                      reason === r.value
                        ? 'border-red-700/60 bg-red-950/40 text-red-300'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700 hover:text-neutral-300',
                    ].join(' ')}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Details */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-2">
                {t('report.detailsLabel', 'Details (optional)')}
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, 500))}
                placeholder={t('report.detailsPlaceholder', 'Describe what happened...')}
                rows={3}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-neutral-600 resize-none"
              />
              <p className="text-[10px] text-neutral-700 mt-1 text-right">{details.length}/500</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/50 border border-red-800/50 text-red-400 text-xs">
                <span>⚠</span> {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white font-semibold text-sm transition-colors"
              >
                {t('report.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={!reason || loading}
                className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? t('report.submitting', 'Submitting...') : t('report.submit', 'Submit Report')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
