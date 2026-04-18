-- One-time "share the app on social media" reward. POST /users/me/claim-share-reward
-- flips this column from NULL to the claim timestamp and credits
-- SOCIAL_SHARE_REWARD stars. The atomic updateMany guard (WHERE sharedAppAt
-- IS NULL) prevents concurrent calls from double-crediting. Nullable so
-- existing rows stay valid; old users can claim on their next visit.
ALTER TABLE "users"
  ADD COLUMN "sharedAppAt" TIMESTAMP(3);
