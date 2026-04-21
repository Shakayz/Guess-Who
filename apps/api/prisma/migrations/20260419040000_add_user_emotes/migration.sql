-- Emotes feature: per-user ownership of purchased in-game reactions plus the
-- player's active loadout (which 10 emotes show up on the React bar).
--
-- Free emotes are NOT persisted here — they're implicitly granted by the
-- resolution layer (see apps/api/src/routes/emotes.ts). Only paid-for items
-- land in user_emotes.

-- Ownership column on users: JSON-encoded array of emote ids in display order.
-- NULL == "use default loadout" (the 5 free basics) so brand-new accounts
-- don't need a backfill step.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "equippedEmotes" TEXT;

-- Ownership table: a row here means the user paid for (and owns) the emote.
-- Unique (userId, emoteId) prevents double-purchase; the purchase endpoint
-- also checks ownership before charging.
CREATE TABLE IF NOT EXISTS "user_emotes" (
  "id"         TEXT PRIMARY KEY,
  "userId"     TEXT NOT NULL,
  "emoteId"    VARCHAR(40) NOT NULL,
  "priceCents" INTEGER NOT NULL DEFAULT 0,
  "starCoins"  INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_emotes_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_emotes_userId_emoteId_key"
  ON "user_emotes"("userId", "emoteId");

CREATE INDEX IF NOT EXISTS "user_emotes_userId_idx"
  ON "user_emotes"("userId");
