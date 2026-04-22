-- Adds the `blocks` and `reports` tables. Both models existed in schema.prisma
-- but had no corresponding migration, so the DB was missing the tables and any
-- call to `prisma.report.create()` / `prisma.block.create()` failed with a 500
-- (e.g. the in-app "Report Player" modal showed "Internal Server Error").

CREATE TABLE IF NOT EXISTS "blocks" (
  "id"        TEXT NOT NULL,
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "blocks_blockerId_blockedId_key"
  ON "blocks"("blockerId", "blockedId");

ALTER TABLE "blocks"
  ADD CONSTRAINT "blocks_blockerId_fkey"
  FOREIGN KEY ("blockerId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "blocks"
  ADD CONSTRAINT "blocks_blockedId_fkey"
  FOREIGN KEY ("blockedId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "reports" (
  "id"         TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "reportedId" TEXT NOT NULL,
  "reason"     VARCHAR(50) NOT NULL,
  "details"    TEXT,
  "status"     VARCHAR(20) NOT NULL DEFAULT 'pending',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "reports_reportedId_status_idx"
  ON "reports"("reportedId", "status");

ALTER TABLE "reports"
  ADD CONSTRAINT "reports_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reports"
  ADD CONSTRAINT "reports_reportedId_fkey"
  FOREIGN KEY ("reportedId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
