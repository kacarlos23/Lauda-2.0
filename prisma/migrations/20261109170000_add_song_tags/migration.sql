CREATE TABLE "SongTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SongTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SongTag_tenantId_normalizedName_key" ON "SongTag"("tenantId", "normalizedName");
CREATE INDEX "SongTag_tenantId_name_idx" ON "SongTag"("tenantId", "name");

ALTER TABLE "SongTag"
ADD CONSTRAINT "SongTag_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SongTagAssignment" (
    "songId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "SongTagAssignment_pkey" PRIMARY KEY ("songId", "tagId")
);

CREATE INDEX "SongTagAssignment_tenantId_tagId_idx" ON "SongTagAssignment"("tenantId", "tagId");
CREATE INDEX "SongTagAssignment_tenantId_songId_idx" ON "SongTagAssignment"("tenantId", "songId");

ALTER TABLE "SongTagAssignment"
ADD CONSTRAINT "SongTagAssignment_songId_fkey"
FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SongTagAssignment"
ADD CONSTRAINT "SongTagAssignment_tagId_fkey"
FOREIGN KEY ("tagId") REFERENCES "SongTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SongTagAssignment"
ADD CONSTRAINT "SongTagAssignment_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
