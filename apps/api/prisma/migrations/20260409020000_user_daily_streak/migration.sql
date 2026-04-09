-- Daily streak bookkeeping on User.
-- `lastPlayedAt` tracks the timestamp of the last finished ONLINE game
-- (offline pass-and-play does not touch the API).
-- `dailyStreakCount` is the rolling consecutive-day counter used for the
-- +20 first-game-of-the-day bonus and the +100 every-7-days streak bonus.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "lastPlayedAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dailyStreakCount" INTEGER NOT NULL DEFAULT 0;
