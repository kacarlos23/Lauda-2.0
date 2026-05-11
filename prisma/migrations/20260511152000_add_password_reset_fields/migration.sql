ALTER TABLE "User" ADD COLUMN "resetPasswordToken" TEXT;
ALTER TABLE "User" ADD COLUMN "resetPasswordExpires" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_resetPasswordToken_key" ON "User"("resetPasswordToken");
