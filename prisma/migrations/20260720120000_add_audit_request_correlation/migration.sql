ALTER TABLE "AdminAuditLog" ADD COLUMN "requestId" TEXT;

CREATE INDEX "AdminAuditLog_requestId_idx" ON "AdminAuditLog"("requestId");
