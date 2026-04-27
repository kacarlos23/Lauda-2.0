-- Add tenantId to join/assignment tables in a way that can run on existing data.
ALTER TABLE "MinistryMember" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ScheduleAssignment" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "MinistrySong" ADD COLUMN "tenantId" TEXT;

UPDATE "MinistryMember" mm
SET "tenantId" = m."tenantId"
FROM "Ministry" m
WHERE mm."ministryId" = m."id";

UPDATE "ScheduleAssignment" sa
SET "tenantId" = s."tenantId"
FROM "Schedule" s
WHERE sa."scheduleId" = s."id";

UPDATE "MinistrySong" ms
SET "tenantId" = m."tenantId"
FROM "Ministry" m
WHERE ms."ministryId" = m."id";

ALTER TABLE "MinistryMember" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "ScheduleAssignment" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "MinistrySong" ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX "MinistryMember_tenantId_idx" ON "MinistryMember"("tenantId");
CREATE INDEX "ScheduleAssignment_tenantId_idx" ON "ScheduleAssignment"("tenantId");
CREATE INDEX "MinistrySong_tenantId_idx" ON "MinistrySong"("tenantId");

ALTER TABLE "MinistryMember" ADD CONSTRAINT "MinistryMember_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MinistrySong" ADD CONSTRAINT "MinistrySong_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
