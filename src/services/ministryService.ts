import { Role } from "@prisma/client";
import { MinistryRepository } from "../repositories/MinistryRepository";
import { NotFoundError, ForbiddenError, ValidationError } from "../errors/AppError";
import { CreateMinistryInput, UpdateMinistryInput } from "../validators/ministry.schema";
import {
  AssignMemberToMinistryInput,
  ListMinistryMembersInput,
  UpdateMemberAssignmentInput,
} from "../validators/member.schema";

type RequestUser = { id: string; role: string };

export class MinistryService {
  constructor(private readonly ministryRepository: MinistryRepository) {}

  private checkAdmin(role: string) {
    if (role === Role.GLOBAL_ADMIN || role === Role.TENANT_ADMIN) return;
    throw new ForbiddenError("Apenas administradores podem gerenciar ministérios");
  }

  async listAll(user?: { id: string; role: string }) {
    return this.ministryRepository.findAll(user);
  }

  async getById(id: string, user?: { id: string; role: string }) {
    const ministry = await this.ministryRepository.findById(id, user);
    if (!ministry) {
      throw new NotFoundError("Ministério não encontrado");
    }
    return ministry;
  }

  async create(data: CreateMinistryInput, user: { role: string }) {
    this.checkAdmin(user.role);
    return this.ministryRepository.create(data);
  }

  async update(id: string, data: UpdateMinistryInput, user: { role: string }) {
    this.checkAdmin(user.role);
    await this.getById(id);
    const result = await this.ministryRepository.update(id, data);
    if (result.count === 0) {
      throw new NotFoundError("Ministério não encontrado");
    }
    return this.ministryRepository.findById(id);
  }

  async delete(id: string, user: { role: string }) {
    this.checkAdmin(user.role);
    await this.getById(id);
    const result = await this.ministryRepository.delete(id);
    if (result.count === 0) {
      throw new NotFoundError("Ministério não encontrado");
    }
  }

  private checkLeadership(ministry: any, userId: string, role: string) {
    if (role === Role.GLOBAL_ADMIN || role === Role.TENANT_ADMIN) return;

    const isLeader = ministry.members?.some((m: any) => m.userId === userId && m.isLeader);
    if (!isLeader) {
      throw new ForbiddenError("Apenas o líder do ministério ou administradores podem gerenciar membros");
    }
  }

  private canAssign(role: string) {
    return role === Role.GLOBAL_ADMIN || role === Role.TENANT_ADMIN || role === Role.MINISTRY_LEADER;
  }

  private async ensureCanManageMinistry(ministryId: string, user: RequestUser) {
    if (!this.canAssign(user.role)) {
      throw new ForbiddenError("Você não tem permissão para gerenciar membros de ministérios");
    }

    const ministry = await this.getById(ministryId);
    this.checkLeadership(ministry, user.id, user.role);
    return ministry;
  }

  async addMember(ministryId: string, targetUserId: string, isLeader: boolean, reqUser: RequestUser) {
    const ministry = await this.getById(ministryId);
    this.checkLeadership(ministry, reqUser.id, reqUser.role);

    const targetUser = await this.ministryRepository.findUserById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError("Usuário não encontrado neste tenant");
    }

    return this.ministryRepository.addMember(ministryId, targetUserId, isLeader);
  }

  async removeMember(ministryId: string, targetUserId: string, reqUser: RequestUser) {
    const ministry = await this.getById(ministryId);
    this.checkLeadership(ministry, reqUser.id, reqUser.role);

    return this.ministryRepository.removeMember(ministryId, targetUserId);
  }

  async toggleMember(ministryId: string, targetUserId: string, reqUser: RequestUser) {
    this.checkAdmin(reqUser.role);

    await this.getById(ministryId);

    const targetUser = await this.ministryRepository.findUserById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError("Membro não encontrado neste tenant");
    }

    const existing = await this.ministryRepository.findAssignmentByUserAndMinistry(targetUserId, ministryId);
    if (existing) {
      await this.ministryRepository.removeMember(ministryId, targetUserId);
      return {
        status: "unlinked" as const,
        member_id: targetUserId,
        ministry_id: ministryId,
      };
    }

    await this.ministryRepository.createMembership(ministryId, targetUserId);
    return {
      status: "linked" as const,
      member_id: targetUserId,
      ministry_id: ministryId,
    };
  }

  async assignMember(input: AssignMemberToMinistryInput, reqUser: RequestUser) {
    await this.ensureCanManageMinistry(input.ministryId, reqUser);

    const targetUser = await this.ministryRepository.findUserById(input.userId);
    if (!targetUser) {
      throw new NotFoundError("Usuário não encontrado neste tenant");
    }

    const existing = await this.ministryRepository.findAssignmentByUserAndMinistry(input.userId, input.ministryId);
    if (existing) {
      throw new ValidationError("Usuário já está atribuído a este ministério");
    }

    return this.ministryRepository.assignMemberToMinistry(input);
  }

  async updateAssignment(input: UpdateMemberAssignmentInput, reqUser: RequestUser) {
    const assignment = await this.ministryRepository.findAssignmentById(input.assignmentId);
    if (!assignment) {
      throw new NotFoundError("Atribuição não encontrada");
    }

    await this.ensureCanManageMinistry(assignment.ministryId, reqUser);
    const { assignmentId, ...data } = input;

    return this.ministryRepository.updateMemberAssignment(assignmentId, data);
  }

  async listMinistryMembers(ministryId: string, filters: ListMinistryMembersInput) {
    await this.getById(ministryId);
    return this.ministryRepository.getMinistryMembers(ministryId, filters);
  }

  async getMyAssignments(user: { id: string; tenantId: string }) {
    return this.ministryRepository.getMemberAssignments(user.id, user.tenantId);
  }

  async removeAssignment(assignmentId: string, reqUser: RequestUser) {
    const assignment = await this.ministryRepository.findAssignmentById(assignmentId);
    if (!assignment) {
      throw new NotFoundError("Atribuição não encontrada");
    }

    await this.ensureCanManageMinistry(assignment.ministryId, reqUser);
    const result = await this.ministryRepository.removeMemberFromMinistry(assignmentId);
    if (result.count === 0) {
      throw new NotFoundError("Atribuição não encontrada");
    }
  }
}
