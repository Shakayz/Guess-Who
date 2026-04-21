-- Add isPublic discoverability flag to rooms so hosts can surface Custom
-- Lobbies in the "Join Public Lobby" browser without affecting pricing.
-- Pricing stays tied to isPrivate (host-pays vs player-pays); isPublic is
-- purely a visibility toggle on top of the existing custom-lobby model.
--
-- Idempotent so re-running against a staging DB that already has the column
-- (manual hotfix, partially-applied run) is safe.

ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT FALSE;

-- Composite index to make the GET /rooms/public list query
--   WHERE "isPublic" = true AND "status" = 'waiting'
-- an index scan instead of a table scan once lobby traffic grows.
CREATE INDEX IF NOT EXISTS "rooms_isPublic_status_idx" ON "rooms"("isPublic", "status");
