-- Collapse the short-lived dual-currency model (starCoins + goldCoins) back to
-- a single wallet. The shop was crediting goldCoins on purchase but every
-- earn/spend path in the app reads and writes starCoins, so anyone who bought
-- a pack silently ended up with an invisible balance. Before dropping the
-- column we roll any existing goldCoins into starCoins so no paid balances are
-- lost, then rename the Purchase column for the same reason.

UPDATE "users" SET "starCoins" = "starCoins" + "goldCoins" WHERE "goldCoins" > 0;

ALTER TABLE "users" DROP COLUMN "goldCoins";

ALTER TABLE "purchases" RENAME COLUMN "goldCoins" TO "starCoins";

-- Season-pass tiers that used to hand out goldCoins are rewritten to grant the
-- equivalent value in starCoins. The `season_tiers` table is declared in the
-- Prisma schema but no migration creates it, so staging (which applies
-- migrations with `prisma migrate deploy`) never had it. Guard with IF EXISTS
-- the same way 20260416000000_remove_cosmetics already does, otherwise the
-- whole migration transaction rolls back with "relation does not exist" and
-- the API container exits before binding its port — causing Caddy to return
-- 502 to every request, including sign-in.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'season_tiers') THEN
    UPDATE "season_tiers" SET "rewardType" = 'starCoins' WHERE "rewardType" = 'goldCoins';
  END IF;
END $$;
