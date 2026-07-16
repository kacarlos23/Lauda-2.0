# Password reset migration notes

## Forward deployment

This migration is additive at the schema level and deliberately invalidates
every legacy plaintext reset PIN before adding challenge metadata. Existing
users, password hashes, tenant links, and authentication data are unchanged;
only pending password-reset flows must be requested again.

Before applying it, take and verify a database backup and stop or block the
forgot/reset endpoints. Keep those endpoints blocked until every old
application instance has been replaced. Otherwise, an old instance could write
a new plaintext PIN after the invalidation statement and before the secure
application rollout.

## Rollback

The rollback is schema-only and must not restore legacy reset PINs. Stop reset
traffic, deploy a safe compatibility build that does not read the added columns,
then run the following reviewed SQL:

```sql
DROP INDEX IF EXISTS "User_resetPasswordChallengeId_key";

ALTER TABLE "User"
  DROP COLUMN IF EXISTS "resetPasswordChallengeId",
  DROP COLUMN IF EXISTS "resetPasswordPepperVersion",
  DROP COLUMN IF EXISTS "resetPasswordAttempts",
  DROP COLUMN IF EXISTS "resetPasswordConsumedAt";
```

Dropping these columns removes only Stage 1 challenge metadata. Do not roll back
to the prior plaintext-PIN implementation. If no safe compatibility build is
available, keep password-reset endpoints disabled while the incident is
resolved. The invalidation performed by the forward migration is intentionally
irreversible.
