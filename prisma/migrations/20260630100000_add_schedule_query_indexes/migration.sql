CREATE INDEX IF NOT EXISTS "Schedule_tenantId_date_idx" ON "Schedule"("tenantId", "date");
CREATE INDEX IF NOT EXISTS "Schedule_tenantId_ministryId_date_idx" ON "Schedule"("tenantId", "ministryId", "date");
CREATE INDEX IF NOT EXISTS "ScheduleSong_tenantId_scheduleId_idx" ON "ScheduleSong"("tenantId", "scheduleId");
CREATE INDEX IF NOT EXISTS "ScheduleAssignment_tenantId_userId_idx" ON "ScheduleAssignment"("tenantId", "userId");
CREATE INDEX IF NOT EXISTS "ScheduleAssignment_tenantId_status_idx" ON "ScheduleAssignment"("tenantId", "status");
