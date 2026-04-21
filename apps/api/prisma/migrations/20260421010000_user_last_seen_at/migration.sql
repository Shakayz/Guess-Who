-- Adds the `lastSeenAt` column used to surface a friend's last connection
-- time on their profile. Written from the socket connect/disconnect handlers.
-- Only exposed to accepted friends via the profile endpoint; non-friends
-- never see it.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);
