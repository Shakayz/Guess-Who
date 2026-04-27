-- Heal: Friendship, DirectMessage, SeasonPass, SeasonTier, SeasonPassClaim
-- models live in schema.prisma but no CREATE TABLE migrations were ever
-- generated. Same recurrence pattern as 20260418000000_add_purchases_table,
-- 20260421000000_add_blocks_and_reports, and 20260419050000_add_gifts_table:
-- the model gets added to the schema, `prisma migrate dev` is skipped, the
-- table materialises on dev/staging via `prisma db push` (which mutates
-- the database without writing a migration file), and prod — which only
-- runs `prisma migrate deploy` — is silently left without the table.
--
-- Symptoms on prod include any feature touching these tables 500-ing with
-- "relation X does not exist": friend requests, DMs, season pass claims.
--
-- Idempotency notes:
-- * `CREATE TABLE IF NOT EXISTS` materialises the table on prod and is a
--   no-op on staging / fresh DBs that already have it.
-- * Indexes use `IF NOT EXISTS` for the same reason.
-- * Foreign keys are wrapped in DO blocks because Postgres has no
--   `ADD CONSTRAINT IF NOT EXISTS` and bare `ALTER TABLE ... ADD CONSTRAINT`
--   would error on staging where the constraint already exists.
--
-- Slotted at 20260419060000 (right after the gifts heal at 20260419050000)
-- so both heals land before 20260420000000_ensure_purchase_gift_columns,
-- which is what originally jammed prod's migration history.

-- ─── Friendship ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "friendships" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "friendships_requesterId_addresseeId_key"
  ON "friendships"("requesterId", "addresseeId");
CREATE INDEX IF NOT EXISTS "friendships_requesterId_status_idx"
  ON "friendships"("requesterId", "status");
CREATE INDEX IF NOT EXISTS "friendships_addresseeId_status_idx"
  ON "friendships"("addresseeId", "status");

-- ─── DirectMessage ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "direct_messages" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "text" VARCHAR(1000) NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "direct_messages_senderId_receiverId_idx"
  ON "direct_messages"("senderId", "receiverId");
CREATE INDEX IF NOT EXISTS "direct_messages_receiverId_createdAt_idx"
  ON "direct_messages"("receiverId", "createdAt");

-- ─── SeasonPass ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "season_passes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "season_passes_pkey" PRIMARY KEY ("id")
);

-- ─── SeasonTier ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "season_tiers" (
    "id" TEXT NOT NULL,
    "seasonPassId" TEXT NOT NULL,
    "tierNumber" INTEGER NOT NULL,
    "xpRequired" INTEGER NOT NULL,
    "rewardType" VARCHAR(20) NOT NULL,
    "rewardValue" TEXT NOT NULL,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "season_tiers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "season_tiers_seasonPassId_tierNumber_key"
  ON "season_tiers"("seasonPassId", "tierNumber");

-- ─── SeasonPassClaim ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "season_pass_claims" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonTierId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "season_pass_claims_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "season_pass_claims_userId_seasonTierId_key"
  ON "season_pass_claims"("userId", "seasonTierId");

-- ─── Foreign keys (DO-block guarded for idempotency on staging) ─────────────
DO $$
BEGIN
  -- friendships → users (Cascade per schema.prisma)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friendships_requesterId_fkey') THEN
    ALTER TABLE "friendships"
      ADD CONSTRAINT "friendships_requesterId_fkey"
      FOREIGN KEY ("requesterId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friendships_addresseeId_fkey') THEN
    ALTER TABLE "friendships"
      ADD CONSTRAINT "friendships_addresseeId_fkey"
      FOREIGN KEY ("addresseeId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- direct_messages → users (Cascade per schema.prisma)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'direct_messages_senderId_fkey') THEN
    ALTER TABLE "direct_messages"
      ADD CONSTRAINT "direct_messages_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'direct_messages_receiverId_fkey') THEN
    ALTER TABLE "direct_messages"
      ADD CONSTRAINT "direct_messages_receiverId_fkey"
      FOREIGN KEY ("receiverId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- season_tiers → season_passes (Restrict — required relation, no explicit onDelete)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'season_tiers_seasonPassId_fkey') THEN
    ALTER TABLE "season_tiers"
      ADD CONSTRAINT "season_tiers_seasonPassId_fkey"
      FOREIGN KEY ("seasonPassId") REFERENCES "season_passes"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- season_pass_claims → users + season_tiers (Restrict — required relations)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'season_pass_claims_userId_fkey') THEN
    ALTER TABLE "season_pass_claims"
      ADD CONSTRAINT "season_pass_claims_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'season_pass_claims_seasonTierId_fkey') THEN
    ALTER TABLE "season_pass_claims"
      ADD CONSTRAINT "season_pass_claims_seasonTierId_fkey"
      FOREIGN KEY ("seasonTierId") REFERENCES "season_tiers"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
