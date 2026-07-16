import { Role } from "@prisma/client";

export type AuthEligibilitySubject = {
  role: Role | string;
  tenantId: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  tenant?: {
    isActive: boolean;
    deletedAt: Date | null;
  } | null;
};

export function isEligibleForAuthentication<T extends AuthEligibilitySubject>(
  subject: T | null | undefined,
): subject is T {
  if (!subject || !subject.isActive || subject.deletedAt) return false;
  if (subject.role === Role.GLOBAL_ADMIN) return true;
  return Boolean(
    subject.tenantId &&
    subject.tenant &&
    subject.tenant.isActive &&
    !subject.tenant.deletedAt,
  );
}
