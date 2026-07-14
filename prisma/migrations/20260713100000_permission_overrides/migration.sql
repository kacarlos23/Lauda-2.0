CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');

ALTER TABLE "Permission"
  ADD COLUMN "assignable" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "UserPermission"
  ADD COLUMN "effect" "PermissionEffect" NOT NULL DEFAULT 'ALLOW';

UPDATE "Permission"
SET "key" = 'member:manage_access',
    "description" = 'Gerenciar papel e vínculos do membro',
    "category" = 'Membros',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'member:assign_permissions'
  AND NOT EXISTS (SELECT 1 FROM "Permission" WHERE "key" = 'member:manage_access');

DELETE FROM "Permission" WHERE "key" = 'reports:view';

INSERT INTO "Permission" ("id", "key", "description", "category", "assignable", "updatedAt") VALUES
  (gen_random_uuid(), 'member:manage_access', 'Gerenciar papel e vínculos do membro', 'Membros', true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'permissions:manage', 'Gerenciar permissões granulares', 'Admin', false, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "assignable" = EXCLUDED."assignable",
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "Permission"
SET "assignable" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'permissions:manage';
