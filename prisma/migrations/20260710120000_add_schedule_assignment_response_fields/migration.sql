ALTER TABLE "ScheduleAssignment"
  ADD COLUMN "declineReason" TEXT,
  ADD COLUMN "substituteRequestedAt" TIMESTAMP(3),
  ADD COLUMN "substituteResolvedAt" TIMESTAMP(3),
  ADD COLUMN "substituteResolvedById" TEXT,
  ADD COLUMN "substituteResolutionNote" TEXT;

CREATE INDEX "ScheduleAssignment_tenantId_substituteRequestedAt_substituteResolvedAt_idx"
  ON "ScheduleAssignment"("tenantId", "substituteRequestedAt", "substituteResolvedAt");
