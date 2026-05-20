import { Prisma, Role } from "@prisma/client";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors/AppError";
import { ScheduleRepository } from "../repositories/ScheduleRepository";
import {
  CreateAssignmentInput,
  CreateScheduleInput,
  UpdateAssignmentStatusInput,
} from "../validators/schedule.schema";

export type AuthenticatedUser = {
  userId: string;
  role: Role;
  tenantId: string;
};

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
  async create(data: CreateScheduleInput, user: AuthenticatedUser) {
    const ministry = await this.scheduleRepository.findMinistryById(data.ministryId);
    if (!ministry) {
      throw new NotFoundError("Ministério não encontrado");
    }

    await this.ensureCanManageMinistrySchedule(user, data.ministryId);

    return this.scheduleRepository.create(data);
  }

  async addAssignment(scheduleId: string, data: CreateAssignmentInput, user: AuthenticatedUser) {
    const schedule = await this.getScheduleOrThrow(scheduleId);
    await this.ensureCanManageMinistrySchedule(user, schedule.ministryId);

    const member = await this.scheduleRepository.findUserById(data.userId);
    if (!member) {
      throw new NotFoundError("Membro não encontrado");
    }

    try {
      return await this.scheduleRepository.createAssignment({
        scheduleId,
        userId: data.userId,
        role: data.role,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ValidationError("Membro já atribuído a esta escala");
      }
      throw error;
    }
  }

  async updateAssignmentStatus(
    scheduleId: string,
    assignmentId: string,
    data: UpdateAssignmentStatusInput,
    user: AuthenticatedUser
  ) {
    await this.getScheduleOrThrow(scheduleId);
    const assignment = await this.getAssignmentOrThrow(scheduleId, assignmentId);

    if (assignment.userId !== user.userId) {
      throw new ForbiddenError("Membro só pode alterar a própria escala");
    }

    await this.scheduleRepository.updateAssignmentStatus(assignmentId, data.status);
    return { ...assignment, status: data.status };
  }

  async removeAssignment(scheduleId: string, assignmentId: string, user: AuthenticatedUser) {
    const schedule = await this.getScheduleOrThrow(scheduleId);
    await this.ensureCanManageMinistrySchedule(user, schedule.ministryId);
    await this.getAssignmentOrThrow(scheduleId, assignmentId);

    await this.scheduleRepository.deleteAssignment(assignmentId);
  }

  async listMine(user: AuthenticatedUser) {
    const assignments = await this.scheduleRepository.findSchedulesForUser(user.userId);

    return assignments.map((assignment) => ({
      assignmentId: assignment.id,
      status: assignment.status,
      role: assignment.role,
      schedule: {
        id: assignment.schedule.id,
        title: assignment.schedule.title,
        date: assignment.schedule.date,
        ministryId: assignment.schedule.ministryId,
        ministry: assignment.schedule.ministry,
      },
    }));
  }

  private async getScheduleOrThrow(scheduleId: string) {
    const schedule = await this.scheduleRepository.findScheduleById(scheduleId);
    if (!schedule) {
      throw new NotFoundError("Escala não encontrada");
    }
    return schedule;
  }

  private async getAssignmentOrThrow(scheduleId: string, assignmentId: string) {
    const assignment = await this.scheduleRepository.findAssignmentById(scheduleId, assignmentId);
    if (!assignment) {
      throw new NotFoundError("Assignment não encontrado");
    }
    return assignment;
  }

  private async ensureCanManageMinistrySchedule(user: AuthenticatedUser, ministryId: string) {
    if (user.role === Role.GLOBAL_ADMIN || user.role === Role.TENANT_ADMIN) {
      return;
    }

    if (user.role !== Role.MINISTRY_LEADER) {
      throw new ForbiddenError("Apenas administradores ou líderes do ministério podem gerenciar escalas");
    }

    const isLeader = await this.scheduleRepository.isUserLeaderOfMinistry(user.userId, ministryId);
    if (!isLeader) {
      throw new ForbiddenError("Apenas administradores ou líderes do ministério podem gerenciar escalas");
    }
  }
}
