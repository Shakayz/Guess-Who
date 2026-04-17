-- Referral / invite system. `referralCode` is every account's immutable
-- shareable handle (generated on signup); `referredByUserId` points at the
-- inviter when the new user signed up through someone else's code. Both
-- columns are nullable so existing rows stay valid; new signups backfill
-- `referralCode` on the first /auth/signup or OAuth flow.
ALTER TABLE "users"
  ADD COLUMN "referralCode" VARCHAR(12),
  ADD COLUMN "referredByUserId" TEXT;

CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

ALTER TABLE "users"
  ADD CONSTRAINT "users_referredByUserId_fkey"
  FOREIGN KEY ("referredByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
