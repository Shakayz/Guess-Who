-- Add platform + platformTxId to purchases so Apple/Google IAP transactions
-- can share the same table as Stripe checkout sessions. Existing rows stay
-- on the default 'stripe' platform and null platformTxId.
--
-- Migration history around this change (why the IF NOT EXISTS guards and the
-- paired compose cleanup in deploy/docker-compose.staging.yml are both needed):
--
--   1. Originally shipped in commit 58d0a42 as `20260418050000_...` — timestamp
--      landed BEFORE the already-applied `20260419000000_gift_...` migration.
--      That deploy left staging's `_prisma_migrations` wedged (failed row).
--   2. Renamed to `20260419010000_...` in eb59dfe to order after the gift
--      migration. A follow-up (#65) then added `IF NOT EXISTS` guards
--      directly, which changed the checksum of an already-recorded row —
--      `migrate deploy` refused to continue with "migrations applied to the
--      database differ from the ones in prisma/migrations folder".
--   3. Renamed again to `20260419020000_...` (this folder) so the row for the
--      old name can be cleaned up (see compose cleanup) and the new name is
--      applied fresh, with idempotent DDL so re-running against a DB where
--      eb59dfe's original non-idempotent version partially ran is still safe.

ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "platform" VARCHAR(16) NOT NULL DEFAULT 'stripe';
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "platformTxId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "purchases_platformTxId_key" ON "purchases"("platformTxId");
CREATE INDEX IF NOT EXISTS "purchases_userId_platform_idx" ON "purchases"("userId", "platform");
