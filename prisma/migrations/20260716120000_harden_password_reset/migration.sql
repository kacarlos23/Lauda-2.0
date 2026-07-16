-- Existing plaintext reset PINs are invalidated instead of being migrated.
UPDATE "User"
SET
  "resetPasswordToken" = NULL,
  "resetPasswordExpires" = NULL;

ALTER TABLE "User"
  ADD COLUMN "resetPasswordChallengeId" TEXT,
  ADD COLUMN "resetPasswordPepperVersion" INTEGER,
  ADD COLUMN "resetPasswordAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "resetPasswordConsumedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_resetPasswordChallengeId_key"
  ON "User"("resetPasswordChallengeId");
