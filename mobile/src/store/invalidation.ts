type InvalidationReason = "ministry" | "member" | "schedule" | "user";

type InvalidationOptions = {
  reason: InvalidationReason;
  ministryId?: string;
  ministryIds?: string[];
  userId?: string;
  skipMinistryRefresh?: boolean;
};

async function runInvalidation(task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch {
    // Invalidation must not turn a successful mutation into a failed one.
  }
}

export async function invalidateRelatedData(options: InvalidationOptions): Promise<void> {
  const tasks: Array<Promise<void>> = [];

  if (options.reason === "ministry") {
    const { useMemberStore } = require("./memberStore") as typeof import("./memberStore");
    const { useScheduleStore } = require("./scheduleStore") as typeof import("./scheduleStore");
    const { useChurchStore } = require("./churchStore") as typeof import("./churchStore");

    if (useMemberStore.getState().lastFetchedAt !== null) {
      tasks.push(runInvalidation(() => useMemberStore.getState().loadMembers({ force: true })));
    }
    if (useScheduleStore.getState().lastFetchedAt !== null) {
      tasks.push(runInvalidation(() => useScheduleStore.getState().loadSchedules({ refresh: true })));
    }
    const churchState = useChurchStore.getState();
    if (churchState.overview !== null || churchState.summary !== null) {
      tasks.push(runInvalidation(() => useChurchStore.getState().loadOverview()));
    }
  }

  if (options.reason === "member") {
    const { useMemberStore } = require("./memberStore") as typeof import("./memberStore");
    const { useMinistryStore } = require("./ministryStore") as typeof import("./ministryStore");
    const { useScheduleStore } = require("./scheduleStore") as typeof import("./scheduleStore");
    const { useChurchStore } = require("./churchStore") as typeof import("./churchStore");

    if (useMemberStore.getState().lastFetchedAt !== null) {
      tasks.push(runInvalidation(() => useMemberStore.getState().loadMembers({ force: true })));
    }
    if (useMinistryStore.getState().ministries.length > 0) {
      tasks.push(runInvalidation(() => useMinistryStore.getState().fetchMinistries()));
    }
    const ministryIds = Array.from(
      new Set([options.ministryId, ...(options.ministryIds ?? [])].filter((id): id is string => Boolean(id)))
    );
    if (!options.skipMinistryRefresh) {
      const currentMinistryId = useMinistryStore.getState().currentMinistry?.id;
      const idsToRefresh =
        ministryIds.length > 0
          ? ministryIds
          : currentMinistryId
            ? [currentMinistryId]
            : [];
      for (const id of idsToRefresh) {
        tasks.push(runInvalidation(() => useMinistryStore.getState().fetchMinistry(id)));
      }
    }
    if (useScheduleStore.getState().lastFetchedAt !== null) {
      tasks.push(runInvalidation(() => useScheduleStore.getState().loadSchedules({ refresh: true })));
    }
    const churchState = useChurchStore.getState();
    if (churchState.overview !== null || churchState.summary !== null) {
      tasks.push(runInvalidation(() => useChurchStore.getState().loadOverview()));
    }
  }

  if (options.reason === "schedule") {
    const { useChurchStore } = require("./churchStore") as typeof import("./churchStore");
    const churchState = useChurchStore.getState();
    if (churchState.overview !== null || churchState.summary !== null) {
      tasks.push(runInvalidation(() => useChurchStore.getState().loadOverview()));
    }
  }

  if (options.reason === "user") {
    const { useMemberStore } = require("./memberStore") as typeof import("./memberStore");
    if (useMemberStore.getState().lastFetchedAt !== null) {
      tasks.push(runInvalidation(() => useMemberStore.getState().loadMembers({ force: true })));
    }
  }

  await Promise.all(tasks);
}

export function resetAllDomainStores(): void {
  const { useMusicStore } = require("./musicStore") as typeof import("./musicStore");
  const { useScheduleStore } = require("./scheduleStore") as typeof import("./scheduleStore");
  const { useMemberStore } = require("./memberStore") as typeof import("./memberStore");
  const { useMinistryStore } = require("./ministryStore") as typeof import("./ministryStore");
  const { useChordStore } = require("./chordStore") as typeof import("./chordStore");
  const { useAdminStore } = require("./adminStore") as typeof import("./adminStore");
  const { useChurchStore } = require("./churchStore") as typeof import("./churchStore");
  const { useInstrumentStore } = require("./instrumentStore") as typeof import("./instrumentStore");
  const { useNotificationStore } = require("./notificationStore") as typeof import("./notificationStore");
  const { useOnboardingStore } = require("../features/onboarding/onboardingStore") as typeof import("../features/onboarding/onboardingStore");

  useMusicStore.getState().reset();
  useScheduleStore.getState().reset();
  useMemberStore.getState().reset();
  useMinistryStore.getState().reset();
  useChordStore.getState().reset();
  useAdminStore.getState().reset();
  useChurchStore.getState().reset();
  useInstrumentStore.getState().reset();
  useNotificationStore.getState().reset();
  useOnboardingStore.getState().reset();
}
