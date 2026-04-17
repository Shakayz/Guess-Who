-- Lower the default starting balance to 20. New accounts begin unverified
-- and are topped up to 40 when they confirm their email via the 6-digit
-- code flow (POST /api/auth/email/verify-code). Existing rows keep their
-- current balance — only the default for future inserts changes.
ALTER TABLE "users" ALTER COLUMN "starCoins" SET DEFAULT 20;
