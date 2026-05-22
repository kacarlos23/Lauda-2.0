ALTER TABLE "MemberInvite" ADD COLUMN "ministryId" TEXT;

CREATE INDEX "MemberInvite_ministryId_idx" ON "MemberInvite"("ministryId");

ALTER TABLE "MemberInvite" ADD CONSTRAINT "MemberInvite_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
