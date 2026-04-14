-- Track whether a user has completed the interactive first-game tutorial.
-- Once true, the 50-star completion reward is NOT granted again.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "tutorialCompleted" BOOLEAN NOT NULL DEFAULT false;
