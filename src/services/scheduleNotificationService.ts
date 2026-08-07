import { NotificationType, Prisma } from "@prisma/client";
import { enqueueDomainEvent, NotificationDraft } from "../events/domainEvents";

const scheduleNotificationInclude = {
  ministry: { select: { id: true, name: true } },
  assignments: {
    where: { isActive: true, deletedAt: null },
    include: { user: { select: { id: true, name: true } } },
  },
  songs: {
    where: { isActive: true, deletedAt: null },
    orderBy: { order: "asc" as const },
    select: { songId: true, order: true },
  },
} satisfies Prisma.ScheduleInclude;

export type ScheduleNotificationSnapshot = Prisma.ScheduleGetPayload<{ include: typeof scheduleNotificationInclude }>;
// Prisma extensions expose transaction clients with a generated type that is not
// assignable to Prisma.TransactionClient even though these delegates are identical.
export type ScheduleNotificationWriter = any;

export async function loadScheduleNotificationSnapshot(tenantId: string, scheduleId: string, writer: ScheduleNotificationWriter): Promise<ScheduleNotificationSnapshot | null> {
  return writer.schedule.findFirst({
    where: { id: scheduleId, tenantId },
    include: scheduleNotificationInclude,
  });
}

async function managerIds(snapshot: ScheduleNotificationSnapshot, writer: ScheduleNotificationWriter) {
  const leaders: Array<{ userId: string }> = await writer.ministryMember.findMany({
    where: {
      tenantId: snapshot.tenantId,
      ministryId: snapshot.ministryId,
      isLeader: true,
      status: "ACTIVE",
      isActive: true,
      deletedAt: null,
      user: { isActive: true, deletedAt: null },
    },
    select: { userId: true },
  });
  return Array.from(new Set([
    ...(snapshot.createdById ? [snapshot.createdById] : []),
    ...leaders.map((leader) => leader.userId),
  ]));
}

function withoutActor(notifications: NotificationDraft[], actorId: string) {
  return notifications.filter((notification) => notification.userId !== actorId);
}

function assignmentMap(snapshot: ScheduleNotificationSnapshot) {
  return new Map(snapshot.assignments.map((assignment) => [assignment.userId, assignment]));
}

function changedFields(before: ScheduleNotificationSnapshot, after: ScheduleNotificationSnapshot) {
  const fields: string[] = [];
  if (before.title !== after.title) fields.push("title");
  if (before.date.getTime() !== after.date.getTime()) fields.push("date");
  if (before.ministryId !== after.ministryId) fields.push("ministry");
  if ((before.comments ?? "") !== (after.comments ?? "")) fields.push("comments");
  const beforeSongs = before.songs.map((song) => `${song.songId}:${song.order}`).join("|");
  const afterSongs = after.songs.map((song) => `${song.songId}:${song.order}`).join("|");
  if (beforeSongs !== afterSongs) fields.push("songs");
  const beforeMembers = before.assignments.map((assignment) => `${assignment.userId}:${assignment.role}`).sort().join("|");
  const afterMembers = after.assignments.map((assignment) => `${assignment.userId}:${assignment.role}`).sort().join("|");
  if (beforeMembers !== afterMembers) fields.push("members");
  return fields;
}

export async function enqueueScheduleCreated(writer: ScheduleNotificationWriter, snapshot: ScheduleNotificationSnapshot, actorId: string) {
  const notifications = withoutActor(snapshot.assignments.map((assignment) => ({
    userId: assignment.userId,
    type: NotificationType.SCHEDULE_ASSIGNED,
    title: "Você foi escalado",
    body: `${snapshot.title} · ${assignment.role}`,
    payload: { scheduleId: snapshot.id, date: snapshot.date.toISOString(), role: assignment.role, changedFields: ["assignment"] },
  })), actorId);
  await enqueueDomainEvent(writer, {
    tenantId: snapshot.tenantId,
    actorId,
    type: "schedule.created",
    aggregateType: "SCHEDULE",
    aggregateId: snapshot.id,
    notifications,
    payload: { changedFields: ["schedule", "assignments", "songs"] },
  });
}

export async function enqueueScheduleUpdated(
  writer: ScheduleNotificationWriter,
  before: ScheduleNotificationSnapshot,
  after: ScheduleNotificationSnapshot,
  actorId: string,
) {
  const fields = changedFields(before, after);
  if (!fields.length) return;
  const beforeAssignments = assignmentMap(before);
  const afterAssignments = assignmentMap(after);
  const notifications: NotificationDraft[] = [];

  for (const assignment of after.assignments) {
    const previous = beforeAssignments.get(assignment.userId);
    if (!previous) {
      notifications.push({
        userId: assignment.userId,
        type: NotificationType.SCHEDULE_ASSIGNED,
        title: "Você foi escalado",
        body: `${after.title} · ${assignment.role}`,
        payload: { scheduleId: after.id, date: after.date.toISOString(), role: assignment.role, changedFields: fields },
      });
    } else if (previous.role !== assignment.role) {
      notifications.push({
        userId: assignment.userId,
        type: NotificationType.ASSIGNMENT_ROLE_CHANGED,
        title: "Sua função foi alterada",
        body: `${after.title} · ${assignment.role}`,
        payload: { scheduleId: after.id, date: after.date.toISOString(), role: assignment.role, changedFields: fields },
      });
    } else {
      notifications.push({
        userId: assignment.userId,
        type: NotificationType.SCHEDULE_UPDATED,
        title: "Escala atualizada",
        body: after.title,
        payload: { scheduleId: after.id, date: after.date.toISOString(), changedFields: fields },
      });
    }
  }

  for (const assignment of before.assignments) {
    if (!afterAssignments.has(assignment.userId)) {
      notifications.push({
        userId: assignment.userId,
        type: NotificationType.ASSIGNMENT_REMOVED,
        title: "Você foi removido de uma escala",
        body: before.title,
        payload: { scheduleId: before.id, date: before.date.toISOString(), changedFields: ["assignment"] },
      });
    }
  }

  await enqueueDomainEvent(writer, {
    tenantId: after.tenantId,
    actorId,
    type: "schedule.updated",
    aggregateType: "SCHEDULE",
    aggregateId: after.id,
    notifications: withoutActor(notifications, actorId),
    payload: { changedFields: fields },
  });
}

export async function enqueueScheduleCancelled(writer: ScheduleNotificationWriter, snapshot: ScheduleNotificationSnapshot, actorId: string) {
  const notifications = withoutActor(snapshot.assignments.map((assignment) => ({
    userId: assignment.userId,
    type: NotificationType.SCHEDULE_CANCELLED,
    title: "Escala cancelada",
    body: snapshot.title,
    payload: { scheduleId: snapshot.id, date: snapshot.date.toISOString(), changedFields: ["cancelled"] },
  })), actorId);
  await enqueueDomainEvent(writer, {
    tenantId: snapshot.tenantId,
    actorId,
    type: "schedule.cancelled",
    aggregateType: "SCHEDULE",
    aggregateId: snapshot.id,
    notifications,
    payload: { changedFields: ["cancelled"] },
  });
}

export async function enqueueAssignmentResponse(writer: ScheduleNotificationWriter, snapshot: ScheduleNotificationSnapshot, assignmentId: string, actorId: string) {
  const assignment = snapshot.assignments.find((item) => item.id === assignmentId);
  if (!assignment) return;
  const managers = (await managerIds(snapshot, writer)).filter((id) => id !== actorId);
  if (!managers.length) return;
  const substitutionRequested = Boolean(assignment.substituteRequestedAt && !assignment.substituteResolvedAt);
  const type = substitutionRequested
    ? NotificationType.SUBSTITUTION_REQUESTED
    : assignment.status === "ACCEPTED"
      ? NotificationType.ASSIGNMENT_ACCEPTED
      : NotificationType.ASSIGNMENT_DECLINED;
  const action = substitutionRequested ? "solicitou substituto" : assignment.status === "ACCEPTED" ? "aceitou a escala" : "recusou a escala";
  await enqueueDomainEvent(writer, {
    tenantId: snapshot.tenantId,
    actorId,
    type: "schedule.assignment.responded",
    aggregateType: "SCHEDULE",
    aggregateId: snapshot.id,
    notifications: managers.map((userId) => ({
      userId,
      type,
      title: "Resposta de escala",
      body: `${assignment.user.name} ${action}`,
      payload: { scheduleId: snapshot.id, assignmentId, date: snapshot.date.toISOString(), status: assignment.status },
    })),
  });
}

export async function enqueueSubstitutionResolved(writer: ScheduleNotificationWriter, snapshot: ScheduleNotificationSnapshot, assignmentId: string, actorId: string) {
  const assignment = snapshot.assignments.find((item) => item.id === assignmentId);
  if (!assignment) return;
  const recipients = Array.from(new Set([assignment.userId, ...(await managerIds(snapshot, writer))])).filter((id) => id !== actorId);
  if (!recipients.length) return;
  await enqueueDomainEvent(writer, {
    tenantId: snapshot.tenantId,
    actorId,
    type: "schedule.substitution.resolved",
    aggregateType: "SCHEDULE",
    aggregateId: snapshot.id,
    notifications: recipients.map((userId) => ({
      userId,
      type: NotificationType.SUBSTITUTION_RESOLVED,
      title: "Substituição resolvida",
      body: snapshot.title,
      payload: { scheduleId: snapshot.id, assignmentId, date: snapshot.date.toISOString() },
    })),
  });
}
