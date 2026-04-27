-- Premium gifting: the Gift row can now deliver either coins (existing) or a
-- Premium extension (new). `premiumPlanId` matches a shared PremiumPlan id —
-- 'monthly' | 'yearly' — and the claim route extends the receiver's
-- premiumUntil by the plan interval on claim.
--
-- The `gifts` ALTER uses `IF EXISTS` / `IF NOT EXISTS` so it's a no-op when
-- the `gifts` table doesn't exist yet on a fresh database — the table is
-- materialised by the later heal migration 20260419050000_add_gifts_table.
-- (gifts had no CREATE TABLE migration of its own; dev/staging picked it up
-- via `prisma db push`, prod silently shipped without it.) Without this
-- guard, `prisma migrate deploy` on a fresh DB would error here with
-- `relation "gifts" does not exist` before the heal could ever run.
ALTER TABLE IF EXISTS "gifts" ADD COLUMN IF NOT EXISTS "premiumPlanId" VARCHAR(16);

-- Shop-funded gifts. When a buyer pays real money for a gift, a Purchase row
-- is still stamped (payment trail, idempotency), but on completion we deliver
-- entitlement to `giftReceiverId` via a Gift row instead of crediting the
-- buyer. `premiumPlanId` flags premium gifts so the webhook knows which path
-- to take (coin-pack gifts vs premium gifts).
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "giftReceiverId" TEXT;
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "premiumPlanId" VARCHAR(16);
