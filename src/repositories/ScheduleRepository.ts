import { prisma } from "./prismaClient";
import { CreateAssignmentInput, CreateScheduleInput, ListSchedulesInput, UpdateAssignmentStatusInput, UpdateScheduleInput } from "../validators/schedule.schema";
import { ConflictError, ForbiddenError } from "../errors/AppError";
import {
  normalizeScheduleAssignments,
  normalizeScheduleSongIds,
  scheduleAssignmentsChanged,
  scheduleSongsChanged,
  ScheduleMutationPermissions,
} from "../security/scheduleMutationPolicy";
import {
  enqueueAssignmentResponse,
  enqueueScheduleCancelled,
  enqueueScheduleCreated,
  enqueueScheduleUpdated,
  enqueueSubstitutionResolved,
  loadScheduleNotificationSnapshot,
} from "../services/scheduleNotificationService";

const scheduleInclude = {
  morningOrders: { select: { date: true } },
  eveningOrders: { select: { date: true } },
  ministry: { select: { id: true, name: true } },
  assignments: { include: { user: { select: { id: true, name: true } } } },
  songs: {
    orderBy: { order: "asc" as const },
    include: {
      song: {
        select: {
          id: true,
          title: true,
          videoUrl: true,
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

  private songMetadata(data: CreateScheduleInput, songId: string, previous?: {
    moment: string; momentDescription: string | null; videoUrlOverride: string | null;
  }) {
    const details = data.songDetails?.find((entry) => entry.songId === songId);
    const moment = details?.moment ?? previous?.moment ?? "Louvor";
    return {
      moment,
      momentDescription: moment === "Outro" ? (details?.momentDescription === undefined ? previous?.momentDescription ?? null : details.momentDescription || null) : null,
      videoUrlOverride: details?.videoUrlOverride === undefined ? previous?.videoUrlOverride ?? null : details.videoUrlOverride || null,
    };
  }

  private async associateWorshipPeriod(tx: Pick<typeof prisma, "worshipOrder">, scheduleId: string, date: Date, period: CreateScheduleInput["worshipPeriod"]) {
    if (period === undefined) return;
    // Only explicit user selection changes a document; never infer the period from title/time.
    await tx.worshipOrder.updateMany({ where: { tenantId: this.tenantId, morningScheduleId: scheduleId }, data: { morningScheduleId: null } });
    await tx.worshipOrder.updateMany({ where: { tenantId: this.tenantId, eveningScheduleId: scheduleId }, data: { eveningScheduleId: null } });
    if (period === null) return;
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
    await tx.worshipOrder.upsert({ where: { tenantId_date: { tenantId: this.tenantId, date: day } }, create: { tenantId: this.tenantId, date: day }, update: {} });
    const field = period === "MORNING" ? "morningScheduleId" : "eveningScheduleId";
    const claimed = await tx.worshipOrder.updateMany({ where: { tenantId: this.tenantId, date: day, [field]: null }, data: { [field]: scheduleId } });
    if (!claimed.count) throw new ConflictError("Já existe uma escala neste período e data. Altere a seleção na Ordem de Culto ou escolha outro período.");
  }

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

  findScheduleSongs(scheduleId: string) {
    return prisma.scheduleSong.findMany({
      where: { scheduleId, tenantId: this.tenantId, isActive: true, deletedAt: null },
      select: { songId: true, order: true, moment: true, momentDescription: true, videoUrlOverride: true },
      orderBy: { order: "asc" },
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
                videoUrl: true,
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
        status: "ACTIVE",
        isActive: true,
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
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
            ...this.songMetadata(data, songId),
          })),
        },
      },
      include: scheduleInclude,
      });
      await this.associateWorshipPeriod(tx, created.id, data.date, data.worshipPeriod);
      if (actorId) {
        const snapshot = await loadScheduleNotificationSnapshot(this.tenantId, created.id, tx);
        if (snapshot) await enqueueScheduleCreated(tx, snapshot, actorId);
      }
      return data.worshipPeriod ? tx.schedule.findFirstOrThrow({ where: { id: created.id, tenantId: this.tenantId }, include: scheduleInclude }) : created;
    });
  }

  update(
    scheduleId: string,
    data: UpdateScheduleInput,
    actorId: string | undefined,
    permissions: ScheduleMutationPermissions,
  ) {
    const songIds = normalizeScheduleSongIds(data.songIds);
    const assignments = normalizeScheduleAssignments(data.assignments);

    return prisma.$transaction(async (tx) => {
      // Updating the root timestamp acquires the row lock before comparing child state,
      // preventing a concurrent authorized update from being overwritten by a
      // stale request that lacks child-resource permissions.
      const locked = await tx.schedule.updateMany({
        where: { id: scheduleId, tenantId: this.tenantId, isActive: true, deletedAt: null },
        data: { updatedAt: new Date() },
      });
      if (locked.count === 0) return null;

      const before = actorId ? await loadScheduleNotificationSnapshot(this.tenantId, scheduleId, tx) : null;
      const existing = await tx.schedule.findFirst({
        where: { id: scheduleId, tenantId: this.tenantId, isActive: true, deletedAt: null },
        select: {
          id: true,
          ministryId: true,
          assignments: {
            where: { tenantId: this.tenantId, isActive: true, deletedAt: null },
            select: { id: true, userId: true, role: true },
          },
          songs: {
            where: { tenantId: this.tenantId, isActive: true, deletedAt: null },
            select: { songId: true, order: true, moment: true, momentDescription: true, videoUrlOverride: true },
            orderBy: { order: "asc" },
          },
        },
      });
      if (!existing) return null;

      if (!permissions.assignments && scheduleAssignmentsChanged(
        existing.assignments,
        assignments,
        existing.ministryId !== data.ministryId,
      )) {
        throw new ForbiddenError("Usuário sem permissão para alterar membros da escala");
      }
      if (!permissions.songs && scheduleSongsChanged(existing.songs.map((entry) => entry.songId), songIds)) {
        throw new ForbiddenError("Usuário sem permissão para alterar músicas da escala");
      }

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
          data: songIds.map((songId, index) => {
            const previous = existing.songs.find((entry) => entry.songId === songId);
            return { scheduleId, songId, order: index, tenantId: this.tenantId,
              ...this.songMetadata(data, songId, previous) };
          }),
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

      await this.associateWorshipPeriod(tx, scheduleId, data.date, data.worshipPeriod);
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
                    videoUrl: true,
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
