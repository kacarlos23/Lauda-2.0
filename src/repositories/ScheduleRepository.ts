import { prisma } from "./prismaClient";
import { CreateAssignmentInput, CreateScheduleInput, ListSchedulesInput, UpdateAssignmentStatusInput, UpdateScheduleInput } from "../validators/schedule.schema";
import {
  enqueueAssignmentResponse,
  enqueueScheduleCancelled,
  enqueueScheduleCreated,
  enqueueScheduleUpdated,
  enqueueSubstitutionResolved,
  loadScheduleNotificationSnapshot,
} from "../services/scheduleNotificationService";

const scheduleInclude = {
  ministry: { select: { id: true, name: true } },
  assignments: { include: { user: { select: { id: true, name: true } } } },
  songs: {
    orderBy: { order: "asc" as const },
    include: {
      song: {
        select: {
          id: true,
          title: true,
          originalKey: true,
          bpm: true,
          artistId: true,
          artist: { select: { id: true, name: true, imageUrl: true } },
        },
      },
    },
  },
};

export class ScheduleRepository {
  constructor(private readonly tenantId: string) {}

  /**
   * Lists schedules for the authenticated tenant.
   *
   * @returns Schedules visible to the current tenant only.
   */
  findAll(filters: Partial<ListSchedulesInput> = {}) {
    return prisma.schedule.findMany({
      where: {
        tenantId: this.tenantId,
        isActive: true,
        deletedAt: null,
        ...(filters.ministryId ? { ministryId: filters.ministryId } : {}),
        ...(filters.from || filters.to ? { date: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}),
      },
      include: scheduleInclude,
      orderBy: { date: "asc" },
    });
  }

  /**
   * Finds a ministry within the authenticated tenant.
   *
   * @param ministryId Ministry identifier to validate.
   * @returns The ministry id when it belongs to the tenant, otherwise null.
   */
  findMinistryById(ministryId: string) {
    return prisma.ministry.findFirst({
      where: { id: ministryId, tenantId: this.tenantId },
      select: { id: true },
    });
  }

  findScheduleById(scheduleId: string) {
    return prisma.schedule.findFirst({
      where: { id: scheduleId, tenantId: this.tenantId, isActive: true, deletedAt: null },
      include: {
        ministry: { select: { id: true, name: true } },
      },
    });
  }

  findTenantUserById(userId: string) {
    return prisma.user.findFirst({
      where: { id: userId, tenantId: this.tenantId, isActive: true, deletedAt: null },
      select: { id: true, name: true, tenantId: true },
    });
  }

  findScheduleAssignments(scheduleId: string) {
    return prisma.scheduleAssignment.findMany({
      where: { scheduleId, tenantId: this.tenantId, isActive: true, deletedAt: null },
      select: { id: true, userId: true, role: true, status: true },
    });
  }

  findUsersWithAssignmentRoles(userIds: string[]) {
    if (!userIds.length) return Promise.resolve([]);
    return prisma.user.findMany({
      where: {
        id: { in: Array.from(new Set(userIds)) },
        tenantId: this.tenantId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        instruments: {
          where: {
            tenantId: this.tenantId,
            isActive: true,
            deletedAt: null,
            instrument: { isActive: true, deletedAt: null },
          },
          select: { instrument: { select: { name: true } } },
        },
      },
    });
  }

  findScheduleReportById(scheduleId: string) {
    return prisma.schedule.findFirst({
      where: { id: scheduleId, tenantId: this.tenantId, isActive: true, deletedAt: null },
      include: {
        ministry: { select: { id: true, name: true } },
        assignments: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        songs: {
          orderBy: { order: "asc" },
          include: {
            song: {
              select: {
                id: true,
                title: true,
                originalKey: true,
                bpm: true,
                artist: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
  }

  findMinistryMember(ministryId: string, userId: string) {
    return prisma.ministryMember.findFirst({
      where: { ministryId, userId, tenantId: this.tenantId, status: "ACTIVE", isActive: true, deletedAt: null },
      select: { id: true, status: true },
    });
  }

  countTenantSongs(songIds: string[]) {
    if (!songIds.length) return Promise.resolve(0);
    return prisma.song.count({
      where: { id: { in: songIds }, tenantId: this.tenantId },
    });
  }

  findMinistryLeadership(ministryId: string, userId: string) {
    return prisma.ministryMember.findFirst({
      where: {
        ministryId,
        userId,
        tenantId: this.tenantId,
        isLeader: true,
      },
      select: { id: true },
    });
  }

  /**
   * Creates a schedule owned by the authenticated tenant.
   *
   * @param data Validated schedule input without tenantId.
   * @returns The created schedule.
   */
  create(data: CreateScheduleInput, actorId?: string) {
    const songIds = Array.from(new Set(data.songIds));
    const assignments = Array.from(new Map(data.assignments.map((assignment) => [assignment.userId, assignment])).values());

    return prisma.$transaction(async (tx) => {
      const created = await tx.schedule.create({ data: {
        title: data.title,
        date: data.date,
        comments: data.comments ?? null,
        ministryId: data.ministryId,
        tenantId: this.tenantId,
        createdById: actorId ?? null,
        assignments: {
          create: assignments.map((assignment) => ({
            userId: assignment.userId,
            role: assignment.role,
            status: "PENDING",
            tenantId: this.tenantId,
          })),
        },
        songs: {
          create: songIds.map((songId, index) => ({
            songId,
            order: index,
            tenantId: this.tenantId,
          })),
        },
      },
      include: scheduleInclude,
      });
      if (actorId) {
        const snapshot = await loadScheduleNotificationSnapshot(this.tenantId, created.id, tx);
        if (snapshot) await enqueueScheduleCreated(tx, snapshot, actorId);
      }
      return created;
    });
  }

  update(scheduleId: string, data: UpdateScheduleInput, actorId?: string) {
    const songIds = Array.from(new Set(data.songIds));
    const assignments = Array.from(new Map(data.assignments.map((assignment) => [assignment.userId, assignment])).values());

    return prisma.$transaction(async (tx) => {
      const before = actorId ? await loadScheduleNotificationSnapshot(this.tenantId, scheduleId, tx) : null;
      const existing = await tx.schedule.findFirst({
        where: { id: scheduleId, tenantId: this.tenantId, isActive: true, deletedAt: null },
        select: {
          id: true,
          assignments: {
            where: { tenantId: this.tenantId, isActive: true, deletedAt: null },
            select: { id: true, userId: true, role: true },
          },
        },
      });
      if (!existing) return null;

      await tx.schedule.update({
        where: { id: scheduleId },
        data: {
          title: data.title,
          date: data.date,
          comments: data.comments ?? null,
          ministryId: data.ministryId,
        },
      });

      await tx.scheduleSong.deleteMany({ where: { scheduleId, tenantId: this.tenantId } });
      if (songIds.length) {
        await tx.scheduleSong.createMany({
          data: songIds.map((songId, index) => ({ scheduleId, songId, order: index, tenantId: this.tenantId })),
          skipDuplicates: true,
        });
      }

      const nextUserIds = assignments.map((assignment) => assignment.userId);
      await tx.scheduleAssignment.deleteMany({
        where: {
          scheduleId,
          tenantId: this.tenantId,
          ...(nextUserIds.length ? { userId: { notIn: nextUserIds } } : {}),
        },
      });

      const existingByUserId = new Map(existing.assignments.map((assignment) => [assignment.userId, assignment]));
      for (const assignment of assignments) {
        const current = existingByUserId.get(assignment.userId);
        if (!current) {
          await tx.scheduleAssignment.create({
            data: {
              scheduleId,
              userId: assignment.userId,
              role: assignment.role,
              status: "PENDING",
              tenantId: this.tenantId,
            },
          });
          continue;
        }
        if (current.role !== assignment.role) {
          await tx.scheduleAssignment.update({
            where: { id: current.id },
            data: {
              role: assignment.role,
              status: "PENDING",
              declineReason: null,
              substituteRequestedAt: null,
              substituteResolvedAt: null,
              substituteResolvedById: null,
              substituteResolutionNote: null,
            },
          });
        }
      }

      const updated = await tx.schedule.findFirst({
        where: { id: scheduleId, tenantId: this.tenantId, isActive: true, deletedAt: null },
        include: scheduleInclude,
      });
      if (actorId && before && updated) {
        const after = await loadScheduleNotificationSnapshot(this.tenantId, scheduleId, tx);
        if (after) await enqueueScheduleUpdated(tx, before, after, actorId);
      }
      return updated;
    });
  }

  createAssignment(scheduleId: string, data: CreateAssignmentInput, actorId?: string) {
    return prisma.$transaction(async (tx) => {
      const before = actorId ? await loadScheduleNotificationSnapshot(this.tenantId, scheduleId, tx) : null;
      const [schedule, user] = await Promise.all([
        tx.schedule.findFirst({ where: { id: scheduleId, tenantId: this.tenantId, isActive: true, deletedAt: null }, select: { id: true } }),
        tx.user.findFirst({ where: { id: data.userId, tenantId: this.tenantId, isActive: true, deletedAt: null }, select: { id: true } }),
      ]);

      if (!schedule || !user) {
        return null;
      }

      const created = await tx.scheduleAssignment.create({
        data: {
          scheduleId,
          userId: data.userId,
          role: data.role,
          status: "PENDING",
          tenantId: this.tenantId,
        },
        include: {
          user: { select: { id: true, name: true } },
          schedule: {
            select: {
              id: true,
              title: true,
              date: true,
              ministry: { select: { id: true, name: true } },
            },
          },
        },
      });
      if (actorId && before) {
        const after = await loadScheduleNotificationSnapshot(this.tenantId, scheduleId, tx);
        if (after) await enqueueScheduleUpdated(tx, before, after, actorId);
      }
      return created;
    });
  }

  findAssignment(scheduleId: string, assignmentId: string) {
    return prisma.scheduleAssignment.findFirst({
      where: {
        id: assignmentId,
        scheduleId,
        tenantId: this.tenantId,
        isActive: true,
        deletedAt: null,
        schedule: { tenantId: this.tenantId, isActive: true, deletedAt: null },
      },
      include: {
        schedule: {
          select: {
            id: true,
            title: true,
            date: true,
            ministryId: true,
            ministry: { select: { id: true, name: true } },
          },
        },
        user: { select: { id: true, name: true } },
      },
    });
  }

  updateAssignmentStatus(scheduleId: string, assignmentId: string, data: UpdateAssignmentStatusInput, actorId?: string) {
    return prisma.$transaction(async (tx) => {
    const now = new Date();
    const result = await tx.scheduleAssignment.updateMany({
      where: {
        id: assignmentId,
        scheduleId,
        tenantId: this.tenantId,
        isActive: true,
        deletedAt: null,
        schedule: { tenantId: this.tenantId, isActive: true, deletedAt: null },
      },
      data: {
        status: data.status,
        declineReason: data.status === "DECLINED" ? data.declineReason ?? null : null,
        substituteRequestedAt: data.requestSubstitute ? now : undefined,
        substituteResolvedAt: data.requestSubstitute ? null : undefined,
        substituteResolvedById: data.requestSubstitute ? null : undefined,
        substituteResolutionNote: data.requestSubstitute ? null : undefined,
      },
    });

    if (result.count === 0) {
      return null;
    }
    const snapshot = actorId ? await loadScheduleNotificationSnapshot(this.tenantId, scheduleId, tx) : null;
    if (actorId && snapshot) await enqueueAssignmentResponse(tx, snapshot, assignmentId, actorId);
    return tx.scheduleAssignment.findFirst({
      where: { id: assignmentId, scheduleId, tenantId: this.tenantId, isActive: true, deletedAt: null },
      include: {
        schedule: { select: { id: true, title: true, date: true, ministryId: true, ministry: { select: { id: true, name: true } } } },
        user: { select: { id: true, name: true } },
      },
    });
    });
  }

  deleteAssignment(scheduleId: string, assignmentId: string, actorId?: string) {
    return prisma.$transaction(async (tx) => {
      const before = actorId ? await loadScheduleNotificationSnapshot(this.tenantId, scheduleId, tx) : null;
      const result = await tx.scheduleAssignment.deleteMany({ where: { id: assignmentId, scheduleId, tenantId: this.tenantId } });
      if (actorId && before && result.count) {
        const after = await loadScheduleNotificationSnapshot(this.tenantId, scheduleId, tx);
        if (after) await enqueueScheduleUpdated(tx, before, after, actorId);
      }
      return result;
    });
  }

  resolveSubstitution(scheduleId: string, assignmentId: string, userId: string, note?: string) {
    return prisma.$transaction(async (tx) => {
    const result = await tx.scheduleAssignment.updateMany({
      where: {
        id: assignmentId,
        scheduleId,
        tenantId: this.tenantId,
        isActive: true,
        deletedAt: null,
        substituteRequestedAt: { not: null },
        substituteResolvedAt: null,
        schedule: { tenantId: this.tenantId, isActive: true, deletedAt: null },
      },
      data: {
        substituteResolvedAt: new Date(),
        substituteResolvedById: userId,
        substituteResolutionNote: note ?? null,
      },
    });

    if (result.count === 0) return null;
    const snapshot = await loadScheduleNotificationSnapshot(this.tenantId, scheduleId, tx);
    if (snapshot) await enqueueSubstitutionResolved(tx, snapshot, assignmentId, userId);
    return tx.scheduleAssignment.findFirst({
      where: { id: assignmentId, scheduleId, tenantId: this.tenantId, isActive: true, deletedAt: null },
      include: {
        schedule: { select: { id: true, title: true, date: true, ministryId: true, ministry: { select: { id: true, name: true } } } },
        user: { select: { id: true, name: true } },
      },
    });
    });
  }

  deleteSchedule(scheduleId: string, actorId?: string) {
    const deletedAt = new Date();
    return prisma.$transaction(async (tx) => {
      const before = actorId ? await loadScheduleNotificationSnapshot(this.tenantId, scheduleId, tx) : null;
      const schedule = await tx.schedule.findFirst({
        where: { id: scheduleId, tenantId: this.tenantId, isActive: true, deletedAt: null },
        select: { id: true, ministryId: true },
      });
      if (!schedule) return null;

      await tx.scheduleAssignment.updateMany({
        where: { scheduleId, tenantId: this.tenantId, deletedAt: null },
        data: { isActive: false, deletedAt },
      });
      await tx.scheduleSong.updateMany({
        where: { scheduleId, tenantId: this.tenantId, deletedAt: null },
        data: { isActive: false, deletedAt },
      });
      const deleted = await tx.schedule.update({
        where: { id: scheduleId },
        data: { isActive: false, deletedAt },
        select: { id: true, ministryId: true, tenantId: true, deletedAt: true, isActive: true },
      });

      if (actorId && before) await enqueueScheduleCancelled(tx, before, actorId);

      return deleted;
    });
  }

  findSchedulesForUser(userId: string) {
    return prisma.scheduleAssignment.findMany({
      where: {
        userId,
        tenantId: this.tenantId,
        isActive: true,
        deletedAt: null,
        schedule: { tenantId: this.tenantId, isActive: true, deletedAt: null },
      },
      include: {
        schedule: {
          include: {
            ministry: { select: { id: true, name: true } },
            songs: {
              orderBy: { order: "asc" },
              include: {
                song: {
                  select: {
                    id: true,
                    title: true,
                    originalKey: true,
                    bpm: true,
                    artistId: true,
                    artist: { select: { id: true, name: true, imageUrl: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { schedule: { date: "asc" } },
    });
  }
}
