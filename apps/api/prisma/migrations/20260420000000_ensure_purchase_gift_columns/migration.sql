-- Idempotent heal for 20260419000000_gift_premium_and_purchase_gift_fields.
-- On staging that migration's row is marked applied in _prisma_migrations
-- while the ALTER TABLEs never actually landed, so purchases.giftReceiverId
-- and purchases.premiumPlanId / gifts.premiumPlanId are missing. Prisma's
-- generated INSERT for purchase.create lists every scalar field, so every
-- coin-pack buy 500s with "column purchases.giftReceiverId does not exist".
--
-- IF NOT EXISTS makes this a no-op on prod (columns already present) and a
-- fix on staging (columns filled in). Safe on fresh DBs too: the prior
-- migration creates the columns, this one finds them already there.
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "giftReceiverId" TEXT;
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "premiumPlanId" VARCHAR(16);
ALTER TABLE "gifts" ADD COLUMN IF NOT EXISTS "premiumPlanId" VARCHAR(16);
