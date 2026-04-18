-- Gate the inviter's referral reward on the invitee's first ranked game.
-- Previously, both sides were credited at signup; now only the invitee is
-- credited immediately and the inviter is paid when the invitee plays their
-- first ranked game. `referralInviterRewarded` is the idempotency flag that
-- lets the gameLoop hook fire the credit exactly once.
--
-- Existing rows default to `true` so users who were already referred under
-- the old flow (where the inviter was paid immediately) don't retroactively
-- trigger a second payout the next time they play ranked.
ALTER TABLE "users"
  ADD COLUMN "referralInviterRewarded" BOOLEAN NOT NULL DEFAULT false;

UPDATE "users" SET "referralInviterRewarded" = true WHERE "referredByUserId" IS NOT NULL;
