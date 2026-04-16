import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { TUTORIAL_COMPLETION_REWARD } from '@red-handed/shared'
import { NavBar } from '../components/NavBar'

export default function HowToPlayPage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 px-4 pt-20 pb-24 sm:pb-16">
        <div className="max-w-2xl mx-auto animate-slide-up space-y-6">

          {/* Hero header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight mb-3">
              {t('offline.howToPlay')}
            </h1>
            <p className="text-neutral-400 text-base max-w-md mx-auto">
              {t('offline.htpTagline')}
            </p>
          </div>

          {/* How to play */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-4">
            {/* How it works — shown first so players understand the flow before reading roles */}
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">{t('offline.htpHowItWorks')}</p>
              <ol className="space-y-1 ml-1 list-decimal list-inside text-xs text-neutral-400 leading-relaxed">
                <li>{t('offline.htpStep1')}</li>
                <li>{t('offline.htpStep2')}</li>
                <li>{t('offline.htpStep3')}</li>
                <li>{t('offline.htpStep4')}</li>
              </ol>
            </div>

            <div className="border-t border-neutral-800/60" />

            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
              {t('offline.htpModesAndRoles', 'Modes & Roles')}
            </p>

            {/* Normal mode */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎲</span>
                <span className="text-sm font-bold text-brand-400">{t('offline.normal')}</span>
                <span className="text-[10px] text-neutral-600 px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700/40">{t('offline.htpMinPlayers', { count: 3 })}</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">{t('offline.htpNormalDesc')}</p>
              <div className="space-y-1 ml-1">
                <div className="flex items-center gap-2 text-xs">
                  <span>🟢</span>
                  <span className="text-emerald-400 font-semibold">{t('offline.villager')}</span>
                  <span className="text-neutral-500">— {t('offline.htpVillagerDesc')}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span>🔴</span>
                  <span className="text-red-400 font-semibold">{t('offline.redHanded')}</span>
                  <span className="text-neutral-500">— {t('offline.htpRedHandedDesc')}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-800/60" />

            {/* Special mode — grouped by team */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <span className="text-sm font-bold text-amber-400">{t('offline.special')}</span>
                <span className="text-[10px] text-neutral-600 px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700/40">{t('offline.htpMinPlayers', { count: 5 })}</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">{t('offline.htpSpecialDesc')}</p>

              {/* 🟢 Villagers */}
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
                  🟢 {t('offline.teamVillagers', 'Villagers')}
                </p>
                <div className="ml-1 space-y-1">
                  <div className="flex items-start gap-2 text-xs">
                    <span className="shrink-0">🔍</span>
                    <span className="text-blue-400 font-semibold shrink-0">{t('offline.detective')}</span>
                    <span className="text-neutral-500">— {t('offline.htpDetectiveDesc')}</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <span className="shrink-0">🛡️</span>
                    <span className="text-yellow-400 font-semibold shrink-0">{t('offline.guardian')}</span>
                    <span className="text-neutral-500">— {t('offline.htpGuardianDesc')}</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <span className="shrink-0">👑</span>
                    <span className="text-indigo-400 font-semibold shrink-0">{t('offline.mayor', 'Mayor')}</span>
                    <span className="text-neutral-500">— {t('offline.htpMayorDesc', 'Villager whose vote counts double once per game.')}</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <span className="shrink-0">⚖️</span>
                    <span className="text-emerald-300 font-semibold shrink-0">{t('offline.judge', 'Judge')}</span>
                    <span className="text-neutral-500">— {t('offline.htpJudgeDesc', 'In a tied vote, the Judge decides who gets eliminated — but cannot save themselves.')}</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <span className="shrink-0">👻</span>
                    <span className="text-teal-300 font-semibold shrink-0">{t('offline.revenant', 'Revenant')}</span>
                    <span className="text-neutral-500">— {t('offline.htpRevenantDesc', 'After dying, the Revenant secretly casts votes for 2 more rounds.')}</span>
                  </div>
                </div>
              </div>

              {/* 🔴 RedHanded */}
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400">
                  🔴 {t('offline.teamRedHanded', 'Red-Handed')}
                </p>
                <div className="ml-1 space-y-1">
                  <div className="flex items-start gap-2 text-xs">
                    <span className="shrink-0">🕵️</span>
                    <span className="text-amber-400 font-semibold shrink-0">{t('offline.doubleAgent')}</span>
                    <span className="text-neutral-500">— {t('offline.htpDoubleAgentDesc')}</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <span className="shrink-0">🥷</span>
                    <span className="text-fuchsia-400 font-semibold shrink-0">{t('offline.infiltrator', 'Infiltrator')}</span>
                    <span className="text-neutral-500">— {t('offline.htpInfiltratorDesc', 'Knows the villager word, but plays for the redHanded. Appears as villager to the detective.')}</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <span className="shrink-0">💥</span>
                    <span className="text-red-300 font-semibold shrink-0">{t('offline.kamikaze', 'Kamikaze')}</span>
                    <span className="text-neutral-500">— {t('offline.htpKamikazeDesc', 'If voted out, takes one player of their choice down with them — even a guardian-protected one.')}</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <span className="shrink-0">🕷️</span>
                    <span className="text-orange-300 font-semibold shrink-0">{t('offline.corruptor', 'Corruptor')}</span>
                    <span className="text-neutral-500">— {t('offline.htpCorruptorDesc', 'Picks one target at game start — their votes are silently dropped until the Corruptor dies.')}</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <span className="shrink-0">🔄</span>
                    <span className="text-rose-300 font-semibold shrink-0">{t('offline.inverter', 'Inverter')}</span>
                    <span className="text-neutral-500">— {t('offline.htpInverterDesc', 'Once per game, flips the vote tally — the player with the fewest votes is eliminated instead.')}</span>
                  </div>
                </div>
              </div>

              {/* 👯 Pair */}
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-purple-400">
                  👯 {t('offline.teamPair', 'Pair')}
                </p>
                <div className="ml-1 space-y-1">
                  <div className="flex items-start gap-2 text-xs">
                    <span className="shrink-0">👯</span>
                    <span className="text-purple-300 font-semibold shrink-0">{t('offline.evilTwins', 'Evil Twins')}</span>
                    <span className="text-neutral-500">— {t('offline.htpEvilTwinsDesc', 'A linked pair (one villager, one redHanded) who win together if both survive — but lose individually if separated.')}</span>
                  </div>
                </div>
              </div>

              {/* ⚪ Neutral */}
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-400">
                  ⚪ {t('offline.teamNeutral', 'Neutral')}
                </p>
                <div className="ml-1 space-y-1">
                  <div className="flex items-start gap-2 text-xs">
                    <span className="shrink-0">🃏</span>
                    <span className="text-pink-400 font-semibold shrink-0">{t('offline.jester', 'Jester')}</span>
                    <span className="text-neutral-500">— {t('offline.htpJesterDesc', 'Solo role. Wins alone if voted out by the group.')}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Interactive walkthrough promo */}
          <Link
            to="/tutorial"
            className="block rounded-2xl border border-amber-700/40 bg-gradient-to-br from-amber-950/50 to-brand-950/40 p-4 hover:border-amber-600/60 transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-600/20 border border-amber-700/40 flex items-center justify-center text-2xl shrink-0">
                🎓
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">{t('tutorial.homeCardTitle')}</p>
                <p className="text-amber-300/80 text-xs mt-0.5">
                  {t('tutorial.homeCardSubtitle', { amount: TUTORIAL_COMPLETION_REWARD })}
                </p>
              </div>
              <span className="text-amber-400 font-semibold text-sm">→</span>
            </div>
          </Link>

          {/* CTA */}
          <div className="text-center pt-4 space-y-3">
            <p className="text-neutral-500 text-sm">{t('offline.htpReady')}</p>
            <div className="flex justify-center">
              <Link
                to="/"
                className="px-8 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-colors shadow-lg shadow-violet-950/40"
              >
                {t('offline.htpPlayNow')}
              </Link>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
