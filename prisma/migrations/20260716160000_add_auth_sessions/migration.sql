-- Additive server-side session and refresh-token family storage.
CREATE TABLE "AuthSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokeReason" TEXT,
  CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshTokenFamily" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokeReason" TEXT,
  CONSTRAINT "RefreshTokenFamily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshToken" (
  "id" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "jti" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "replacedByJti" TEXT,
  CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RefreshTokenFamily_sessionId_key" ON "RefreshTokenFamily"("sessionId");
CREATE INDEX "RefreshTokenFamily_revokedAt_idx" ON "RefreshTokenFamily"("revokedAt");
CREATE UNIQUE INDEX "RefreshToken_jti_key" ON "RefreshToken"("jti");
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_familyId_consumedAt_idx" ON "RefreshToken"("familyId", "consumedAt");
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");
CREATE INDEX "AuthSession_tenantId_revokedAt_idx" ON "AuthSession"("tenantId", "revokedAt");
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefreshTokenFamily" ADD CONSTRAINT "RefreshTokenFamily_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AuthSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_familyId_fkey"
  FOREIGN KEY ("familyId") REFERENCES "RefreshTokenFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;
