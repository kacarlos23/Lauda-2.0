import { Role } from "@prisma/client";
import { ScheduleRepository } from "../repositories/ScheduleRepository";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors/AppError";
import { CreateAssignmentInput, CreateScheduleInput, UpdateAssignmentStatusInput } from "../validators/schedule.schema";

type RequestUser = { id: string; role: Role };

export class ScheduleService {
  constructor(private readonly scheduleRepository: ScheduleRepository) {}

  /**
   * Lists schedules visible to the authenticated tenant.
   *
   * @returns Tenant-scoped schedules.
   */
  async listAll() {
    return this.scheduleRepository.findAll();
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
      throw new ForbiddenError("Líder só pode gerenciar escalas dos ministérios que lidera");
    }

    return schedule;
  }

  async createForUser(data: CreateScheduleInput, user: RequestUser) {
    const ministry = await this.scheduleRepository.findMinistryById(data.ministryId);
    if (!ministry) {
      throw new NotFoundError("Ministério não encontrado");
    }

    if (this.isAdmin(user.role)) {
      return this.scheduleRepository.create(data);
    }

    if (user.role !== Role.MINISTRY_LEADER) {
      throw new ForbiddenError("Perfil sem permissão para criar escalas");
    }

    const leadership = await this.scheduleRepository.findMinistryLeadership(data.ministryId, user.id);
    if (!leadership) {
      throw new ForbiddenError("Líder só pode criar escalas dos ministérios que lidera");
    }

    return this.scheduleRepository.create(data);
  }

  async addAssignment(scheduleId: string, data: CreateAssignmentInput, user: RequestUser) {
    await this.ensureCanManageSchedule(scheduleId, user);

    const targetUser = await this.scheduleRepository.findTenantUserById(data.userId);
    if (!targetUser) {
      throw new NotFoundError("Usuário não encontrado neste tenant");
    }

    try {
      return await this.scheduleRepository.createAssignment(scheduleId, data);
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
      return this.scheduleRepository.updateAssignmentStatus(assignmentId, data);
    }

    if (this.isAdmin(user.role)) {
      return this.scheduleRepository.updateAssignmentStatus(assignmentId, data);
    }

    if (user.role === Role.MINISTRY_LEADER) {
      const leadership = await this.scheduleRepository.findMinistryLeadership(assignment.schedule.ministryId, user.id);
      if (leadership) {
        return this.scheduleRepository.updateAssignmentStatus(assignmentId, data);
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
}
