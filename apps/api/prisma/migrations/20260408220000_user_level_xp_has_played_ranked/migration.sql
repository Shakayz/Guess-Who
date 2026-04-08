-- Add player level / XP and hasPlayedRanked flag to User.
-- Lifetime levelling progression that grows from any game (ranked or unranked),
-- and an explicit "Unranked" gate that only flips to false once the player
-- finishes their first ranked game.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "level"           INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "xp"              INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "hasPlayedRanked" BOOLEAN NOT NULL DEFAULT false;
