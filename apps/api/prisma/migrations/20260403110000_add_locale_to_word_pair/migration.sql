-- AddColumn: locale to word_pairs
ALTER TABLE "word_pairs" ADD COLUMN "locale" VARCHAR(5) NOT NULL DEFAULT 'en';

-- CreateIndex: speed up filtering by pack + locale + category
CREATE INDEX "word_pairs_packId_locale_category_idx" ON "word_pairs"("packId", "locale", "category");
