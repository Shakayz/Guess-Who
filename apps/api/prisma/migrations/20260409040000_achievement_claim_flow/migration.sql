-- Add the claim column + supporting index for the unclaimed-count query.
ALTER TABLE "user_achievements"
  ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "user_achievements_userId_claimedAt_idx"
  ON "user_achievements" ("userId", "claimedAt");

-- Retroactive back-fill: the legacy achievement system auto-granted stars at
-- unlock time (see the old gameLoop.checkAndUnlockAchievements path). Mark
-- every pre-existing row as already claimed so the new claim endpoint can't
-- double-pay players on achievements they unlocked before this feature landed.
UPDATE "user_achievements"
  SET "claimedAt" = "unlockedAt"
  WHERE "claimedAt" IS NULL;
