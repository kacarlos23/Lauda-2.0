CREATE TABLE "ScheduleSong" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "songId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScheduleSong_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScheduleSong_scheduleId_songId_key" ON "ScheduleSong"("scheduleId", "songId");
CREATE INDEX "ScheduleSong_tenantId_idx" ON "ScheduleSong"("tenantId");
CREATE INDEX "ScheduleSong_songId_idx" ON "ScheduleSong"("songId");

ALTER TABLE "ScheduleSong" ADD CONSTRAINT "ScheduleSong_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleSong" ADD CONSTRAINT "ScheduleSong_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleSong" ADD CONSTRAINT "ScheduleSong_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
