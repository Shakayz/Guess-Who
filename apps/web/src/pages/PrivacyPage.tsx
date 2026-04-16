import React from 'react'
import { Link } from 'react-router-dom'
import { NavBar } from '../components/NavBar'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-bold text-white mb-2">{title}</h2>
      <div className="text-sm text-neutral-400 space-y-2 leading-relaxed">{children}</div>
    </div>
  )
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-6 pb-24 sm:pb-6">
        <div className="max-w-2xl mx-auto animate-slide-up">
          <div className="mb-6">
            <Link to="/settings" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
              ← Back to Settings
            </Link>
          </div>

          <div className="card space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-white mb-1">Privacy Policy</h1>
              <p className="text-xs text-neutral-500">Last updated: April 5, 2026</p>
            </div>

            <Section title="1. Data We Collect">
              <p>When you use Red Handed, we collect the following information:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>
                  <strong className="text-white">Account information:</strong> username, email address, and hashed
                  password
                </li>
                <li>
                  <strong className="text-white">Profile data:</strong> avatar image, rank tier, rank points, star
                  coins, and honor points
                </li>
                <li>
                  <strong className="text-white">Game statistics:</strong> game results, win/loss record, roles played,
                  and survival outcomes
                </li>
                <li>
                  <strong className="text-white">Chat messages:</strong> in-game and direct messages exchanged between
                  players
                </li>
                <li>
                  <strong className="text-white">Device information:</strong> push notification tokens (mobile) for
                  delivering game notifications
                </li>
              </ul>
            </Section>

            <Section title="2. How We Use Your Data">
              <p>We use the data we collect to:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Provide and operate the core game functionality and matchmaking</li>
                <li>Display leaderboards and player profiles</li>
                <li>Deliver in-game and push notifications</li>
                <li>Enforce our Terms of Service and maintain platform safety</li>
                <li>Improve game balance and player experience</li>
              </ul>
            </Section>

            <Section title="3. Data Sharing">
              <p>
                We <strong className="text-white">do not sell, rent, or share</strong> your personal information with
                third parties for their marketing purposes. Your data is used solely to operate and improve the Game.
              </p>
              <p>
                Public profile information (username, avatar, rank, and game stats) is visible to other players as part
                of the game experience.
              </p>
            </Section>

            <Section title="4. Data Retention">
              <p>
                We retain your account data for as long as your account is active. If you delete your account, your
                personal data is permanently removed from our systems within 30 days. Aggregated, anonymized statistics
                may be retained indefinitely.
              </p>
            </Section>

            <Section title="5. Account Deletion">
              <p>
                You can delete your account at any time from{' '}
                <Link to="/settings" className="text-brand-400 hover:text-brand-300 transition-colors">
                  Settings → Account → Delete Account
                </Link>
                . This action is irreversible and will permanently remove all your data including game history, rank,
                and virtual currency.
              </p>
            </Section>

            <Section title="6. Children's Privacy">
              <p>
                The Game is not directed at children under 13 years of age. We do not knowingly collect personal
                information from children under 13. If we become aware that we have collected such data, we will
                promptly delete it. If you believe a child has provided us with their data, please contact us.
              </p>
            </Section>

            <Section title="7. Cookies and Local Storage">
              <p>We use browser local storage to store:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Authentication tokens (to keep you signed in)</li>
                <li>User preferences such as sound settings and language selection</li>
              </ul>
              <p>
                This data is stored locally on your device and is not transmitted to third parties. You can clear this
                data through your browser settings at any time.
              </p>
            </Section>

            <Section title="8. Security">
              <p>
                We take reasonable technical and organizational measures to protect your data, including encrypted
                password storage (bcrypt) and HTTPS for all data transmission. No security system is perfect, and we
                cannot guarantee absolute security.
              </p>
            </Section>

            <Section title="9. Changes to This Policy">
              <p>
                We may update this Privacy Policy periodically. We will notify users of significant changes by posting
                a notice in the app. Continued use of the Game after changes constitutes your acceptance of the updated
                policy.
              </p>
            </Section>

            <Section title="10. Contact">
              <p>
                For privacy-related questions or data requests, please contact us at{' '}
                <a href="mailto:privacy@redhanded.game" className="text-brand-400 hover:text-brand-300 transition-colors">
                  privacy@redhanded.game
                </a>
                .
              </p>
            </Section>
          </div>
        </div>
      </main>
    </div>
  )
}
