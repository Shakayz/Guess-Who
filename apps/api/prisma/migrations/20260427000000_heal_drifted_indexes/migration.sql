-- Heal: index drift between schema.prisma and migrations.
--
-- These `@@index` entries were added directly to schema.prisma without
-- generating a corresponding migration, so prod is missing them (slow
-- queries on hot paths — leaderboard sort, game history, vote tallies)
-- and `prisma migrate diff` reports drift. Same recurrence pattern as
-- the missing table heals (see 20260419050000_add_gifts_table).
--
-- `CREATE INDEX IF NOT EXISTS` makes each statement a no-op on staging /
-- environments where the index was created out-of-band via `prisma db
-- push`. Names match the Prisma generated convention (`<table>_<col>_idx`)
-- so future `prisma migrate dev` runs reconcile rather than duplicate.

-- Hot path: leaderboard ordering by rankPoints DESC
CREATE INDEX IF NOT EXISTS "users_rankPoints_idx" ON "users"("rankPoints" DESC);

-- Hot path: game history per room, newest first
CREATE INDEX IF NOT EXISTS "games_roomId_startedAt_idx" ON "games"("roomId", "startedAt" DESC);

-- Hot path: round lookup by parent game
CREATE INDEX IF NOT EXISTS "rounds_gameId_idx" ON "rounds"("gameId");

-- Hot path: vote tally per round, voter dedup
CREATE INDEX IF NOT EXISTS "round_votes_roundId_idx" ON "round_votes"("roundId");
CREATE INDEX IF NOT EXISTS "round_votes_voterId_idx" ON "round_votes"("voterId");

-- Hot path: clue list per round
CREATE INDEX IF NOT EXISTS "round_clues_roundId_idx" ON "round_clues"("roundId");

-- Hot path: per-user game history (recent-first), per-game participant list
CREATE INDEX IF NOT EXISTS "game_participations_userId_idx" ON "game_participations"("userId");
CREATE INDEX IF NOT EXISTS "game_participations_gameId_idx" ON "game_participations"("gameId");
CREATE INDEX IF NOT EXISTS "game_participations_userId_createdAt_idx" ON "game_participations"("userId", "createdAt" DESC);

-- Hot path: honors received feed
CREATE INDEX IF NOT EXISTS "honors_receiverId_idx" ON "honors"("receiverId");

-- Stale index: created by 20260409010000_game_game_mode, but the matching
-- `@@index([gameMode])` was later removed from the Game model without a
-- DROP INDEX migration. Drop it here so the DB matches schema.prisma.
DROP INDEX IF EXISTS "games_gameMode_idx";
