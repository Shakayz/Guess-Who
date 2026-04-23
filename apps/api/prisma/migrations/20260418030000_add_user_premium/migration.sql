-- Premium subscription columns on User.
--
-- `premiumUntil` is the single source of truth for entitlement — a user is
-- considered premium iff this timestamp is non-null and strictly in the
-- future. The shop webhook writes `current_period_end` here on every Stripe
-- subscription event, so a cancelled sub keeps its perks until the paid
-- period actually ends. `stripeCustomerId` / `stripeSubscriptionId` are
-- uniqued so the webhook can look a user up by either id on incoming events.

ALTER TABLE "users"
  ADD COLUMN "premiumUntil"         TIMESTAMP(3),
  ADD COLUMN "stripeCustomerId"     TEXT,
  ADD COLUMN "stripeSubscriptionId" TEXT;

CREATE UNIQUE INDEX "users_stripeCustomerId_key"     ON "users"("stripeCustomerId");
CREATE UNIQUE INDEX "users_stripeSubscriptionId_key" ON "users"("stripeSubscriptionId");
