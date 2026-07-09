type InvalidationReason = "ministry" | "member" | "schedule" | "user";

type InvalidationOptions = {
  reason: InvalidationReason;
  ministryId?: string;
  userId?: string;
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

    tasks.push(runInvalidation(() => useMemberStore.getState().loadMembers()));
    tasks.push(runInvalidation(() => useScheduleStore.getState().loadSchedules()));
    tasks.push(runInvalidation(() => useChurchStore.getState().loadOverview()));
  }

  if (options.reason === "member") {
    const { useMemberStore } = require("./memberStore") as typeof import("./memberStore");
    const { useMinistryStore } = require("./ministryStore") as typeof import("./ministryStore");
    const { useScheduleStore } = require("./scheduleStore") as typeof import("./scheduleStore");
    const { useChurchStore } = require("./churchStore") as typeof import("./churchStore");

    tasks.push(runInvalidation(() => useMemberStore.getState().loadMembers()));
    tasks.push(runInvalidation(() => useMinistryStore.getState().fetchMinistries()));
    if (options.ministryId) {
      tasks.push(runInvalidation(() => useMinistryStore.getState().fetchMinistry(options.ministryId!)));
    }
    tasks.push(runInvalidation(() => useScheduleStore.getState().loadSchedules()));
    tasks.push(runInvalidation(() => useChurchStore.getState().loadOverview()));
  }

  if (options.reason === "schedule") {
    const { useChurchStore } = require("./churchStore") as typeof import("./churchStore");
    tasks.push(runInvalidation(() => useChurchStore.getState().loadOverview()));
  }

  if (options.reason === "user") {
    const { useMemberStore } = require("./memberStore") as typeof import("./memberStore");
    tasks.push(runInvalidation(() => useMemberStore.getState().loadMembers()));
  }

  await Promise.all(tasks);
}
