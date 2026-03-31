-- AlterTable
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "emailVerified"            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "emailVerificationCode"    VARCHAR(6),
  ADD COLUMN IF NOT EXISTS "emailVerificationExpires" TIMESTAMP(3);
