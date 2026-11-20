export const CURRENT_ONBOARDING_VERSION = "v1";

export type OnboardingStatusValue = "not_started" | "dismissed" | "completed";
export type PrismaOnboardingStatusValue = "NOT_STARTED" | "DISMISSED" | "COMPLETED";

export type OnboardingStateView = {
  version: string;
  status: OnboardingStatusValue;
  shouldAutoStart: boolean;
  completedAt: string | null;
  dismissedAt: string | null;
  updatedAt: string | null;
};

export type UserOnboardingRecordLike = {
  version: string;
  status: PrismaOnboardingStatusValue;
  completedAt: Date | null;
  dismissedAt: Date | null;
  updatedAt: Date;
};

export function fromPrismaOnboardingStatus(status: PrismaOnboardingStatusValue): OnboardingStatusValue {
  switch (status) {
    case "COMPLETED":
      return "completed";
    case "DISMISSED":
      return "dismissed";
    default:
      return "not_started";
  }
}

export function toPrismaOnboardingStatus(status: OnboardingStatusValue): PrismaOnboardingStatusValue {
  switch (status) {
    case "completed":
      return "COMPLETED";
    case "dismissed":
      return "DISMISSED";
    default:
      return "NOT_STARTED";
  }
}

export function toOnboardingStateView(
  record?: UserOnboardingRecordLike | null,
  version = CURRENT_ONBOARDING_VERSION
): OnboardingStateView {
  if (!record) {
    return {
      version,
      status: "not_started",
      shouldAutoStart: false,
      completedAt: null,
      dismissedAt: null,
      updatedAt: null,
    };
  }

  return {
    version: record.version || version,
    status: fromPrismaOnboardingStatus(record.status),
    shouldAutoStart: record.status === "NOT_STARTED",
    completedAt: record.completedAt ? record.completedAt.toISOString() : null,
    dismissedAt: record.dismissedAt ? record.dismissedAt.toISOString() : null,
    updatedAt: record.updatedAt.toISOString(),
  };
}
