import { prisma } from "./prismaClient";
import { CreateAssignmentInput, CreateScheduleInput, ListSchedulesInput, UpdateAssignmentStatusInput, UpdateScheduleInput } from "../validators/schedule.schema";

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
      where: { id: userId, tenantId: this.tenantId },
      select: { id: true, name: true, tenantId: true },
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
      where: { ministryId, userId, tenantId: this.tenantId },
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
  create(data: CreateScheduleInput) {
    const songIds = Array.from(new Set(data.songIds));
    const assignments = Array.from(new Map(data.assignments.map((assignment) => [assignment.userId, assignment])).values());

    return prisma.schedule.create({
      data: {
        title: data.title,
        date: data.date,
        comments: data.comments ?? null,
        ministryId: data.ministryId,
        tenantId: this.tenantId,
        assignments: {
          create: assignments.map((assignment) => ({
            userId: assignment.userId,
            role: assignment.role,
            status: assignment.status,
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
  }

  update(scheduleId: string, data: UpdateScheduleInput) {
    const songIds = Array.from(new Set(data.songIds));
    const assignments = Array.from(new Map(data.assignments.map((assignment) => [assignment.userId, assignment])).values());

    return prisma.$transaction(async (tx) => {
      const existing = await tx.schedule.findFirst({
        where: { id: scheduleId, tenantId: this.tenantId, isActive: true, deletedAt: null },
        select: { id: true },
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

      await tx.scheduleAssignment.deleteMany({ where: { scheduleId, tenantId: this.tenantId } });
      if (assignments.length) {
        await tx.scheduleAssignment.createMany({
          data: assignments.map((assignment) => ({
            scheduleId,
            userId: assignment.userId,
            role: assignment.role,
            status: assignment.status,
            tenantId: this.tenantId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.schedule.findFirst({
        where: { id: scheduleId, tenantId: this.tenantId, isActive: true, deletedAt: null },
        include: scheduleInclude,
      });
    });
  }

  createAssignment(scheduleId: string, data: CreateAssignmentInput) {
    return prisma.$transaction(async (tx) => {
      const [schedule, user] = await Promise.all([
        tx.schedule.findFirst({ where: { id: scheduleId, tenantId: this.tenantId, isActive: true, deletedAt: null }, select: { id: true } }),
        tx.user.findFirst({ where: { id: data.userId, tenantId: this.tenantId }, select: { id: true } }),
      ]);

      if (!schedule || !user) {
        return null;
      }

      return tx.scheduleAssignment.create({
        data: {
          scheduleId,
          userId: data.userId,
          role: data.role,
          status: data.status,
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

  async updateAssignmentStatus(scheduleId: string, assignmentId: string, data: UpdateAssignmentStatusInput) {
    const now = new Date();
    const result = await prisma.scheduleAssignment.updateMany({
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

    return this.findAssignment(scheduleId, assignmentId);
  }

  deleteAssignment(assignmentId: string) {
    return prisma.scheduleAssignment.deleteMany({
      where: { id: assignmentId, tenantId: this.tenantId },
    });
  }

  async resolveSubstitution(scheduleId: string, assignmentId: string, userId: string, note?: string) {
    const result = await prisma.scheduleAssignment.updateMany({
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
    return this.findAssignment(scheduleId, assignmentId);
  }

  deleteSchedule(scheduleId: string) {
    const deletedAt = new Date();
    return prisma.$transaction(async (tx) => {
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
          },
        },
      },
      orderBy: { schedule: { date: "asc" } },
    });
  }
}
