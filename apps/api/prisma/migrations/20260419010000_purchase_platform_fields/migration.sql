-- Add platform + platformTxId to purchases so Apple/Google IAP transactions
-- can share the same table as Stripe checkout sessions. Existing rows stay
-- on the default 'stripe' platform and null platformTxId.
--
-- Idempotent: a previous attempt shipped this as `20260418050000_purchase_platform_fields`
-- (out-of-order with the 20260419000000_gift migration that was already applied
-- to staging). That deploy left staging in a wedged state — the container
-- crash-looped and Caddy returned 502 on the smoke test. Re-running with
-- `IF NOT EXISTS` guards lets the reordered migration apply cleanly whether
-- the columns/indexes were created on a prior partial run or not.

ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "platform" VARCHAR(16) NOT NULL DEFAULT 'stripe';
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "platformTxId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "purchases_platformTxId_key" ON "purchases"("platformTxId");
CREATE INDEX IF NOT EXISTS "purchases_userId_platform_idx" ON "purchases"("userId", "platform");
