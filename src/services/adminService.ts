import bcrypt from "bcryptjs";
import { revokeTenantSessions, revokeUserSessions } from "./authSessionService";
import { Prisma, Role } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors/AppError";
import { config } from "../config/unifiedConfig";
import { AdminRepository, AdminResourceName, adminResourceNames } from "../repositories/AdminRepository";
import { DEFAULT_INSTRUMENTS } from "../constants/defaultInstruments";
import { normalizeCatalogText } from "../utils/catalogNormalization";
import { AdminEventType, buildAdminAuditData } from "../audit/adminAudit";
import { richTextCommentsSchema } from "../validators/richText.schema";
import {
  AdminUpdateScheduleInput,
  AdminUpdateSongInput,
  AdminUpdateTenantInput,
  AdminUpdateUserInput,
} from "../validators/admin.schema";

type AdminActor = { id: string; role: Role };

const writableFields: Record<AdminResourceName, string[]> = {
  tenants: ["name", "domain", "comments", "isActive", "deletedAt"],
  users: ["name", "email", "phone", "avatarUrl", "comments", "role", "tenantId", "password", "isActive", "deletedAt"],
  ministries: ["name", "description", "comments", "tenantId", "isActive", "deletedAt"],
  "ministry-members": ["userId", "ministryId", "tenantId", "roleId", "role", "skills", "status", "joinedAt", "notes", "isLeader", "isActive", "deletedAt"],
  "member-invites": ["tenantId", "ministryId", "code", "active", "expiresAt", "isActive", "deletedAt"],
  instruments: ["name", "colorHex", "tenantId", "isActive", "deletedAt"],
  "user-instruments": ["userId", "instrumentId", "tenantId", "isActive", "deletedAt"],
  artists: ["name", "imageUrl", "tenantId", "isActive", "deletedAt"],
  songs: ["title", "composer", "originalKey", "content", "comments", "bpm", "cifraUrl", "letraUrl", "audioUrl", "videoUrl", "artistId", "tenantId", "isActive", "deletedAt"],
  "ministry-songs": ["songId", "ministryId", "tenantId", "isActive", "deletedAt"],
  schedules: ["title", "date", "comments", "tenantId", "ministryId", "isActive", "deletedAt"],
  "schedule-songs": ["scheduleId", "songId", "tenantId", "order", "isActive", "deletedAt"],
  "schedule-assignments": ["scheduleId", "userId", "role", "tenantId", "status", "isActive", "deletedAt"],
  "audit-logs": [],
};

export class AdminService {
  constructor(private readonly repository = new AdminRepository()) {}

  listResources() {
    return adminResourceNames.map((name) => ({ name }));
  }

  async listResource(resource: AdminResourceName, query: { tenantId?: string; search?: string; page: number; limit: number }) {
    const [items, total] = await Promise.all([
      this.repository.listResource(resource, query),
      this.repository.countResource(resource, query),
    ]);
    return { items, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) } };
  }

  async getResource(resource: AdminResourceName, id: string) {
    const item = await this.repository.getResource(resource, id);
    if (!item) throw new NotFoundError("Registro não encontrado");
    return item;
  }

  async createResource(actor: AdminActor, resource: AdminResourceName, input: Record<string, unknown>) {
    if (resource === "audit-logs") throw new ValidationError("Logs administrativos não podem ser criados manualmente");
    if (resource === "users" && input.role === Role.GLOBAL_ADMIN) {
      throw new ValidationError("Crie o usuário sem poder global e use o fluxo controlado de promoção");
    }
    const data = await this.prepareResourceData(resource, input, "create");
    await this.validateResourceRelations(resource, data);
    const created = await this.repository.createResource(resource, data);
    await this.audit(actor, "create", resource, this.extractId(created), this.extractTenantId(created, data), data);
    return created;
  }

  async updateResource(actor: AdminActor, resource: AdminResourceName, id: string, input: Record<string, unknown>) {
    if (resource === "audit-logs") throw new ValidationError("Logs administrativos não podem ser editados");
    await this.getResource(resource, id);
    const data = await this.prepareResourceData(resource, input, "update");
    await this.validateResourceRelations(resource, data, resource, id);
    const updated = await this.repository.updateResource(resource, id, data);
    await this.audit(actor, "update", resource, id, this.extractTenantId(updated, data), data);
    return updated;
  }

  async activateResource(actor: AdminActor, resource: AdminResourceName, id: string) {
    if (resource === "audit-logs") throw new ValidationError("Logs administrativos não podem ser ativados");
    await this.getResource(resource, id);
    const updated = await this.repository.activateResource(resource, id);
    await this.audit(actor, "activate", resource, id, this.extractTenantId(updated), {});
    return updated;
  }

  async deactivateResource(actor: AdminActor, resource: AdminResourceName, id: string) {
    if (resource === "audit-logs") throw new ValidationError("Logs administrativos não podem ser inativados");
    await this.getResource(resource, id);
    const updated = await this.repository.deactivateResource(resource, id);
    if (resource === "users") await revokeUserSessions(id, "user_deactivated");
    if (resource === "tenants") await revokeTenantSessions(id, "tenant_deactivated");
    await this.audit(actor, "deactivate", resource, id, this.extractTenantId(updated), {});
    return updated;
  }

  async deleteResource(actor: AdminActor, resource: AdminResourceName, id: string) {
    if (resource === "audit-logs") throw new ValidationError("Logs administrativos não podem ser excluídos");
    const before = await this.getResource(resource, id);
    const deleted = await this.repository.deleteResource(resource, id);
    await this.audit(actor, "delete", resource, id, this.extractTenantId(before), {});
    return deleted;
  }

  listTenants() {
    return this.repository.listTenants();
  }

  async getTenantById(tenantId: string) {
    const tenant = await this.repository.getTenantById(tenantId);
    if (!tenant) throw new NotFoundError("Igreja não encontrada");
    return tenant;
  }

  async updateTenant(actor: AdminActor, tenantId: string, input: AdminUpdateTenantInput) {
    await this.ensureTenantExists(tenantId);
    const updated = await this.repository.updateTenant(tenantId, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.domain !== undefined ? { domain: input.domain } : {}),
      ...(input.comments !== undefined ? { comments: input.comments } : {}),
    });
    await this.audit(actor, "update", "tenants", tenantId, tenantId, input);
    return updated;
  }

  listUsers(tenantId?: string) {
    return this.repository.listUsers(tenantId);
  }

  async updateUser(actor: AdminActor, userId: string, input: AdminUpdateUserInput) {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new NotFoundError("Usuário não encontrado");

    if (actor.id === userId && (input.role !== undefined || input.tenantId !== undefined)) {
      throw new ForbiddenError("Administrador global não pode alterar a própria role ou vínculo de tenant");
    }

    if (input.email && input.email !== user.email) {
      const existing = await this.repository.findUserByEmail(input.email);
      if (existing && existing.id !== userId) throw new ConflictError("E-mail já está em uso");
    }

    if (input.tenantId !== undefined && input.tenantId !== null) await this.ensureTenantExists(input.tenantId);
    const nextRole = input.role ?? user.role;
    const nextTenantId = input.tenantId !== undefined ? input.tenantId : user.tenantId;
    if (nextRole === Role.GLOBAL_ADMIN && nextTenantId !== null) {
      throw new ValidationError("GLOBAL_ADMIN deve permanecer sem vínculo de tenant");
    }
    if (nextRole !== Role.GLOBAL_ADMIN && !nextTenantId) {
      throw new ValidationError("Usuário não-global deve estar vinculado a uma igreja");
    }

    const globalTransition = input.role !== undefined && input.role !== user.role &&
      (input.role === Role.GLOBAL_ADMIN || user.role === Role.GLOBAL_ADMIN);
    if (globalTransition) {
      const action = input.role === Role.GLOBAL_ADMIN ? "PROMOTE" : "DEMOTE";
      if (!input.reason || !input.ticketReference || input.confirmation !== `${action} ${user.email}`) {
        throw new ValidationError(`Transição GLOBAL_ADMIN exige motivo, ticket e confirmação: ${action} ${user.email}`);
      }
      if (input.role === Role.GLOBAL_ADMIN && config.auth.mfa.globalAdminRequired && !user.mfaEnabledAt) {
        throw new ValidationError("MFA deve estar habilitado antes da promoção para GLOBAL_ADMIN");
      }
      if (user.role === Role.GLOBAL_ADMIN && await this.repository.countGlobalAdmins() <= 1) {
        throw new ValidationError("O último GLOBAL_ADMIN ativo não pode ser rebaixado");
      }
    }

    const data: Prisma.UserUpdateInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.comments !== undefined ? { comments: input.comments } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.tenantId !== undefined ? input.tenantId === null ? { tenant: { disconnect: true } } : { tenant: { connect: { id: input.tenantId } } } : {}),
      ...(input.password !== undefined ? { password: await bcrypt.hash(input.password, 10) } : {}),
    };

    const cleanupPermissions = nextRole === Role.GLOBAL_ADMIN || nextTenantId !== user.tenantId;
    const updated = await this.repository.updateUserAndCleanupPermissions(userId, data, cleanupPermissions);
    if (input.password !== undefined || globalTransition || nextTenantId !== user.tenantId) {
      await revokeUserSessions(userId, globalTransition ? "global_admin_role_changed" : "identity_changed_by_admin");
    }
    await this.audit(actor, "update", "users", userId, updated.tenantId, {
      roleBefore: user.role,
      roleAfter: updated.role,
      tenantIdBefore: user.tenantId,
      tenantIdAfter: updated.tenantId,
      permissionOverridesCleared: cleanupPermissions,
      reason: input.reason,
      ticketReference: input.ticketReference,
    });
    return updated;
  }

  listMinistries() {
    return this.repository.listMinistries();
  }

  listSongs(tenantId?: string) {
    return this.repository.listSongs(tenantId);
  }

  async updateSong(actor: AdminActor, songId: string, input: AdminUpdateSongInput) {
    const song = await this.repository.getSongById(songId);
    if (!song) throw new NotFoundError("Música não encontrada");
    if (input.artistId !== undefined) {
      const artist = await this.repository.findArtistById(song.tenantId, input.artistId);
      if (!artist) throw new ValidationError("Artista não pertence à igreja da música");
    }

    const updated = await this.repository.updateSong(songId, {
      ...(input.title !== undefined ? { title: input.title, normalizedTitle: normalizeCatalogText(input.title) } : {}),
      ...(input.composer !== undefined ? { composer: input.composer } : {}),
      ...(input.originalKey !== undefined ? { originalKey: input.originalKey } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.comments !== undefined ? { comments: input.comments } : {}),
      ...(input.bpm !== undefined ? { bpm: input.bpm } : {}),
      ...(input.cifraUrl !== undefined ? { cifraUrl: input.cifraUrl } : {}),
      ...(input.letraUrl !== undefined ? { letraUrl: input.letraUrl } : {}),
      ...(input.audioUrl !== undefined ? { audioUrl: input.audioUrl } : {}),
      ...(input.videoUrl !== undefined ? { videoUrl: input.videoUrl } : {}),
      ...(input.artistId !== undefined ? { artist: { connect: { id: input.artistId } } } : {}),
    });
    await this.audit(actor, "update", "songs", songId, song.tenantId, input);
    return updated;
  }

  listSchedules(tenantId?: string) {
    return this.repository.listSchedules(tenantId);
  }

  async updateSchedule(actor: AdminActor, scheduleId: string, input: AdminUpdateScheduleInput) {
    const schedule = await this.repository.getScheduleById(scheduleId);
    if (!schedule) throw new NotFoundError("Escala não encontrada");
    if (input.ministryId !== undefined) {
      const ministry = await this.repository.findMinistryById(schedule.tenantId, input.ministryId);
      if (!ministry) throw new ValidationError("Ministério não pertence à igreja da escala");
    }
    if (input.songIds !== undefined) {
      const uniqueSongIds = [...new Set(input.songIds)];
      if (uniqueSongIds.length !== input.songIds.length) throw new ValidationError("A escala não pode conter músicas repetidas");
      const count = await this.repository.countSongsByIds(schedule.tenantId, uniqueSongIds);
      if (count !== uniqueSongIds.length) throw new ValidationError("Uma ou mais músicas não pertencem à igreja da escala");
    }
    if (input.assignments !== undefined) {
      const userIds = input.assignments.map((assignment) => assignment.userId);
      const uniqueUserIds = [...new Set(userIds)];
      if (uniqueUserIds.length !== userIds.length) throw new ValidationError("A escala não pode conter o mesmo usuário mais de uma vez");
      const count = await this.repository.countUsersByIds(schedule.tenantId, uniqueUserIds);
      if (count !== uniqueUserIds.length) throw new ValidationError("Um ou mais usuários não pertencem à igreja da escala");
    }

    const updated = await this.repository.updateSchedule(
      scheduleId,
      {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.date !== undefined ? { date: input.date } : {}),
        ...(input.ministryId !== undefined ? { ministry: { connect: { id: input.ministryId } } } : {}),
        ...(input.comments !== undefined ? { comments: input.comments } : {}),
      },
      input.songIds,
      input.assignments
    );
    await this.audit(actor, "update", "schedules", scheduleId, schedule.tenantId, {
      ...input,
      ...(input.date ? { date: input.date.toISOString() } : {}),
    });
    return updated;
  }

  private async prepareResourceData(resource: AdminResourceName, input: Record<string, unknown>, mode: "create" | "update") {
    const data: Record<string, unknown> = {};
    for (const field of writableFields[resource]) {
      if (Object.prototype.hasOwnProperty.call(input, field)) data[field] = input[field];
    }
    if (Object.prototype.hasOwnProperty.call(data, "comments")) {
      const parsedComments = richTextCommentsSchema.safeParse(data.comments);
      if (!parsedComments.success) throw new ValidationError(parsedComments.error.issues[0]?.message ?? "Comentários inválidos");
      data.comments = parsedComments.data;
    }
    if (mode === "update" && Object.keys(data).length === 0) throw new ValidationError("Informe ao menos um campo para atualizar");
    if (resource === "users") {
      if (typeof data.email === "string") data.email = data.email.trim().toLowerCase();
      if (typeof data.password === "string") data.password = await bcrypt.hash(data.password, 10);
      const role = data.role as Role | undefined;
      if (data.tenantId === null && role !== Role.GLOBAL_ADMIN) throw new ValidationError("Somente GLOBAL_ADMIN pode ficar sem igreja vinculada");
      if (mode === "create" && data.tenantId === undefined && role !== Role.GLOBAL_ADMIN) throw new ValidationError("Usuário não-global deve estar vinculado a uma igreja");
    }
    if (resource === "artists" && typeof data.name === "string") data.normalizedName = normalizeCatalogText(data.name);
    if (resource === "songs" && typeof data.title === "string") data.normalizedTitle = normalizeCatalogText(data.title);
    if (resource === "tenants" && mode === "create") {
      data.instruments = { create: DEFAULT_INSTRUMENTS.map((instrument) => ({ name: instrument.name, colorHex: instrument.colorHex })) };
    }
    if (resource === "schedules" && typeof data.date === "string") data.date = new Date(data.date);
    if (resource === "member-invites" && typeof data.expiresAt === "string") data.expiresAt = new Date(data.expiresAt);
    if (typeof data.deletedAt === "string") data.deletedAt = new Date(data.deletedAt);
    return data;
  }

  private async validateResourceRelations(resource: AdminResourceName, data: Record<string, unknown>, currentResource?: AdminResourceName, currentId?: string) {
    const tenantId = await this.resolveTenantId(resource, data, currentResource, currentId);
    if (tenantId) await this.ensureTenantExists(tenantId);
    if (resource === "users") {
      if (data.tenantId !== undefined && data.tenantId !== null) await this.ensureTenantExists(String(data.tenantId));
      if (data.email) {
        const existing = await this.repository.findUserByEmail(String(data.email));
        if (existing && existing.id !== currentId) throw new ConflictError("E-mail já está em uso");
      }
      return;
    }

    const checks: Array<[AdminResourceName, string | undefined, string]> = [];
    if (data.userId) checks.push(["users", String(data.userId), "Usuário"]);
    if (data.ministryId) checks.push(["ministries", String(data.ministryId), "Ministério"]);
    if (data.instrumentId) checks.push(["instruments", String(data.instrumentId), "Instrumento"]);
    if (data.artistId) checks.push(["artists", String(data.artistId), "Artista"]);
    if (data.songId) checks.push(["songs", String(data.songId), "Música"]);
    if (data.scheduleId) checks.push(["schedules", String(data.scheduleId), "Escala"]);

    for (const [relatedResource, relatedId, label] of checks) {
      if (!relatedId) continue;
      const related = await this.repository.findEntityTenant(relatedResource as any, relatedId);
      if (!related) throw new ValidationError(`${label} não encontrado`);
      if (tenantId && related.tenantId !== tenantId) throw new ValidationError(`${label} não pertence à mesma igreja`);
      if (!tenantId && related.tenantId) data.tenantId = related.tenantId;
    }
  }

  private async resolveTenantId(resource: AdminResourceName, data: Record<string, unknown>, currentResource?: AdminResourceName, currentId?: string) {
    if (resource === "tenants" && currentId) return currentId;
    if (typeof data.tenantId === "string") return data.tenantId;
    if (resource === "users" && data.tenantId === null) return null;
    if (currentResource && currentId) {
      const current = await this.repository.findTenantIdFor(currentResource, currentId);
      if (current?.tenantId) return current.tenantId;
    }
    return null;
  }

  private async ensureTenantExists(tenantId: string) {
    const tenant = await this.repository.findTenantById(tenantId);
    if (!tenant) throw new NotFoundError("Igreja não encontrada");
  }

  private async audit(actor: AdminActor, action: AdminEventType, resource: AdminResourceName, resourceId?: string | null, tenantId?: string | null, payload?: Record<string, unknown>) {
    await this.repository.createAuditLog(buildAdminAuditData({
      actorId: actor.id,
      actorRole: actor.role,
      action,
      resource,
      resourceId,
      tenantId: tenantId ?? null,
      payload,
    }));
  }

  private extractId(item: unknown): string | null {
    return typeof item === "object" && item !== null && "id" in item ? String((item as { id: unknown }).id) : null;
  }

  private extractTenantId(item: unknown, fallback?: Record<string, unknown>): string | null {
    if (typeof item === "object" && item !== null) {
      if ("tenantId" in item && typeof (item as { tenantId?: unknown }).tenantId === "string") return (item as { tenantId: string }).tenantId;
      if ("id" in item && fallback?.instruments) return String((item as { id: unknown }).id);
    }
    if (fallback?.tenantId && typeof fallback.tenantId === "string") return fallback.tenantId;
    return null;
  }
}
