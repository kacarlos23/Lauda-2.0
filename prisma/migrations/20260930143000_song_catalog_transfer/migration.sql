INSERT INTO "Permission" ("id", "key", "description", "category", "assignable", "updatedAt") VALUES
  (gen_random_uuid(), 'song:import', 'Importar catálogo de músicas', 'Músicas', true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'song:export', 'Exportar catálogo de músicas', 'Músicas', true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "assignable" = EXCLUDED."assignable",
  "updatedAt" = CURRENT_TIMESTAMP;

CREATE INDEX "MinistrySong_tenantId_ministryId_isActive_deletedAt_idx"
  ON "MinistrySong"("tenantId", "ministryId", "isActive", "deletedAt");

CREATE INDEX "MinistrySong_tenantId_songId_isActive_deletedAt_idx"
  ON "MinistrySong"("tenantId", "songId", "isActive", "deletedAt");
