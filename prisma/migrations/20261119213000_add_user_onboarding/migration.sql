CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'DISMISSED', 'COMPLETED');

CREATE TABLE "UserOnboarding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "status" "OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserOnboarding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserOnboarding_tenantId_userId_version_key" ON "UserOnboarding"("tenantId", "userId", "version");
CREATE INDEX "UserOnboarding_tenantId_userId_idx" ON "UserOnboarding"("tenantId", "userId");
CREATE INDEX "UserOnboarding_userId_idx" ON "UserOnboarding"("userId");

ALTER TABLE "UserOnboarding"
ADD CONSTRAINT "UserOnboarding_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserOnboarding"
ADD CONSTRAINT "UserOnboarding_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
