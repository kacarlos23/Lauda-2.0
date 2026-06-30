import { Role } from "@prisma/client";
import { ScheduleRepository } from "../repositories/ScheduleRepository";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors/AppError";
import { CreateAssignmentInput, CreateScheduleInput, ListSchedulesInput, UpdateAssignmentStatusInput, UpdateScheduleInput } from "../validators/schedule.schema";

type RequestUser = { id: string; role: Role };

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
    return role === Role.GLOBAL_ADMIN || role === Role.TENANT_ADMIN;
  }

  private async ensureCanManageSchedule(scheduleId: string, user: RequestUser) {
    const schedule = await this.scheduleRepository.findScheduleById(scheduleId);
    if (!schedule) {
      throw new NotFoundError("Escala não encontrada");
    }

    if (this.isAdmin(user.role)) {
      return schedule;
    }

    if (user.role !== Role.MINISTRY_LEADER) {
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

    if (this.isAdmin(user.role)) {
      await this.ensureAssignmentsAreAllowed(data.ministryId, data.assignments, user);
      return this.scheduleRepository.create(data);
    }

    if (user.role !== Role.MINISTRY_LEADER) {
      throw new ForbiddenError("Perfil sem permissão para criar escalas");
    }

    const leadership = await this.scheduleRepository.findMinistryLeadership(data.ministryId, user.id);
    if (!leadership) {
      throw new ForbiddenError("Líder só pode criar escalas dos ministérios que lídera");
    }

    await this.ensureAssignmentsAreAllowed(data.ministryId, data.assignments, user);
    return this.scheduleRepository.create(data);
  }

  async updateForUser(scheduleId: string, data: UpdateScheduleInput, user: RequestUser) {
    await this.ensureCanManageSchedule(scheduleId, user);

    const ministry = await this.scheduleRepository.findMinistryById(data.ministryId);
    if (!ministry) {
      throw new NotFoundError("Ministério não encontrado");
    }

    await this.ensureSongsBelongToTenant(data.songIds);

    if (!this.isAdmin(user.role)) {
      const leadership = await this.scheduleRepository.findMinistryLeadership(data.ministryId, user.id);
      if (!leadership) {
        throw new ForbiddenError("Líder só pode mover escalas para ministérios que lidera");
      }
    }

    await this.ensureAssignmentsAreAllowed(data.ministryId, data.assignments, user);
    const updated = await this.scheduleRepository.update(scheduleId, data);
    if (!updated) {
      throw new NotFoundError("Escala não encontrada");
    }
    return updated;
  }

  async addAssignment(scheduleId: string, data: CreateAssignmentInput, user: RequestUser) {
    const schedule = await this.ensureCanManageSchedule(scheduleId, user);

    const targetUser = await this.scheduleRepository.findTenantUserById(data.userId);
    if (!targetUser) {
      throw new NotFoundError("Usuário não encontrado neste tenant");
    }

    if (!this.isAdmin(user.role)) {
      await this.ensureUserBelongsToMinistry(schedule.ministryId, data.userId);
    }

    try {
      const assignment = await this.scheduleRepository.createAssignment(scheduleId, data);
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
    const assignment = await this.scheduleRepository.findAssignment(scheduleId, assignmentId);
    if (!assignment) {
      throw new NotFoundError("Atribuição não encontrada");
    }

    if (assignment.userId === user.id) {
      const updated = await this.scheduleRepository.updateAssignmentStatus(scheduleId, assignmentId, data);
      if (!updated) {
        throw new NotFoundError("Atribuição não encontrada");
      }
      return updated;
    }

    if (this.isAdmin(user.role)) {
      const updated = await this.scheduleRepository.updateAssignmentStatus(scheduleId, assignmentId, data);
      if (!updated) {
        throw new NotFoundError("Atribuição não encontrada");
      }
      return updated;
    }

    if (user.role === Role.MINISTRY_LEADER) {
      const leadership = await this.scheduleRepository.findMinistryLeadership(assignment.schedule.ministryId, user.id);
      if (leadership) {
        const updated = await this.scheduleRepository.updateAssignmentStatus(scheduleId, assignmentId, data);
        if (!updated) {
          throw new NotFoundError("Atribuição não encontrada");
        }
        return updated;
      }
    }

    throw new ForbiddenError("Você só pode alterar a sua própria atribuição");
  }

  async removeAssignment(scheduleId: string, assignmentId: string, user: RequestUser) {
    const assignment = await this.scheduleRepository.findAssignment(scheduleId, assignmentId);
    if (!assignment) {
      throw new NotFoundError("Atribuição não encontrada");
    }

    await this.ensureCanManageSchedule(scheduleId, user);
    const result = await this.scheduleRepository.deleteAssignment(assignmentId);
    if (result.count === 0) {
      throw new NotFoundError("Atribuição não encontrada");
    }
  }

  async listMine(userId: string) {
    return this.scheduleRepository.findSchedulesForUser(userId);
  }

  private async ensureSongsBelongToTenant(songIds: string[]) {
    const uniqueSongIds = Array.from(new Set(songIds));
    const count = await this.scheduleRepository.countTenantSongs(uniqueSongIds);
    if (count !== uniqueSongIds.length) {
      throw new NotFoundError("Uma ou mais músicas não foram encontradas neste tenant");
    }
  }

  private async ensureAssignmentsAreAllowed(ministryId: string, assignments: CreateAssignmentInput[], user: RequestUser) {
    for (const assignment of assignments) {
      const targetUser = await this.scheduleRepository.findTenantUserById(assignment.userId);
      if (!targetUser) {
        throw new NotFoundError("Usuário não encontrado neste tenant");
      }
      if (!this.isAdmin(user.role)) {
        await this.ensureUserBelongsToMinistry(ministryId, assignment.userId);
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
