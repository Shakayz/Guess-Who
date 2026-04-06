import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { NavBar } from '../components/NavBar'

interface Section {
  id: string
  icon: string
  title: string
  color: string
  borderColor: string
  glowColor: string
  content: React.ReactNode
}

export default function HowToPlayPage() {
  const [expanded, setExpanded] = useState<string | null>('setup')

  const toggle = (id: string) => setExpanded((prev) => (prev === id ? null : id))

  const sections: Section[] = [
    {
      id: 'setup',
      icon: '🎮',
      title: 'The Setup',
      color: 'from-violet-950/60 to-neutral-950/80',
      borderColor: 'border-violet-700/40',
      glowColor: 'via-violet-500',
      content: (
        <div className="space-y-3 text-sm text-neutral-300 leading-relaxed">
          <p>
            Players join a room using a code or through matchmaking. Once the game starts, each
            player is secretly assigned a <span className="text-violet-400 font-semibold">role</span> and
            a <span className="text-violet-400 font-semibold">secret word</span>.
          </p>
          <ul className="space-y-2 mt-3">
            {[
              { icon: '👥', text: '3–20 players per game' },
              { icon: '🔒', text: 'Roles are hidden — only you know yours' },
              { icon: '📝', text: 'Your word is the clue to your identity' },
              { icon: '🎯', text: 'Goal: uncover impostors before they take over' },
            ].map((item) => (
              <li key={item.text} className="flex items-start gap-2.5">
                <span className="text-base mt-0.5">{item.icon}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      id: 'roles',
      icon: '🎭',
      title: 'Roles',
      color: 'from-indigo-950/60 to-neutral-950/80',
      borderColor: 'border-indigo-700/40',
      glowColor: 'via-indigo-500',
      content: (
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            {
              icon: '🏘️',
              name: 'Villager',
              badge: 'Standard',
              badgeColor: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40',
              desc: 'You receive the villager word. Use your clue to show you know it — without revealing too much. Find and vote out the impostors!',
              accent: 'border-emerald-800/30 bg-emerald-950/10',
            },
            {
              icon: '🔪',
              name: 'Imposter',
              badge: 'Standard',
              badgeColor: 'bg-red-950/60 text-red-400 border-red-800/40',
              desc: 'You get a different but similar word. Blend in with the villagers — give convincing clues without exposing yourself.',
              accent: 'border-red-800/30 bg-red-950/10',
            },
            {
              icon: '🔍',
              name: 'Detective',
              badge: 'Special Mode',
              badgeColor: 'bg-blue-950/60 text-blue-400 border-blue-800/40',
              desc: 'Plays on the villager team. Once per game you can secretly reveal one player\'s role. Use it wisely!',
              accent: 'border-blue-800/30 bg-blue-950/10',
            },
            {
              icon: '🕵️',
              name: 'Double Agent',
              badge: 'Special Mode',
              badgeColor: 'bg-amber-950/60 text-amber-400 border-amber-800/40',
              desc: 'You know both the villager and imposter words. Work with the imposters while appearing innocent. The ultimate deceiver.',
              accent: 'border-amber-800/30 bg-amber-950/10',
            },
            {
              icon: '🛡️',
              name: 'Guardian',
              badge: 'Special Mode',
              badgeColor: 'bg-yellow-950/60 text-yellow-400 border-yellow-800/40',
              desc: 'Plays on the villager team. Each round during voting, you can protect one player from elimination. You cannot protect yourself.',
              accent: 'border-yellow-800/30 bg-yellow-950/10',
            },
          ].map((role) => (
            <div
              key={role.name}
              className={`rounded-xl border p-4 ${role.accent} transition-all hover:scale-[1.01]`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{role.icon}</span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-bold text-sm">{role.name}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${role.badgeColor}`}>
                      {role.badge}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-neutral-400 text-xs leading-relaxed">{role.desc}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'rounds',
      icon: '🔄',
      title: 'Each Round',
      color: 'from-purple-950/60 to-neutral-950/80',
      borderColor: 'border-purple-700/40',
      glowColor: 'via-purple-500',
      content: (
        <div className="space-y-4">
          {[
            {
              step: 1,
              phase: 'Speaking Phase',
              icon: '💬',
              color: 'bg-purple-950/50 border-purple-700/40 text-purple-400',
              items: [
                'Each player gives exactly one clue about their word',
                'Be clever — too obvious and the imposter catches on',
                'Too vague and you look suspicious yourself',
                '⚠️ If you say your actual word, you\'re automatically eliminated!',
              ],
            },
            {
              step: 2,
              phase: 'Voting Phase',
              icon: '🗳️',
              color: 'bg-amber-950/50 border-amber-700/40 text-amber-400',
              items: [
                'All players vote to eliminate someone they suspect',
                'The player with the most votes is eliminated',
                'Tie = no elimination — another round begins',
                'Eliminated players\' roles are revealed for everyone',
              ],
            },
            {
              step: 3,
              phase: 'Reveal',
              icon: '📋',
              color: 'bg-emerald-950/50 border-emerald-700/40 text-emerald-400',
              items: [
                'The eliminated player\'s role is shown to all',
                'The game continues until a team wins',
                'Or a new round begins if no winner yet',
              ],
            },
          ].map((phase) => (
            <div key={phase.step} className="flex gap-3">
              <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 ${phase.color}`}>
                {phase.step}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span>{phase.icon}</span>
                  <span className="text-white font-semibold text-sm">{phase.phase}</span>
                </div>
                <ul className="space-y-1.5">
                  {phase.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-neutral-400">
                      <span className="text-brand-500 mt-0.5 shrink-0">›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'winning',
      icon: '🏆',
      title: 'Winning',
      color: 'from-amber-950/60 to-neutral-950/80',
      borderColor: 'border-amber-700/40',
      glowColor: 'via-amber-500',
      content: (
        <div className="space-y-3">
          {[
            {
              team: 'Villagers Win',
              icon: '✅',
              color: 'border-emerald-700/40 bg-emerald-950/20',
              textColor: 'text-emerald-400',
              conditions: [
                'All imposters are voted out and eliminated',
                'The detective correctly identifies all threats',
              ],
            },
            {
              team: 'Imposters Win',
              icon: '💀',
              color: 'border-red-700/40 bg-red-950/20',
              textColor: 'text-red-400',
              conditions: [
                'Imposters equal or outnumber remaining villagers',
                'The double agent survives to the end',
              ],
            },
          ].map((condition) => (
            <div key={condition.team} className={`rounded-xl border p-4 ${condition.color}`}>
              <div className="flex items-center gap-2 mb-2">
                <span>{condition.icon}</span>
                <span className={`font-bold text-sm ${condition.textColor}`}>{condition.team}</span>
              </div>
              <ul className="space-y-1">
                {condition.conditions.map((c) => (
                  <li key={c} className="flex items-start gap-2 text-xs text-neutral-400">
                    <span className="text-neutral-600 mt-0.5">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="rounded-xl border border-neutral-700/40 bg-neutral-900/40 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span>⚖️</span>
              <span className="text-neutral-300 font-semibold text-sm">Tiebreakers</span>
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed">
              When votes are tied, no one is eliminated and a new round starts. This can happen
              multiple times — the game has no round limit!
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'modes',
      icon: '⚙️',
      title: 'Game Modes',
      color: 'from-teal-950/60 to-neutral-950/80',
      borderColor: 'border-teal-700/40',
      glowColor: 'via-teal-500',
      content: (
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            {
              icon: '🎲',
              name: 'Quick Match',
              desc: 'Jump into a random game instantly. Matched with players of similar skill. No LP on the line.',
              color: 'border-brand-700/30 bg-brand-950/10',
            },
            {
              icon: '🚪',
              name: 'Create Lobby',
              desc: 'Set up a custom private game with friends. Share your room code and control game settings.',
              color: 'border-violet-700/30 bg-violet-950/10',
            },
            {
              icon: '🏆',
              name: 'Ranked',
              desc: 'Competitive 10-player matches. Win to gain LP, lose to drop. Climb the tier ladder from Wooden to Mythic.',
              color: 'border-amber-700/30 bg-amber-950/10',
            },
            {
              icon: '📱',
              name: 'Offline',
              desc: 'Pass & play on a single device. No internet required. Perfect for in-person gatherings.',
              color: 'border-teal-700/30 bg-teal-950/10',
            },
          ].map((mode) => (
            <div key={mode.name} className={`rounded-xl border p-4 ${mode.color} hover:scale-[1.01] transition-all`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{mode.icon}</span>
                <span className="text-white font-bold text-sm">{mode.name}</span>
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed">{mode.desc}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'tips',
      icon: '💡',
      title: 'Pro Tips',
      color: 'from-rose-950/60 to-neutral-950/80',
      borderColor: 'border-rose-700/40',
      glowColor: 'via-rose-500',
      content: (
        <div className="space-y-2.5">
          {[
            { icon: '👂', tip: 'Pay close attention to other players\' clues — patterns reveal roles faster than single clues.' },
            { icon: '🎨', tip: 'Be creative. A clever, indirect clue is safer than an obvious one that the imposter can copy.' },
            { icon: '👁️', tip: 'Watch body language in real-life games — hesitation and eye contact say a lot.' },
            { icon: '🧠', tip: 'As imposter, listen first. Use others\' clues to guess the villager word before giving your own.' },
            { icon: '⏱️', tip: 'Timing matters. Cluing too quickly seems unprepared; too slowly looks suspicious.' },
            { icon: '🤝', tip: 'Build trust early as a villager — it makes your accusations more credible later.' },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-xl bg-neutral-900/50 border border-neutral-800/50 hover:border-neutral-700/50 transition-colors"
            >
              <span className="text-base mt-0.5 shrink-0">{item.icon}</span>
              <p className="text-sm text-neutral-300 leading-relaxed">{item.tip}</p>
            </div>
          ))}
        </div>
      ),
    },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 px-4 pt-20 pb-24 sm:pb-16">
        <div className="max-w-2xl mx-auto animate-slide-up space-y-6">

          {/* Hero header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-600/30 bg-violet-600/10 text-violet-400 text-xs font-semibold mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse-slow" />
              Complete Guide
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight mb-3">
              How to Play
            </h1>
            <p className="text-neutral-400 text-base max-w-md mx-auto">
              Master the art of deception and deduction in the Imposter social game.
            </p>
          </div>

          {/* Quick reference strip */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[
              { icon: '🎭', label: 'Deceive' },
              { icon: '🔍', label: 'Detect' },
              { icon: '💬', label: 'Clue' },
              { icon: '🗳️', label: 'Vote' },
              { icon: '💀', label: 'Eliminate' },
              { icon: '🏆', label: 'Win' },
            ].map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center gap-1 py-3 rounded-xl bg-neutral-900/60 border border-neutral-800/60"
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Expandable sections */}
          <div className="space-y-3">
            {sections.map((section, i) => {
              const isOpen = expanded === section.id
              return (
                <div
                  key={section.id}
                  className={[
                    'rounded-2xl border overflow-hidden transition-all duration-200',
                    isOpen ? section.borderColor : 'border-neutral-800/60',
                  ].join(' ')}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  {/* Section header */}
                  <button
                    onClick={() => toggle(section.id)}
                    className={[
                      'w-full flex items-center gap-3 px-5 py-4 text-left transition-all',
                      isOpen
                        ? `bg-gradient-to-r ${section.color}`
                        : 'bg-neutral-900/60 hover:bg-neutral-800/60',
                    ].join(' ')}
                  >
                    {/* Gradient top bar when open */}
                    {isOpen && (
                      <div className={`absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent ${section.glowColor} to-transparent pointer-events-none`} />
                    )}
                    <div className={[
                      'w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border transition-all',
                      isOpen
                        ? `${section.borderColor} bg-neutral-900/60`
                        : 'border-neutral-700/40 bg-neutral-800/40',
                    ].join(' ')}>
                      {section.icon}
                    </div>
                    <div className="flex-1">
                      <span className={['font-bold text-base transition-colors', isOpen ? 'text-white' : 'text-neutral-300'].join(' ')}>
                        {section.title}
                      </span>
                    </div>
                    <span className={['text-lg transition-transform duration-200', isOpen ? 'rotate-180' : ''].join(' ')}>
                      <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>

                  {/* Section content */}
                  {isOpen && (
                    <div className="px-5 py-4 border-t border-neutral-800/60 bg-neutral-950/60 animate-slide-up">
                      {section.content}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* CTA */}
          <div className="text-center pt-4 space-y-3">
            <p className="text-neutral-500 text-sm">Ready to play?</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/"
                className="px-8 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-colors shadow-lg shadow-violet-950/40"
              >
                Play Now
              </Link>
              <Link
                to="/leaderboard"
                className="px-8 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white font-bold transition-colors border border-neutral-700"
              >
                View Leaderboard
              </Link>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
