-- Remove the cosmetics feature from the game.
-- Drops the cosmetics / user_cosmetics tables, removes the cosmeticId column
-- from gifts, and clears any existing 'cosmetic' season-tier rewards (those
-- rewardValues pointed at cosmetic ids that no longer exist).
--
-- Uses IF EXISTS guards so this is safe to run on environments that may have
-- been bootstrapped via `prisma db push` (e.g. the gifts table didn't have a
-- migration of its own).

-- Drop foreign keys first so the table drops succeed regardless of order.
-- `ALTER TABLE IF EXISTS` is required because user_cosmetics may never have
-- existed on a freshly-migrated DB (it used to be created via `prisma db push`
-- in the legacy setup, with no corresponding migration).
ALTER TABLE IF EXISTS "user_cosmetics" DROP CONSTRAINT IF EXISTS "user_cosmetics_userId_fkey";
ALTER TABLE IF EXISTS "user_cosmetics" DROP CONSTRAINT IF EXISTS "user_cosmetics_cosmeticId_fkey";

DROP TABLE IF EXISTS "user_cosmetics";
DROP TABLE IF EXISTS "cosmetics";

-- Drop the cosmeticId column from gifts (only ever optional, may not exist
-- on a freshly-migrated DB for the same reason as above).
ALTER TABLE IF EXISTS "gifts" DROP COLUMN IF EXISTS "cosmeticId";

-- Any season tier that previously rewarded a cosmetic now rewards nothing
-- meaningful — clear those rows so the claim endpoint can't try to upsert a
-- non-existent cosmetic. Delete dependent claims first to satisfy the FK.
-- Wrap in DO block so it silently succeeds if the tables don't exist yet.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'season_tiers') THEN
    DELETE FROM "season_pass_claims"
      WHERE "seasonTierId" IN (SELECT "id" FROM "season_tiers" WHERE "rewardType" = 'cosmetic');
    DELETE FROM "season_tiers" WHERE "rewardType" = 'cosmetic';
  END IF;
END $$;
