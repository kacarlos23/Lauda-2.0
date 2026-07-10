CREATE TABLE "Permission" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserPermission" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "tenantId" TEXT,
  "grantedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");
CREATE INDEX "Permission_category_idx" ON "Permission"("category");
CREATE UNIQUE INDEX "UserPermission_userId_permissionId_tenantId_key" ON "UserPermission"("userId", "permissionId", "tenantId");
CREATE UNIQUE INDEX "UserPermission_userId_permissionId_global_key" ON "UserPermission"("userId", "permissionId") WHERE "tenantId" IS NULL;
CREATE INDEX "UserPermission_userId_tenantId_idx" ON "UserPermission"("userId", "tenantId");
CREATE INDEX "UserPermission_tenantId_idx" ON "UserPermission"("tenantId");
CREATE INDEX "UserPermission_permissionId_idx" ON "UserPermission"("permissionId");
CREATE INDEX "UserPermission_grantedById_idx" ON "UserPermission"("grantedById");

ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Permission" ("id", "key", "description", "category", "updatedAt") VALUES
  (gen_random_uuid(), 'schedule:create', 'Criar escalas', 'Escalas', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'schedule:view', 'Visualizar escalas', 'Escalas', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'schedule:edit', 'Editar escalas', 'Escalas', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'schedule:delete', 'Excluir escalas', 'Escalas', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'schedule:assign_members', 'Escalar membros', 'Escalas', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'schedule:respond', 'Responder escalas próprias', 'Escalas', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'schedule:view_reports', 'Visualizar relatórios de escalas', 'Escalas', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'song:create', 'Criar músicas', 'Músicas', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'song:view', 'Visualizar músicas', 'Músicas', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'song:edit', 'Editar músicas', 'Músicas', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'song:delete', 'Excluir músicas', 'Músicas', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'song:attach_to_schedule', 'Anexar músicas a escalas', 'Músicas', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'member:create', 'Criar membros', 'Membros', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'member:view', 'Visualizar membros', 'Membros', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'member:edit', 'Editar membros', 'Membros', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'member:delete', 'Excluir membros', 'Membros', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'member:invite', 'Convidar membros', 'Membros', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'member:assign_ministry', 'Atribuir ministérios a membros', 'Membros', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'member:assign_permissions', 'Atribuir permissões legadas de membros', 'Membros', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ministry:create', 'Criar ministérios', 'Ministérios', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ministry:view', 'Visualizar ministérios', 'Ministérios', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ministry:edit', 'Editar ministérios', 'Ministérios', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ministry:delete', 'Excluir ministérios', 'Ministérios', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ministry:assign_members', 'Atribuir membros a ministérios', 'Ministérios', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'instrument:create', 'Criar instrumentos/cargos', 'Instrumentos/cargos', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'instrument:view', 'Visualizar instrumentos/cargos', 'Instrumentos/cargos', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'instrument:edit', 'Editar instrumentos/cargos', 'Instrumentos/cargos', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'instrument:delete', 'Excluir instrumentos/cargos', 'Instrumentos/cargos', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'reports:view', 'Visualizar relatórios', 'Relatórios', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'permissions:manage', 'Gerenciar permissões granulares', 'Admin', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'tenant:manage', 'Gerenciar igrejas/tenants', 'Admin', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "updatedAt" = CURRENT_TIMESTAMP;
