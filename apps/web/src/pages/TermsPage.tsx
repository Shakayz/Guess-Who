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

export default function TermsPage() {
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
              <h1 className="text-2xl font-extrabold text-white mb-1">Terms of Service</h1>
              <p className="text-xs text-neutral-500">Last updated: April 5, 2026</p>
            </div>

            <Section title="1. Acceptance of Terms">
              <p>
                By accessing or using RedHanded (the "Game"), you agree to be bound by these Terms of Service. If you do
                not agree to these terms, please do not use the Game.
              </p>
            </Section>

            <Section title="2. Account Rules">
              <p>
                Each person may maintain only one account. Creating multiple accounts to gain an unfair advantage is
                prohibited and may result in permanent bans.
              </p>
              <p>
                You must be at least <strong className="text-white">13 years old</strong> to create an account. By
                registering, you confirm that you meet this requirement.
              </p>
              <p>
                You are responsible for maintaining the security of your account credentials and for all activity that
                occurs under your account.
              </p>
            </Section>

            <Section title="3. Acceptable Use">
              <p>You agree not to engage in any of the following:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Cheating, exploiting bugs, or using unauthorized software to gain advantages</li>
                <li>Harassing, threatening, or abusing other players</li>
                <li>Using hate speech, slurs, or discriminatory language in chat</li>
                <li>Impersonating other players or staff members</li>
                <li>Attempting to disrupt or interfere with game servers</li>
                <li>Sharing inappropriate, illegal, or offensive content</li>
              </ul>
            </Section>

            <Section title="4. User Content">
              <p>
                You may submit content including word packs and chat messages. By submitting content, you grant us a
                non-exclusive, royalty-free license to use, display, and moderate that content within the Game.
              </p>
              <p>
                You retain ownership of your content, but you are solely responsible for ensuring it complies with
                these terms and applicable laws.
              </p>
            </Section>

            <Section title="5. Virtual Currency">
              <p>
                Star Coins are virtual in-game currency with no real-world monetary value. Star Coins are
                <strong className="text-white"> non-refundable</strong> and cannot be exchanged for real money or
                transferred between accounts.
              </p>
              <p>
                We reserve the right to modify the availability, pricing, or functionality of virtual currency and
                in-game items at any time.
              </p>
            </Section>

            <Section title="6. Termination">
              <p>
                We reserve the right to suspend or permanently ban accounts that violate these Terms of Service, at our
                sole discretion, with or without prior notice. Serious violations such as hate speech or cheating may
                result in immediate permanent bans.
              </p>
            </Section>

            <Section title="7. Disclaimer of Warranties">
              <p>
                The Game is provided <strong className="text-white">"as is"</strong> without warranties of any kind.
                We do not guarantee uninterrupted service, and we are not liable for any data loss, downtime, or issues
                arising from use of the Game.
              </p>
            </Section>

            <Section title="8. Changes to Terms">
              <p>
                We may update these Terms of Service from time to time. Continued use of the Game after changes are
                posted constitutes acceptance of the updated terms. We will make reasonable efforts to notify users of
                significant changes.
              </p>
            </Section>

            <Section title="9. Contact">
              <p>
                If you have questions about these terms, please contact us at{' '}
                <a href="mailto:support@redhanded.game" className="text-brand-400 hover:text-brand-300 transition-colors">
                  support@redhanded.game
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
