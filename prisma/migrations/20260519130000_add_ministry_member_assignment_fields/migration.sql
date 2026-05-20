CREATE TYPE "MemberStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE');

ALTER TABLE "MinistryMember" ADD COLUMN "roleId" TEXT;
ALTER TABLE "MinistryMember" ADD COLUMN "role" TEXT;
ALTER TABLE "MinistryMember" ADD COLUMN "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "MinistryMember" ADD COLUMN "status" "MemberStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "MinistryMember" ADD COLUMN "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "MinistryMember" ADD COLUMN "notes" TEXT;

CREATE INDEX "MinistryMember_ministryId_status_idx" ON "MinistryMember"("ministryId", "status");
