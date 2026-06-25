ALTER TABLE "Song" RENAME COLUMN "musicalKey" TO "originalKey";
ALTER TABLE "Song" RENAME COLUMN "chordText" TO "content";
ALTER TABLE "Song" ADD COLUMN "bpm" INTEGER;

ALTER TABLE "Song"
ADD CONSTRAINT "Song_bpm_check" CHECK ("bpm" IS NULL OR ("bpm" >= 30 AND "bpm" <= 300));
