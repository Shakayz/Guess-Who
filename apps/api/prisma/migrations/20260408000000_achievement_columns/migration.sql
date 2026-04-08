-- Add missing columns to achievements table to match Prisma schema
ALTER TABLE "achievements"
  ADD COLUMN IF NOT EXISTS "category"   VARCHAR(30) NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS "difficulty" VARCHAR(15) NOT NULL DEFAULT 'bronze',
  ADD COLUMN IF NOT EXISTS "xpReward"   INTEGER     NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "coinReward" INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "isSecret"   BOOLEAN     NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "achievements_category_idx"   ON "achievements"("category");
CREATE INDEX IF NOT EXISTS "achievements_difficulty_idx" ON "achievements"("difficulty");
