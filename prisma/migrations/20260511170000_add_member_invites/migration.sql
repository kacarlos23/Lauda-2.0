CREATE TABLE "MemberInvite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberInvite_code_key" ON "MemberInvite"("code");
CREATE INDEX "MemberInvite_tenantId_idx" ON "MemberInvite"("tenantId");
CREATE INDEX "MemberInvite_active_idx" ON "MemberInvite"("active");

ALTER TABLE "MemberInvite" ADD CONSTRAINT "MemberInvite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
