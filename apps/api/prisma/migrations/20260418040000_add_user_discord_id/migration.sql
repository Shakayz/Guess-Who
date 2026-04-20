-- Discord OAuth provider ID on User.
--
-- Mirrors `googleId` and `appleId` — nullable (a user may link at most one of
-- each provider), uniquely indexed so /auth/discord/verify can look the user
-- up by Discord's stable `id` without a table scan. Email verification is
-- bypassed for Discord sign-ins just like Google/Apple, so no other columns
-- need changing here.

ALTER TABLE "users"
  ADD COLUMN "discordId" TEXT;

CREATE UNIQUE INDEX "users_discordId_key" ON "users"("discordId");
