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
-- equivalent value in starCoins. `rewardValue` is already a plain integer
-- string for coin rewards, so no conversion is required beyond swapping the
-- type. Safe to run on fresh installs where no rows match.
UPDATE "season_tiers" SET "rewardType" = 'starCoins' WHERE "rewardType" = 'goldCoins';
