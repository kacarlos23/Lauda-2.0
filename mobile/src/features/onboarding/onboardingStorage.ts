import { deleteSessionItem, getSessionItem, setSessionItem } from "../../services/sessionStorage";
import { CURRENT_ONBOARDING_VERSION } from "./steps";

export type LocalOnboardingProgress = {
  stepIndex: number;
  dismissedLocally?: boolean;
  awaitingInstrumentLink?: boolean;
};

export function onboardingScopeKeyFor(user: { id: string; tenantId: string | null }): string {
  return `${user.tenantId ?? "global"}:${user.id}:${CURRENT_ONBOARDING_VERSION}`;
}

function storageKey(scopeKey: string): string {
  return `lauda_onboarding_${scopeKey}`;
}

export async function loadLocalOnboardingProgress(scopeKey: string): Promise<LocalOnboardingProgress | null> {
  try {
    const raw = await getSessionItem(storageKey(scopeKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalOnboardingProgress>;
    if (typeof parsed.stepIndex !== "number" || !Number.isInteger(parsed.stepIndex) || parsed.stepIndex < 0) {
      return null;
    }
    return {
      stepIndex: parsed.stepIndex,
      ...(parsed.dismissedLocally ? { dismissedLocally: true } : {}),
      ...(parsed.awaitingInstrumentLink ? { awaitingInstrumentLink: true } : {}),
    };
  } catch {
    return null;
  }
}

export async function saveLocalOnboardingProgress(
  scopeKey: string,
  progress: LocalOnboardingProgress
): Promise<void> {
  try {
    await setSessionItem(storageKey(scopeKey), JSON.stringify(progress));
  } catch {
    // Persistence errors must not block navigation.
  }
}

export async function clearLocalOnboardingProgress(scopeKey: string): Promise<void> {
  try {
    await deleteSessionItem(storageKey(scopeKey));
  } catch {
    // Persistence errors must not block navigation.
  }
}
