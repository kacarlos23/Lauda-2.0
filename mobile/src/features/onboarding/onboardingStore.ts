import { create } from "zustand";
import { memberService } from "../../services/memberService";
import type { User, UserOnboardingState } from "../../types";
import {
  clearLocalOnboardingProgress,
  loadLocalOnboardingProgress,
  onboardingScopeKeyFor,
  saveLocalOnboardingProgress,
} from "./onboardingStorage";
import { CURRENT_ONBOARDING_VERSION } from "./steps";

interface OnboardingStoreState {
  visible: boolean;
  stepIndex: number;
  reviewMode: boolean;
  saving: boolean;
  error: string | null;
  awaitingInstrumentLink: boolean;
  activeScopeKey: string | null;
  initializedScopes: Record<string, true>;
  dismissedScopes: Record<string, true>;

  syncForUser: (user: User | null) => Promise<void>;
  startReview: (user: User | null) => void;
  setStepIndex: (stepIndex: number, user: User | null) => void;
  nextStep: (totalSteps: number, user: User | null) => void;
  prevStep: (user: User | null) => void;
  openProfileInstruments: (user: User | null) => void;
  skipTutorial: (user: User | null) => Promise<void>;
  completeTutorial: (user: User | null) => Promise<void>;
  reset: () => void;
}

function applyUserOnboarding(onboarding: UserOnboardingState): void {
  try {
    const authModule = require("../../store/authStore") as typeof import("../../store/authStore");
    const apply = authModule.useAuthStore?.getState?.().applyCurrentUser;
    if (typeof apply === "function") {
      void apply({ onboarding });
    }
  } catch {
    // Store might not be mounted in isolated unit tests.
  }
}

export const useOnboardingStore = create<OnboardingStoreState>((set, get) => ({
  visible: false,
  stepIndex: 0,
  reviewMode: false,
  saving: false,
  error: null,
  awaitingInstrumentLink: false,
  activeScopeKey: null,
  initializedScopes: {},
  dismissedScopes: {},

  syncForUser: async (user) => {
    if (!user) {
      get().reset();
      return;
    }

    const scopeKey = onboardingScopeKeyFor(user);
    const onboarding = user.onboarding;
    const isLinked = (user.instruments?.length ?? 0) > 0;

    if (onboarding?.status === "dismissed" && !get().dismissedScopes[scopeKey]) {
      set((state) => ({
        dismissedScopes: { ...state.dismissedScopes, [scopeKey]: true },
      }));
    }

    if (get().awaitingInstrumentLink && isLinked && get().activeScopeKey === scopeKey) {
      set({ awaitingInstrumentLink: false });
      await clearLocalOnboardingProgress(scopeKey);
      if (onboarding?.status !== "completed") {
        await get().completeTutorial(user);
      }
      return;
    }

    if (get().initializedScopes[scopeKey]) {
      return;
    }

    set((state) => ({
      activeScopeKey: scopeKey,
      initializedScopes: { ...state.initializedScopes, [scopeKey]: true },
    }));

    const local = await loadLocalOnboardingProgress(scopeKey);
    if (get().activeScopeKey !== scopeKey) return;

    if (local?.dismissedLocally) {
      set((state) => ({
        dismissedScopes: { ...state.dismissedScopes, [scopeKey]: true },
      }));
      return;
    }

    if (local?.awaitingInstrumentLink && isLinked && onboarding?.status !== "completed") {
      await get().completeTutorial(user);
      return;
    }

    const shouldAutoStart = Boolean(
      onboarding?.shouldAutoStart &&
        onboarding?.status === "not_started" &&
        !get().dismissedScopes[scopeKey]
    );

    if (shouldAutoStart) {
      set({
        visible: true,
        reviewMode: false,
        stepIndex: local?.stepIndex ?? 0,
        awaitingInstrumentLink: Boolean(local?.awaitingInstrumentLink),
        error: null,
      });
    }
  },

  startReview: (user) => {
    const scopeKey = user ? onboardingScopeKeyFor(user) : get().activeScopeKey;
    set({
      visible: true,
      reviewMode: true,
      stepIndex: 0,
      saving: false,
      error: null,
      awaitingInstrumentLink: false,
      activeScopeKey: scopeKey,
    });
  },

  setStepIndex: (stepIndex, user) => {
    const safeIndex = Math.max(0, stepIndex);
    set({ stepIndex: safeIndex, error: null });
    if (user && !get().reviewMode) {
      const scopeKey = onboardingScopeKeyFor(user);
      void saveLocalOnboardingProgress(scopeKey, {
        stepIndex: safeIndex,
        awaitingInstrumentLink: get().awaitingInstrumentLink,
      });
    }
  },

  nextStep: (totalSteps, user) => {
    const maxIndex = Math.max(0, totalSteps - 1);
    const next = Math.min(maxIndex, get().stepIndex + 1);
    get().setStepIndex(next, user);
  },

  prevStep: (user) => {
    const prev = Math.max(0, get().stepIndex - 1);
    get().setStepIndex(prev, user);
  },

  openProfileInstruments: (user) => {
    const currentStepIndex = get().stepIndex;
    set({
      visible: false,
      awaitingInstrumentLink: true,
      error: null,
    });
    if (user) {
      const scopeKey = onboardingScopeKeyFor(user);
      void saveLocalOnboardingProgress(scopeKey, {
        stepIndex: currentStepIndex,
        awaitingInstrumentLink: true,
      });
    }
  },

  skipTutorial: async (user) => {
    const { reviewMode, stepIndex } = get();
    if (!user) {
      set({ visible: false, awaitingInstrumentLink: false });
      return;
    }

    const scopeKey = onboardingScopeKeyFor(user);
    set((state) => ({
      visible: false,
      awaitingInstrumentLink: false,
      error: null,
      dismissedScopes: reviewMode
        ? state.dismissedScopes
        : { ...state.dismissedScopes, [scopeKey]: true },
    }));

    if (reviewMode) {
      return;
    }

    await saveLocalOnboardingProgress(scopeKey, {
      stepIndex,
      dismissedLocally: true,
    });

    if (!user.tenantId || user.onboarding?.status === "completed") {
      return;
    }

    set({ saving: true });
    try {
      const updated = await memberService.updateMyOnboarding({
        version: CURRENT_ONBOARDING_VERSION,
        status: "dismissed",
      });
      applyUserOnboarding(updated);
    } catch {
      // Keep local dismissal state when the server cannot be reached.
    } finally {
      set({ saving: false });
    }
  },

  completeTutorial: async (user) => {
    if (!user) {
      set({ visible: false, awaitingInstrumentLink: false });
      return;
    }

    const scopeKey = onboardingScopeKeyFor(user);
    set({
      visible: false,
      awaitingInstrumentLink: false,
      error: null,
    });
    await clearLocalOnboardingProgress(scopeKey);

    if (!user.tenantId || user.onboarding?.status === "completed") {
      return;
    }

    set({ saving: true });
    try {
      const updated = await memberService.updateMyOnboarding({
        version: CURRENT_ONBOARDING_VERSION,
        status: "completed",
      });
      applyUserOnboarding(updated);
    } catch {
      // Preserve UI completion while server sync can be retried later.
    } finally {
      set({ saving: false });
    }
  },

  reset: () => {
    set({
      visible: false,
      stepIndex: 0,
      reviewMode: false,
      saving: false,
      error: null,
      awaitingInstrumentLink: false,
      activeScopeKey: null,
      initializedScopes: {},
      dismissedScopes: {},
    });
  },
}));
