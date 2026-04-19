-- Add platform + platformTxId to purchases so Apple/Google IAP transactions
-- can share the same table as Stripe checkout sessions. Existing rows stay
-- on the default 'stripe' platform and null platformTxId.

ALTER TABLE "purchases" ADD COLUMN "platform" VARCHAR(16) NOT NULL DEFAULT 'stripe';
ALTER TABLE "purchases" ADD COLUMN "platformTxId" TEXT;

CREATE UNIQUE INDEX "purchases_platformTxId_key" ON "purchases"("platformTxId");
CREATE INDEX "purchases_userId_platform_idx" ON "purchases"("userId", "platform");
