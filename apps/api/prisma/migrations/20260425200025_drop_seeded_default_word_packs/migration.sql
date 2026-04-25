-- Drop the system-seeded default WordPacks and their pairs.
-- These were created by the legacy seed script (one per locale: "General",
-- "Général", "Allgemein", ...) but were never queried at runtime — rooms
-- with wordPackId = 'default' (every default room) shortcut to the bundled
-- pickRandomWordPair offline source. The DB rows are dead weight.
--
-- WordPack/WordPair tables are preserved for user-authored and premium
-- packs (authorId IS NOT NULL).

-- Defensive: any room that somehow points at a system pack reverts to default.
UPDATE "rooms"
SET    "wordPackId" = 'default'
WHERE  "wordPackId" IN (SELECT "id" FROM "word_packs" WHERE "authorId" IS NULL);

-- word_pairs.packId has ON DELETE RESTRICT, so pairs must go first.
DELETE FROM "word_pairs"
WHERE "packId" IN (SELECT "id" FROM "word_packs" WHERE "authorId" IS NULL);

DELETE FROM "word_packs"
WHERE "authorId" IS NULL;
