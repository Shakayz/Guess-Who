-- Add missing User columns to match Prisma schema.
-- seasonXp and pushToken were added to schema.prisma but no migration ever
-- created them in the database, causing P2022 errors on every prisma.user
-- query in production:
--   "The column `users.seasonXp` does not exist in the current database."
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "seasonXp"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pushToken" TEXT;
