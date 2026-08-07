import { Prisma, PrismaClient, Role } from "@prisma/client";
import { basePrisma } from "../config/prisma";
import {
  enqueueScheduleCancelled,
  enqueueScheduleCreated,
  enqueueScheduleUpdated,
  loadScheduleNotificationSnapshot,
} from "../services/scheduleNotificationService";

export const adminResourceNames = [
  "tenants",
  "users",
  "ministries",
  "ministry-members",
  "member-invites",
  "instruments",
  "user-instruments",
  "artists",
  "songs",
  "ministry-songs",
  "schedules",
  "schedule-songs",
  "schedule-assignments",
  "audit-logs",
] as const;

export type AdminResourceName = (typeof adminResourceNames)[number];

const tenantSummarySelect = { id: true, name: true, comments: true, domain: true, isActive: true, deletedAt: true, createdAt: true, updatedAt: true } as const;
const tenantMiniSelect = { id: true, name: true } as const;
const userMiniSelect = { id: true, name: true, email: true } as const;
const ministryMiniSelect = { id: true, name: true } as const;
const artistMiniSelect = { id: true, name: true, imageUrl: true } as const;
const songMiniSelect = { id: true, title: true, originalKey: true, bpm: true, artistId: true, artist: { select: { id: true, name: true } } } as const;

const userPublicSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatarUrl: true,
  comments: true,
  role: true,
  tenantId: true,
  isActive: true,
  deletedAt: true,
  mfaEnabledAt: true,
  createdAt: true,
  updatedAt: true,
  tenant: { select: tenantMiniSelect },
} as const;

const ministryPublicSelect = {
  id: true,
  name: true,
  description: true,
  comments: true,
  tenantId: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  tenant: { select: tenantMiniSelect },
  _count: { select: { members: true, schedules: true } },
} as const;

const instrumentPublicSelect = {
  id: true,
  name: true,
  colorHex: true,
  tenantId: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  tenant: { select: tenantMiniSelect },
} as const;

const artistPublicSelect = {
  id: true,
  name: true,
  normalizedName: true,
  imageUrl: true,
  tenantId: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  tenant: { select: tenantMiniSelect },
} as const;

const songPublicSelect = {
  id: true,
  title: true,
  normalizedTitle: true,
  composer: true,
  originalKey: true,
  content: true,
  comments: true,
  bpm: true,
  cifraUrl: true,
  letraUrl: true,
  audioUrl: true,
  videoUrl: true,
  artistId: true,
  tenantId: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  artist: { select: artistMiniSelect },
  tenant: { select: tenantMiniSelect },
} as const;

const schedulePublicSelect = {
  id: true,
  title: true,
  date: true,
  comments: true,
  tenantId: true,
  ministryId: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  tenant: { select: tenantMiniSelect },
  ministry: { select: ministryMiniSelect },
  songs: {
    orderBy: { order: "asc" },
    select: {
      id: true,
      songId: true,
      order: true,
      isActive: true,
      deletedAt: true,
      song: { select: songMiniSelect },
    },
  },
  assignments: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      role: true,
      status: true,
      isActive: true,
      deletedAt: true,
      user: { select: userMiniSelect },
    },
  },
} as const;

const resourceConfig = {
  tenants: {
    delegate: "tenant",
    tenantField: "id",
    orderBy: { createdAt: "desc" },
    select: { ...tenantSummarySelect, _count: { select: { users: true, ministries: true, schedules: true, instruments: true } } },
  },
  users: { delegate: "user", tenantField: "tenantId", orderBy: { createdAt: "desc" }, select: userPublicSelect },
  ministries: { delegate: "ministry", tenantField: "tenantId", orderBy: [{ tenant: { name: "asc" } }, { name: "asc" }], select: ministryPublicSelect },
  "ministry-members": {
    delegate: "ministryMember",
    tenantField: "tenantId",
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      ministryId: true,
      tenantId: true,
      roleId: true,
      role: true,
      skills: true,
      status: true,
      joinedAt: true,
      notes: true,
      isLeader: true,
      isActive: true,
      deletedAt: true,
      createdAt: true,
      tenant: { select: tenantMiniSelect },
      user: { select: userMiniSelect },
      ministry: { select: ministryMiniSelect },
    },
  },
  "member-invites": {
    delegate: "memberInvite",
    tenantField: "tenantId",
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      tenantId: true,
      ministryId: true,
      code: true,
      active: true,
      isActive: true,
      deletedAt: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
      tenant: { select: tenantMiniSelect },
      ministry: { select: ministryMiniSelect },
    },
  },
  instruments: { delegate: "instrument", tenantField: "tenantId", orderBy: [{ tenant: { name: "asc" } }, { name: "asc" }], select: instrumentPublicSelect },
  "user-instruments": {
    delegate: "userInstrument",
    tenantField: "tenantId",
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      instrumentId: true,
      tenantId: true,
      isActive: true,
      deletedAt: true,
      createdAt: true,
      tenant: { select: tenantMiniSelect },
      user: { select: userMiniSelect },
      instrument: { select: { id: true, name: true, colorHex: true } },
    },
  },
  artists: { delegate: "artist", tenantField: "tenantId", orderBy: [{ tenant: { name: "asc" } }, { name: "asc" }], select: artistPublicSelect },
  songs: { delegate: "song", tenantField: "tenantId", orderBy: { updatedAt: "desc" }, select: songPublicSelect },
  "ministry-songs": {
    delegate: "ministrySong",
    tenantField: "tenantId",
    orderBy: { id: "desc" },
    select: {
      id: true,
      songId: true,
      ministryId: true,
      tenantId: true,
      isActive: true,
      deletedAt: true,
      tenant: { select: tenantMiniSelect },
      song: { select: songMiniSelect },
      ministry: { select: ministryMiniSelect },
    },
  },
  schedules: { delegate: "schedule", tenantField: "tenantId", orderBy: { date: "desc" }, select: schedulePublicSelect },
  "schedule-songs": {
    delegate: "scheduleSong",
    tenantField: "tenantId",
    orderBy: [{ schedule: { date: "desc" } }, { order: "asc" }],
    select: {
      id: true,
      scheduleId: true,
      songId: true,
      tenantId: true,
      order: true,
      isActive: true,
      deletedAt: true,
      createdAt: true,
      tenant: { select: tenantMiniSelect },
      schedule: { select: { id: true, title: true, date: true } },
      song: { select: songMiniSelect },
    },
  },
  "schedule-assignments": {
    delegate: "scheduleAssignment",
    tenantField: "tenantId",
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      scheduleId: true,
      userId: true,
      role: true,
      tenantId: true,
      status: true,
      isActive: true,
      deletedAt: true,
      createdAt: true,
      tenant: { select: tenantMiniSelect },
      schedule: { select: { id: true, title: true, date: true } },
      user: { select: userMiniSelect },
    },
  },
  "audit-logs": {
    delegate: "adminAuditLog",
    tenantField: "tenantId",
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      actorId: true,
      actorRole: true,
      action: true,
      resource: true,
      resourceId: true,
      tenantId: true,
      payload: true,
      createdAt: true,
      tenant: { select: tenantMiniSelect },
    },
  },
} as const;

type ResourceConfig = (typeof resourceConfig)[AdminResourceName];

export function isAdminResourceName(value: string): value is AdminResourceName {
  return adminResourceNames.includes(value as AdminResourceName);
}

export class AdminRepository {
  constructor(private readonly db: PrismaClient = basePrisma) {}

  private config(resource: AdminResourceName): ResourceConfig {
    return resourceConfig[resource];
  }

  private delegate(resource: AdminResourceName): any {
    const delegateName = this.config(resource).delegate;
    return (this.db as any)[delegateName];
  }

  listResource(resource: AdminResourceName, options: { tenantId?: string; search?: string; page?: number; limit?: number }) {
    const config = this.config(resource);
    const where = this.buildWhere(resource, config, options);
    const page = options.page ?? 1;
    const limit = options.limit ?? 25;
    return this.delegate(resource).findMany({
      where,
      orderBy: config.orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: config.select,
    });
  }

  countResource(resource: AdminResourceName, options: { tenantId?: string; search?: string }) {
    const config = this.config(resource);
    return this.delegate(resource).count({ where: this.buildWhere(resource, config, options) });
  }

  getResource(resource: AdminResourceName, id: string) {
    return this.delegate(resource).findUnique({ where: { id }, select: this.config(resource).select });
  }

  getResourceScoped(resource: AdminResourceName, id: string, tenantId: string) {
    const config = this.config(resource);
    return this.delegate(resource).findFirst({
      where: { id, [config.tenantField]: tenantId },
      select: config.select,
    });
  }

  createResource(resource: AdminResourceName, data: Record<string, unknown>) {
    return this.delegate(resource).create({ data, select: this.config(resource).select });
  }

  createScheduleResource(data: Record<string, unknown>, actorId: string) {
    return this.db.$transaction(async (tx) => {
      const created = await tx.schedule.create({
        data: { ...(data as Prisma.ScheduleUncheckedCreateInput), createdById: actorId },
        select: schedulePublicSelect,
      });
      const snapshot = await loadScheduleNotificationSnapshot(created.tenantId, created.id, tx);
      if (snapshot) await enqueueScheduleCreated(tx, snapshot, actorId);
      return created;
    });
  }

  mutateScheduleChildResource(
    resource: "schedule-assignments" | "schedule-songs",
    operation: "create" | "update" | "delete",
    actorId: string,
    data: Record<string, unknown> = {},
    id?: string,
  ) {
    return this.db.$transaction(async (tx) => {
      const current = id
        ? resource === "schedule-assignments"
          ? await tx.scheduleAssignment.findUnique({ where: { id }, select: { scheduleId: true, tenantId: true } })
          : await tx.scheduleSong.findUnique({ where: { id }, select: { scheduleId: true, tenantId: true } })
        : null;
      const nextScheduleId = typeof data.scheduleId === "string" ? data.scheduleId : current?.scheduleId;
      const nextTenantId = typeof data.tenantId === "string" ? data.tenantId : current?.tenantId;
      if (!nextScheduleId || !nextTenantId) throw new Error("Escala e igreja são obrigatórias");

      const affected = new Map<string, string>();
      if (current) affected.set(current.scheduleId, current.tenantId);
      affected.set(nextScheduleId, nextTenantId);
      const before = new Map<string, Awaited<ReturnType<typeof loadScheduleNotificationSnapshot>>>();
      for (const [scheduleId, tenantId] of affected) {
        before.set(scheduleId, await loadScheduleNotificationSnapshot(tenantId, scheduleId, tx));
      }

      let result: unknown;
      if (resource === "schedule-assignments") {
        if (operation === "create") {
          result = await tx.scheduleAssignment.create({
            data: { ...(data as Prisma.ScheduleAssignmentUncheckedCreateInput), status: "PENDING" },
            select: resourceConfig["schedule-assignments"].select,
          });
        } else if (operation === "update" && id) {
          result = await tx.scheduleAssignment.update({
            where: { id },
            data: data as Prisma.ScheduleAssignmentUncheckedUpdateInput,
            select: resourceConfig["schedule-assignments"].select,
          });
        } else if (id) {
          result = await tx.scheduleAssignment.delete({
            where: { id },
            select: resourceConfig["schedule-assignments"].select,
          });
        }
      } else if (operation === "create") {
        result = await tx.scheduleSong.create({
          data: data as unknown as Prisma.ScheduleSongUncheckedCreateInput,
          select: resourceConfig["schedule-songs"].select,
        });
      } else if (operation === "update" && id) {
        result = await tx.scheduleSong.update({
          where: { id },
          data: data as Prisma.ScheduleSongUncheckedUpdateInput,
          select: resourceConfig["schedule-songs"].select,
        });
      } else if (id) {
        result = await tx.scheduleSong.delete({
          where: { id },
          select: resourceConfig["schedule-songs"].select,
        });
      }

      for (const [scheduleId, tenantId] of affected) {
        const previous = before.get(scheduleId);
        const after = await loadScheduleNotificationSnapshot(tenantId, scheduleId, tx);
        if (previous && after) await enqueueScheduleUpdated(tx, previous, after, actorId);
      }
      return result;
    });
  }

  updateResource(resource: AdminResourceName, id: string, data: Record<string, unknown>) {
    return this.delegate(resource).update({ where: { id }, data, select: this.config(resource).select });
  }

  updateScheduleLifecycle(scheduleId: string, data: Record<string, unknown>, actorId: string) {
    return this.db.$transaction(async (tx) => {
      const current = await tx.schedule.findUniqueOrThrow({ where: { id: scheduleId }, select: { tenantId: true } });
      const before = await loadScheduleNotificationSnapshot(current.tenantId, scheduleId, tx);
      const updated = await tx.schedule.update({
        where: { id: scheduleId },
        data: data as Prisma.ScheduleUncheckedUpdateInput,
        select: schedulePublicSelect,
      });
      const cancelled = data.isActive === false || data.deletedAt instanceof Date;
      if (before && cancelled) {
        await enqueueScheduleCancelled(tx, before, actorId);
      } else if (before) {
        const after = await loadScheduleNotificationSnapshot(current.tenantId, scheduleId, tx);
        if (after) await enqueueScheduleUpdated(tx, before, after, actorId);
      }
      return updated;
    });
  }

  activateResource(resource: AdminResourceName, id: string) {
    return this.updateResource(resource, id, { isActive: true, deletedAt: null, ...(resource === "member-invites" ? { active: true } : {}) });
  }

  deactivateResource(resource: AdminResourceName, id: string) {
    return this.updateResource(resource, id, { isActive: false, deletedAt: new Date(), ...(resource === "member-invites" ? { active: false } : {}) });
  }

  deleteResource(resource: AdminResourceName, id: string) {
    return this.delegate(resource).delete({ where: { id }, select: this.config(resource).select });
  }

  deleteScheduleResource(scheduleId: string, actorId: string) {
    return this.db.$transaction(async (tx) => {
      const current = await tx.schedule.findUniqueOrThrow({ where: { id: scheduleId }, select: { tenantId: true } });
      const before = await loadScheduleNotificationSnapshot(current.tenantId, scheduleId, tx);
      const deleted = await tx.schedule.delete({ where: { id: scheduleId }, select: schedulePublicSelect });
      if (before) await enqueueScheduleCancelled(tx, before, actorId);
      return deleted;
    });
  }

  listTenants() {
    return this.listResource("tenants", { page: 1, limit: 200 });
  }

  getTenantById(tenantId: string) {
    return this.db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        ...tenantSummarySelect,
        users: { select: userPublicSelect, orderBy: { name: "asc" } },
        ministries: { orderBy: { name: "asc" }, select: ministryPublicSelect },
        instruments: { orderBy: { name: "asc" }, select: instrumentPublicSelect },
        _count: { select: { users: true, ministries: true, schedules: true, instruments: true } },
      },
    });
  }

  updateTenant(tenantId: string, data: Prisma.TenantUpdateInput) {
    return this.updateResource("tenants", tenantId, data as Record<string, unknown>);
  }

  listUsers(tenantId?: string) {
    return this.listResource("users", { tenantId, page: 1, limit: 500 });
  }

  findUserById(userId: string) {
    return this.db.user.findUnique({ where: { id: userId }, select: userPublicSelect });
  }

  findUserByEmail(email: string) {
    return this.db.user.findUnique({ where: { email }, select: { id: true } });
  }

  updateUser(userId: string, data: Prisma.UserUpdateInput) {
    return this.updateResource("users", userId, data as Record<string, unknown>);
  }

  countGlobalAdmins() {
    return this.db.user.count({ where: { role: Role.GLOBAL_ADMIN, isActive: true, deletedAt: null } });
  }

  updateUserAndCleanupPermissions(userId: string, data: Prisma.UserUpdateInput, cleanupPermissions: boolean) {
    return this.db.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: userId }, data, select: userPublicSelect });
      if (cleanupPermissions) await tx.userPermission.deleteMany({ where: { userId } });
      return updated;
    });
  }

  listMinistries() {
    return this.listResource("ministries", { page: 1, limit: 500 });
  }

  findTenantById(tenantId: string) {
    return this.db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  }

  listSongs(tenantId?: string) {
    return this.listResource("songs", { tenantId, page: 1, limit: 500 });
  }

  getSongById(songId: string) {
    return this.db.song.findUnique({ where: { id: songId }, select: { id: true, tenantId: true, artistId: true } });
  }

  updateSong(songId: string, data: Prisma.SongUpdateInput) {
    return this.updateResource("songs", songId, data as Record<string, unknown>);
  }

  listSchedules(tenantId?: string) {
    return this.listResource("schedules", { tenantId, page: 1, limit: 500 });
  }

  getScheduleById(scheduleId: string) {
    return this.db.schedule.findUnique({
      where: { id: scheduleId },
      select: { id: true, tenantId: true, ministryId: true, assignments: { select: { id: true, userId: true, role: true, status: true } } },
    });
  }

  updateSchedule(
    scheduleId: string,
    data: Prisma.ScheduleUpdateInput,
    songIds?: string[],
    assignments?: Array<{ userId: string; role: string }>,
    actorId?: string,
  ) {
    return this.db.$transaction(async (tx) => {
      const currentSchedule = await tx.schedule.findUnique({ where: { id: scheduleId }, select: { tenantId: true } });
      const before = actorId && currentSchedule ? await loadScheduleNotificationSnapshot(currentSchedule.tenantId, scheduleId, tx) : null;
      const schedule = await tx.schedule.update({ where: { id: scheduleId }, data, select: { id: true, tenantId: true } });

      if (songIds) {
        await tx.scheduleSong.deleteMany({ where: { scheduleId } });
        if (songIds.length > 0) {
          await tx.scheduleSong.createMany({ data: songIds.map((songId, order) => ({ scheduleId, songId, tenantId: schedule.tenantId, order })) });
        }
      }

      if (assignments) {
        const existing = await tx.scheduleAssignment.findMany({ where: { scheduleId } });
        const requestedUserIds = new Set(assignments.map((assignment) => assignment.userId));
        await tx.scheduleAssignment.deleteMany({ where: { scheduleId, userId: { notIn: [...requestedUserIds] } } });
        for (const assignment of assignments) {
          const current = existing.find((item) => item.userId === assignment.userId);
          if (!current) {
            await tx.scheduleAssignment.create({ data: { scheduleId, userId: assignment.userId, role: assignment.role, status: "PENDING", tenantId: schedule.tenantId } });
          } else if (current.role !== assignment.role) {
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
      }

      const updated = await tx.schedule.findUniqueOrThrow({ where: { id: scheduleId }, select: schedulePublicSelect });
      if (actorId && before) {
        const after = await loadScheduleNotificationSnapshot(schedule.tenantId, scheduleId, tx);
        if (after) await enqueueScheduleUpdated(tx, before, after, actorId);
      }
      return updated;
    });
  }

  countSongsByIds(tenantId: string, songIds: string[]) {
    return this.db.song.count({ where: { tenantId, id: { in: songIds } } });
  }

  countUsersByIds(tenantId: string, userIds: string[]) {
    return this.db.user.count({ where: { tenantId, id: { in: userIds }, isActive: true, deletedAt: null } });
  }

  findUsersWithAssignmentRoles(tenantId: string, userIds: string[]) {
    return this.db.user.findMany({
      where: { tenantId, id: { in: userIds }, isActive: true, deletedAt: null },
      select: {
        id: true,
        instruments: {
          where: { isActive: true, deletedAt: null, instrument: { isActive: true, deletedAt: null, tenantId } },
          select: { instrument: { select: { name: true } } },
        },
      },
    });
  }

  getScheduleAssignmentById(id: string) {
    return this.db.scheduleAssignment.findUnique({ where: { id }, select: { id: true, tenantId: true, userId: true, role: true } });
  }

  findMinistryById(tenantId: string, ministryId: string) {
    return this.db.ministry.findFirst({ where: { id: ministryId, tenantId }, select: { id: true } });
  }

  findArtistById(tenantId: string, artistId: string) {
    return this.db.artist.findFirst({ where: { id: artistId, tenantId }, select: { id: true } });
  }

  findTenantIdFor(resource: AdminResourceName, id: string): Promise<{ tenantId: string | null } | null> {
    const config = this.config(resource);
    const tenantField = config.tenantField;
    if (resource === "tenants") return this.db.tenant.findUnique({ where: { id }, select: { id: true } }).then((tenant) => tenant ? { tenantId: tenant.id } : null);
    if (tenantField === "tenantId") return this.delegate(resource).findUnique({ where: { id }, select: { tenantId: true } });
    return Promise.resolve(null);
  }

  findEntityTenant(resource: "users" | "ministries" | "instruments" | "artists" | "songs" | "schedules", id: string) {
    return this.delegate(resource).findUnique({ where: { id }, select: { id: true, tenantId: true } });
  }

  createAuditLog(data: { actorId: string; actorRole: string; action: string; resource: string; resourceId?: string | null; tenantId?: string | null; requestId?: string | null; payload?: Prisma.InputJsonValue }) {
    return this.db.adminAuditLog.create({ data: data as any });
  }

  private buildWhere(resource: AdminResourceName, config: ResourceConfig, options: { tenantId?: string; search?: string }) {
    const and: Array<Record<string, unknown>> = [];
    if (options.tenantId) {
      and.push(resource === "tenants" ? { id: options.tenantId } : { [config.tenantField]: options.tenantId });
    }

    const search = options.search?.trim();
    if (search) {
      if (resource === "tenants" || resource === "ministries" || resource === "instruments" || resource === "artists") {
        and.push({ name: { contains: search, mode: "insensitive" } });
      } else if (resource === "users") {
        and.push({ OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] });
      } else if (resource === "songs" || resource === "schedules") {
        and.push({ title: { contains: search, mode: "insensitive" } });
      } else if (resource === "member-invites") {
        and.push({ code: { contains: search, mode: "insensitive" } });
      } else if (resource === "audit-logs") {
        and.push({ OR: [{ action: { contains: search, mode: "insensitive" } }, { resource: { contains: search, mode: "insensitive" } }] });
      }
    }

    return and.length > 0 ? { AND: and } : undefined;
  }
}
