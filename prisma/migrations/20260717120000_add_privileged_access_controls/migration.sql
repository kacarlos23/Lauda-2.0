-- Etapa 3: MFA/step-up state and scoped, expiring support access.
ALTER TABLE "User"
  ADD COLUMN "mfaSecretEncrypted" TEXT,
  ADD COLUMN "mfaEnabledAt" TIMESTAMP(3);

ALTER TABLE "AuthSession"
  ADD COLUMN "mfaVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "stepUpExpiresAt" TIMESTAMP(3);

CREATE TABLE "SupportAccessGrant" (
  "id" TEXT NOT NULL,
  "granteeId" TEXT NOT NULL,
  "grantedById" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "resourceId" TEXT,
  "scopes" TEXT[] NOT NULL,
  "ticketReference" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "boundSessionId" TEXT,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokeReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportAccessGrant_granteeId_revokedAt_expiresAt_idx"
  ON "SupportAccessGrant"("granteeId", "revokedAt", "expiresAt");
CREATE INDEX "SupportAccessGrant_tenantId_resource_resourceId_idx"
  ON "SupportAccessGrant"("tenantId", "resource", "resourceId");
CREATE INDEX "SupportAccessGrant_grantedById_idx" ON "SupportAccessGrant"("grantedById");
CREATE INDEX "SupportAccessGrant_boundSessionId_idx" ON "SupportAccessGrant"("boundSessionId");

ALTER TABLE "SupportAccessGrant"
  ADD CONSTRAINT "SupportAccessGrant_granteeId_fkey"
  FOREIGN KEY ("granteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportAccessGrant"
  ADD CONSTRAINT "SupportAccessGrant_grantedById_fkey"
  FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportAccessGrant"
  ADD CONSTRAINT "SupportAccessGrant_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
