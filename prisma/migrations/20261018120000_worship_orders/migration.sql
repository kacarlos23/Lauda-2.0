ALTER TABLE "ScheduleSong" ADD COLUMN "moment" TEXT NOT NULL DEFAULT 'Louvor',
ADD COLUMN "momentDescription" TEXT, ADD COLUMN "videoUrlOverride" TEXT;
CREATE TABLE "WorshipOrder" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "date" VARCHAR(10) NOT NULL,
  "morningScheduleId" TEXT, "eveningScheduleId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorshipOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorshipOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorshipOrder_morningScheduleId_fkey" FOREIGN KEY ("morningScheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "WorshipOrder_eveningScheduleId_fkey" FOREIGN KEY ("eveningScheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WorshipOrder_tenantId_date_key" ON "WorshipOrder"("tenantId", "date");
