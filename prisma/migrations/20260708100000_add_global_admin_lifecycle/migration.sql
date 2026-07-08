ALTER TABLE "Tenant" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tenant" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "MemberInvite" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MemberInvite" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Instrument" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Instrument" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "UserInstrument" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserInstrument" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Ministry" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Ministry" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "MinistryMember" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MinistryMember" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Schedule" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Schedule" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "ScheduleSong" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ScheduleSong" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "ScheduleAssignment" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ScheduleAssignment" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Song" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Song" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Artist" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Artist" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "MinistrySong" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MinistrySong" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE TABLE "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorRole" "Role" NOT NULL,
  "action" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "resourceId" TEXT,
  "tenantId" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminAuditLog_actorId_idx" ON "AdminAuditLog"("actorId");
CREATE INDEX "AdminAuditLog_resource_resourceId_idx" ON "AdminAuditLog"("resource", "resourceId");
CREATE INDEX "AdminAuditLog_tenantId_idx" ON "AdminAuditLog"("tenantId");
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
