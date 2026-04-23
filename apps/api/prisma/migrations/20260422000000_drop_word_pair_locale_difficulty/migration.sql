-- DropIndex: old (packId, locale, category) composite
DROP INDEX IF EXISTS "word_pairs_packId_locale_category_idx";

-- DropColumn: WordPair.locale is redundant with WordPack.locale
ALTER TABLE "word_pairs" DROP COLUMN IF EXISTS "locale";

-- DropColumn: WordPair.difficulty is authored in seed but never read by
-- gameplay — removing it to eliminate dead schema weight.
ALTER TABLE "word_pairs" DROP COLUMN IF EXISTS "difficulty";

-- CreateIndex: pack + category is all the game actually filters by
CREATE INDEX "word_pairs_packId_category_idx" ON "word_pairs"("packId", "category");
