-- Mobile In-App Purchase support
--
-- Adds the fields needed to verify + credit StoreKit (iOS) and Play Billing
-- (Android) purchases without breaking existing Stripe-backed rows. Stripe
-- purchases keep `platform = NULL` (or can be backfilled to 'stripe'), while
-- IAP purchases carry 'ios' or 'android' plus the store transaction id.

-- ── purchases: new columns ────────────────────────────────────────────────
ALTER TABLE "purchases"
  ADD COLUMN "platform"           VARCHAR(16),
  ADD COLUMN "productId"          TEXT,
  ADD COLUMN "storeTransactionId" TEXT;

-- Unique index for receipt-replay idempotency. NULLs are allowed (Stripe
-- rows) because Postgres treats NULLs as distinct in unique indexes.
CREATE UNIQUE INDEX "purchases_storeTransactionId_key"
  ON "purchases" ("storeTransactionId");

-- ── users: premium cache ──────────────────────────────────────────────────
ALTER TABLE "users"
  ADD COLUMN "premium"         BOOLEAN       NOT NULL DEFAULT false,
  ADD COLUMN "premiumUntil"    TIMESTAMP(3),
  ADD COLUMN "premiumPlatform" VARCHAR(16);

-- ── subscriptions table ───────────────────────────────────────────────────
CREATE TABLE "subscriptions" (
  "id"                  TEXT         NOT NULL,
  "userId"              TEXT         NOT NULL,
  "platform"            VARCHAR(16)  NOT NULL,
  "productId"           TEXT         NOT NULL,
  "storeSubscriptionId" TEXT         NOT NULL,
  "status"              VARCHAR(20)  NOT NULL DEFAULT 'active',
  "expiresAt"           TIMESTAMP(3),
  "autoRenewing"        BOOLEAN      NOT NULL DEFAULT true,
  "environment"         VARCHAR(16),
  "lastVerifiedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscriptions_storeSubscriptionId_key"
  ON "subscriptions" ("storeSubscriptionId");

CREATE INDEX "subscriptions_userId_status_idx"
  ON "subscriptions" ("userId", "status");
