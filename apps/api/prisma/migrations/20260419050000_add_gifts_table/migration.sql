-- The Gift model lives in schema.prisma since the initial commit but no
-- `CREATE TABLE "gifts"` migration was ever generated — `prisma migrate dev`
-- was skipped at the time, so dev/staging picked the table up via
-- `prisma db push` (which mutates the database directly without writing a
-- migration file). Prod, which only runs `prisma migrate deploy`, never
-- got the table. Migration 20260419000000_gift_premium_and_purchase_gift_fields
-- and its idempotent heal 20260420000000_ensure_purchase_gift_columns both
-- ALTER `gifts` assuming it exists — on prod they failed with `relation
-- "gifts" does not exist`, leaving _prisma_migrations stuck and the api in
-- a P3009 crash loop.
--
-- This migration creates `gifts` idempotently. On prod it materialises the
-- missing table; on staging (where the table was created via db push) and
-- on fresh databases it's a no-op. Slotted at 20260419050000 to land
-- before 20260420000000 in the migration order.
--
-- Same recovery pattern as 20260418000000_add_purchases_table — see that
-- file's header for context on the broader "model added without migration"
-- recurrence.
CREATE TABLE IF NOT EXISTS "gifts" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "coinAmount" INTEGER NOT NULL DEFAULT 0,
    "premiumPlanId" VARCHAR(16),
    "message" VARCHAR(200),
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gifts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey — wrapped in DO blocks so the migration is idempotent
-- against staging where the table already exists with these constraints.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gifts_senderId_fkey') THEN
    ALTER TABLE "gifts" ADD CONSTRAINT "gifts_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gifts_receiverId_fkey') THEN
    ALTER TABLE "gifts" ADD CONSTRAINT "gifts_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
