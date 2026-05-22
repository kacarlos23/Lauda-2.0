-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "MinistryMember"
ADD COLUMN "roleId" TEXT,
ADD COLUMN "role" TEXT,
ADD COLUMN "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "status" "MemberStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "notes" TEXT;

-- CreateIndex
CREATE INDEX "MinistryMember_ministryId_status_idx" ON "MinistryMember"("ministryId", "status");
