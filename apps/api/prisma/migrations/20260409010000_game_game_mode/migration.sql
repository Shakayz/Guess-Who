-- Persist gameMode on each Game row so historical stats can be filtered
-- ranked vs unranked. Existing rows default to "normal" — they were played
-- before this column existed, so they cannot be classified retroactively.
ALTER TABLE "games"
  ADD COLUMN IF NOT EXISTS "gameMode" VARCHAR(20) NOT NULL DEFAULT 'normal';

CREATE INDEX IF NOT EXISTS "games_gameMode_idx" ON "games"("gameMode");
