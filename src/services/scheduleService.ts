import { Role } from "@prisma/client";
import { ScheduleRepository } from "../repositories/ScheduleRepository";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors/AppError";
import { CreateAssignmentInput, CreateScheduleInput, ListSchedulesInput, ResolveSubstitutionInput, UpdateAssignmentStatusInput, UpdateScheduleInput } from "../validators/schedule.schema";
import { hasPermission, requireUserPermission } from "./permissionService";

type RequestUser = { id: string; role: Role; tenantId?: string };

export class ScheduleService {
  constructor(private readonly scheduleRepository: ScheduleRepository) {}

  /**
   * Lists schedules visible to the authenticated tenant.
   *
   * @returns Tenant-scoped schedules.
   */
  async listAll(filters: Partial<ListSchedulesInput> = {}) {
    return this.scheduleRepository.findAll(filters);
  }

  /**
   * Creates a schedule after validating ministry ownership.
   *
   * @param data Validated schedule input.
   * @returns The created schedule.
   */
  async create(data: CreateScheduleInput) {
    const ministry = await this.scheduleRepository.findMinistryById(data.ministryId);
    if (!ministry) {
      throw new NotFoundError("Ministério não encontrado");
    }

    return this.scheduleRepository.create(data);
  }

  private isAdmin(role: Role) {
    return role === Role.GLOBAL_ADMIN;
  }

  private async hasScheduleManagementPermission(user: RequestUser) {
    return (
      await hasPermission(user, "schedule:edit", user.tenantId) ||
      await hasPermission(user, "schedule:delete", user.tenantId) ||
      await hasPermission(user, "schedule:assign_members", user.tenantId)
    );
  }

  private async ensureCanManageSchedule(scheduleId: string, user: RequestUser) {
    const schedule = await this.scheduleRepository.findScheduleById(scheduleId);
    if (!schedule) {
      throw new NotFoundError("Escala não encontrada");
    }

    if (this.isAdmin(user.role) || await this.hasScheduleManagementPermission(user)) {
      return schedule;
    }

    if (user.role !== Role.MINISTRY_LEADER) {
      if (false) {
        throw new ForbiddenError("Usuário sem permissão para escalar membros");
      }
      throw new ForbiddenError("Perfil sem permissão para gerenciar escalas");
    }

    const leadership = await this.scheduleRepository.findMinistryLeadership(schedule.ministryId, user.id);
    if (!leadership) {
      throw new ForbiddenError("Líder só pode gerenciar escalas dos ministérios que lídera");
    }

    return schedule;
  }

  async createForUser(data: CreateScheduleInput, user: RequestUser) {
    const ministry = await this.scheduleRepository.findMinistryById(data.ministryId);
    if (!ministry) {
      throw new NotFoundError("Ministério não encontrado");
    }

    await this.ensureSongsBelongToTenant(data.songIds);
    await requireUserPermission(user, "schedule:create", user.tenantId);
    if (data.songIds.length > 0) {
      await requireUserPermission(user, "song:attach_to_schedule", user.tenantId);
    }

    if (user.role === Role.MINISTRY_LEADER) {
      const leadership = await this.scheduleRepository.findMinistryLeadership(data.ministryId, user.id);
      if (!leadership) throw new ForbiddenError("Líder só pode criar escalas dos ministérios que lidera");
    }

    if (data.assignments.length === 0 || this.isAdmin(user.role) || await hasPermission(user, "schedule:assign_members", user.tenantId)) {
      await this.ensureAssignmentsAreAllowed(data.ministryId, data.assignments, user);
      return this.scheduleRepository.create(data, user.id);
    }

    if (user.role !== Role.MINISTRY_LEADER) {
      throw new ForbiddenError("Perfil sem permissão para criar escalas");
    }

    const leadership = await this.scheduleRepository.findMinistryLeadership(data.ministryId, user.id);
    if (!leadership) {
      throw new ForbiddenError("Líder só pode criar escalas dos ministérios que lídera");
    }

    await this.ensureAssignmentsAreAllowed(data.ministryId, data.assignments, user);
    return this.scheduleRepository.create(data, user.id);
  }

  async updateForUser(scheduleId: string, data: UpdateScheduleInput, user: RequestUser) {
    await requireUserPermission(user, "schedule:edit", user.tenantId);
    await this.ensureCanManageSchedule(scheduleId, user);

    const ministry = await this.scheduleRepository.findMinistryById(data.ministryId);
    if (!ministry) {
      throw new NotFoundError("Ministério não encontrado");
    }

    await this.ensureSongsBelongToTenant(data.songIds);
    if (data.songIds.length > 0) {
      await requireUserPermission(user, "song:attach_to_schedule", user.tenantId);
    }
    if (data.assignments.length > 0) {
      await requireUserPermission(user, "schedule:assign_members", user.tenantId);
    }

    if (!await hasPermission(user, "schedule:assign_members", user.tenantId) && user.role === Role.MINISTRY_LEADER) {
      const leadership = await this.scheduleRepository.findMinistryLeadership(data.ministryId, user.id);
      if (!leadership) {
        throw new ForbiddenError("Líder só pode mover escalas para ministérios que lidera");
      }
    }

    const existingAssignments = await this.scheduleRepository.findScheduleAssignments(scheduleId);
    await this.ensureAssignmentsAreAllowed(
      data.ministryId,
      data.assignments,
      user,
      new Map(existingAssignments.map((assignment) => [assignment.userId, assignment.role])),
    );
    const updated = await this.scheduleRepository.update(scheduleId, data, user.id);
    if (!updated) {
      throw new NotFoundError("Escala não encontrada");
    }
    return updated;
  }

  async deleteForUser(scheduleId: string, user: RequestUser) {
    await requireUserPermission(user, "schedule:delete", user.tenantId);
    await this.ensureCanManageSchedule(scheduleId, user);
    const deleted = await this.scheduleRepository.deleteSchedule(scheduleId, user.id);
    if (!deleted) {
      throw new NotFoundError("Escala nÃ£o encontrada");
    }
    return {
      ...deleted,
      message: "Escala cancelada e removida das listas ativas. As atribuiÃ§Ãµes relacionadas foram desativadas para preservar histÃ³rico.",
    };
  }

  async addAssignment(scheduleId: string, data: CreateAssignmentInput, user: RequestUser) {
    await requireUserPermission(user, "schedule:assign_members", user.tenantId);
    const schedule = await this.ensureCanManageSchedule(scheduleId, user);

    const targetUser = await this.scheduleRepository.findTenantUserById(data.userId);
    if (!targetUser) {
      throw new NotFoundError("Usuário não encontrado neste tenant");
    }

    if (!this.isAdmin(user.role) && !await hasPermission(user, "schedule:assign_members", user.tenantId) && user.role === Role.MINISTRY_LEADER) {
      await this.ensureUserBelongsToMinistry(schedule.ministryId, data.userId);
    }

    await this.ensureAssignmentsHaveProfileRoles([data]);

    try {
      const assignment = await this.scheduleRepository.createAssignment(scheduleId, data, user.id);
      if (!assignment) {
        throw new NotFoundError("Escala ou usuário não encontrado");
      }
      return assignment;
    } catch (error: any) {
      if (error?.code === "P2002") {
        throw new ValidationError("Usuário já está atribuído a esta escala");
      }
      throw error;
    }
  }

  async updateAssignmentStatus(
    scheduleId: string,
    assignmentId: string,
    data: UpdateAssignmentStatusInput,
    user: RequestUser
  ) {
    await requireUserPermission(user, "schedule:respond", user.tenantId);
    const assignment = await this.scheduleRepository.findAssignment(scheduleId, assignmentId);
    if (!assignment) {
      throw new NotFoundError("Atribuição não encontrada");
    }

    if (assignment.userId === user.id) {
      if (assignment.status !== "PENDING") {
        throw new ValidationError("Esta escala já foi respondida.");
      }
      const updated = await this.scheduleRepository.updateAssignmentStatus(scheduleId, assignmentId, data, user.id);
      if (!updated) {
        throw new NotFoundError("Atribuição não encontrada");
      }
      return updated;
    }

    const canManageStatus =
      this.isAdmin(user.role) ||
      await hasPermission(user, "schedule:edit", user.tenantId) ||
      await hasPermission(user, "schedule:assign_members", user.tenantId);

    if (canManageStatus) {
      const updated = await this.scheduleRepository.updateAssignmentStatus(scheduleId, assignmentId, data, user.id);
      if (!updated) {
        throw new NotFoundError("Atribuição não encontrada");
      }
      return updated;
    }

    if (user.role === Role.MINISTRY_LEADER) {
      const leadership = await this.scheduleRepository.findMinistryLeadership(assignment.schedule.ministryId, user.id);
      if (leadership) {
        const updated = await this.scheduleRepository.updateAssignmentStatus(scheduleId, assignmentId, data, user.id);
        if (!updated) {
          throw new NotFoundError("Atribuição não encontrada");
        }
        return updated;
      }
    }

    throw new ForbiddenError("Você só pode alterar a sua própria atribuição");
  }

  async resolveSubstitution(scheduleId: string, assignmentId: string, data: ResolveSubstitutionInput, user: RequestUser) {
    await requireUserPermission(user, "schedule:edit", user.tenantId);
    await this.ensureCanManageSchedule(scheduleId, user);
    const updated = await this.scheduleRepository.resolveSubstitution(scheduleId, assignmentId, user.id, data.note);
    if (!updated) {
      throw new NotFoundError("Solicitação de substituto não encontrada ou já resolvida");
    }
    return updated;
  }

  async removeAssignment(scheduleId: string, assignmentId: string, user: RequestUser) {
    await requireUserPermission(user, "schedule:assign_members", user.tenantId);
    const assignment = await this.scheduleRepository.findAssignment(scheduleId, assignmentId);
    if (!assignment) {
      throw new NotFoundError("Atribuição não encontrada");
    }

    await this.ensureCanManageSchedule(scheduleId, user);
    const result = await this.scheduleRepository.deleteAssignment(scheduleId, assignmentId, user.id);
    if (result.count === 0) {
      throw new NotFoundError("Atribuição não encontrada");
    }
  }

  async listMine(userId: string) {
    return this.scheduleRepository.findSchedulesForUser(userId);
  }

  async getReportData(scheduleId: string) {
    const schedule = await this.scheduleRepository.findScheduleReportById(scheduleId);
    if (!schedule) {
      throw new NotFoundError("Escala não encontrada");
    }
    return schedule;
  }

  private async ensureSongsBelongToTenant(songIds: string[]) {
    const uniqueSongIds = Array.from(new Set(songIds));
    const count = await this.scheduleRepository.countTenantSongs(uniqueSongIds);
    if (count !== uniqueSongIds.length) {
      throw new NotFoundError("Uma ou mais músicas não foram encontradas neste tenant");
    }
  }

  private async ensureAssignmentsAreAllowed(
    ministryId: string,
    assignments: CreateAssignmentInput[],
    user: RequestUser,
    existingRoles = new Map<string, string>(),
  ) {
    const assignmentsToValidate = assignments.filter((assignment) => existingRoles.get(assignment.userId) !== assignment.role);
    await this.ensureAssignmentsHaveProfileRoles(assignmentsToValidate);
    for (const assignment of assignments) {
      const targetUser = await this.scheduleRepository.findTenantUserById(assignment.userId);
      if (!targetUser) {
        throw new NotFoundError("Usuário não encontrado neste tenant");
      }
      if (!this.isAdmin(user.role) && !await hasPermission(user, "schedule:assign_members", user.tenantId) && user.role === Role.MINISTRY_LEADER) {
        await this.ensureUserBelongsToMinistry(ministryId, assignment.userId);
      }
    }
  }

  private async ensureAssignmentsHaveProfileRoles(assignments: CreateAssignmentInput[]) {
    if (!assignments.length) return;
    const users = await this.scheduleRepository.findUsersWithAssignmentRoles(assignments.map((assignment) => assignment.userId));
    const usersById = new Map(users.map((target) => [target.id, target]));

    for (const assignment of assignments) {
      const target = usersById.get(assignment.userId);
      if (!target) {
        throw new NotFoundError("Usuário não encontrado neste tenant");
      }
      const allowedRoles = new Set(target.instruments.map((entry) => entry.instrument.name));
      if (!allowedRoles.has(assignment.role)) {
        throw new ValidationError(`A função "${assignment.role}" não está vinculada ao perfil de ${target.name}`);
      }
    }
  }

  private async ensureUserBelongsToMinistry(ministryId: string, userId: string) {
    const membership = await this.scheduleRepository.findMinistryMember(ministryId, userId);
    if (!membership) {
      throw new ForbiddenError("Líder só pode escalar membros do próprio ministério");
    }
  }
}
