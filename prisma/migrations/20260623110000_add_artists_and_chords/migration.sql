CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "imageUrl" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Artist_tenantId_normalizedName_key" ON "Artist"("tenantId", "normalizedName");
CREATE INDEX "Artist_tenantId_name_idx" ON "Artist"("tenantId", "name");

ALTER TABLE "Artist"
ADD CONSTRAINT "Artist_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Song"
ADD COLUMN "normalizedTitle" TEXT,
ADD COLUMN "composer" TEXT,
ADD COLUMN "musicalKey" TEXT,
ADD COLUMN "chordText" TEXT,
ADD COLUMN "artistId" TEXT,
ADD COLUMN "createdById" TEXT,
ADD COLUMN "updatedById" TEXT;

INSERT INTO "Artist" ("id", "name", "normalizedName", "tenantId", "updatedAt")
SELECT gen_random_uuid()::text,
       min(btrim("artist")),
       lower(regexp_replace(btrim("artist"), '\s+', ' ', 'g')),
       "tenantId",
       CURRENT_TIMESTAMP
FROM "Song"
WHERE "artist" IS NOT NULL AND btrim("artist") <> ''
GROUP BY "tenantId", lower(regexp_replace(btrim("artist"), '\s+', ' ', 'g'));

INSERT INTO "Artist" ("id", "name", "normalizedName", "tenantId", "updatedAt")
SELECT gen_random_uuid()::text, 'Artista desconhecido', 'artista desconhecido', "tenantId", CURRENT_TIMESTAMP
FROM "Song"
WHERE "artist" IS NULL OR btrim("artist") = ''
GROUP BY "tenantId";

UPDATE "Song" AS song
SET "normalizedTitle" = lower(regexp_replace(btrim(song."title"), '\s+', ' ', 'g')),
    "musicalKey" = 'C',
    "chordText" = '',
    "artistId" = artist."id"
FROM "Artist" AS artist
WHERE artist."tenantId" = song."tenantId"
  AND artist."normalizedName" = CASE
      WHEN song."artist" IS NULL OR btrim(song."artist") = '' THEN 'artista desconhecido'
      ELSE lower(regexp_replace(btrim(song."artist"), '\s+', ' ', 'g'))
  END;

ALTER TABLE "Song"
ALTER COLUMN "normalizedTitle" SET NOT NULL,
ALTER COLUMN "musicalKey" SET NOT NULL,
ALTER COLUMN "chordText" SET NOT NULL,
ALTER COLUMN "artistId" SET NOT NULL,
DROP COLUMN "artist",
DROP COLUMN "bpm";

CREATE UNIQUE INDEX "Song_tenantId_artistId_normalizedTitle_key"
ON "Song"("tenantId", "artistId", "normalizedTitle");
CREATE INDEX "Song_tenantId_normalizedTitle_idx" ON "Song"("tenantId", "normalizedTitle");
CREATE INDEX "Song_tenantId_artistId_idx" ON "Song"("tenantId", "artistId");

ALTER TABLE "Song"
ADD CONSTRAINT "Song_artistId_fkey"
FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Song"
ADD CONSTRAINT "Song_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Song"
ADD CONSTRAINT "Song_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
