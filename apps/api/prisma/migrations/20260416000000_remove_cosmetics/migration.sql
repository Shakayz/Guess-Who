-- Remove the cosmetics feature from the game.
-- Drops the cosmetics / user_cosmetics tables, removes the cosmeticId column
-- from gifts, and clears any existing 'cosmetic' season-tier rewards (those
-- rewardValues pointed at cosmetic ids that no longer exist).
--
-- Uses IF EXISTS guards so this is safe to run on environments that may have
-- been bootstrapped via `prisma db push` (e.g. the gifts table didn't have a
-- migration of its own).

-- Drop foreign keys first so the table drops succeed regardless of order.
ALTER TABLE "user_cosmetics" DROP CONSTRAINT IF EXISTS "user_cosmetics_userId_fkey";
ALTER TABLE "user_cosmetics" DROP CONSTRAINT IF EXISTS "user_cosmetics_cosmeticId_fkey";

DROP TABLE IF EXISTS "user_cosmetics";
DROP TABLE IF EXISTS "cosmetics";

-- Drop the cosmeticId column from gifts (only ever optional).
ALTER TABLE "gifts" DROP COLUMN IF EXISTS "cosmeticId";

-- Any season tier that previously rewarded a cosmetic now rewards nothing
-- meaningful — clear those rows so the claim endpoint can't try to upsert a
-- non-existent cosmetic. Delete dependent claims first to satisfy the FK.
DELETE FROM "season_pass_claims"
  WHERE "seasonTierId" IN (SELECT "id" FROM "season_tiers" WHERE "rewardType" = 'cosmetic');
DELETE FROM "season_tiers" WHERE "rewardType" = 'cosmetic';
