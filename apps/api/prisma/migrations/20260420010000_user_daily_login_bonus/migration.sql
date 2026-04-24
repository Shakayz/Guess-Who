-- Adds the `lastDailyBonusAt` column used by the login-based daily bonus.
-- Before this change the +20 daily bonus was credited only at end-of-game,
-- which meant a player who'd spent down to <10 coins couldn't afford to
-- play and so could never earn their way back. Splitting the login bonus
-- off into its own column lets us credit it on `/auth/me` while leaving
-- `lastPlayedAt` / `dailyStreakCount` untouched (those still drive the
-- 7-day play-streak bonus on game end).
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "lastDailyBonusAt" TIMESTAMP(3);
