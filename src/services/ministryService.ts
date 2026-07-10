import { Role } from "@prisma/client";
import { MinistryRepository } from "../repositories/MinistryRepository";
import { NotFoundError, ForbiddenError, ValidationError } from "../errors/AppError";
import { CreateMinistryInput, UpdateMinistryInput } from "../validators/ministry.schema";
import { PermissionKey } from "../constants/permissions";
import { hasPermission } from "./permissionService";
import {
  AssignMemberToMinistryInput,
  ListMinistryMembersInput,
  UpdateMemberAssignmentInput,
} from "../validators/member.schema";

type RequestUser = { id: string; role: Role; tenantId?: string };

export class MinistryService {
  constructor(private readonly ministryRepository: MinistryRepository) {}

  private async checkAdmin(user: RequestUser, permissionKey: PermissionKey) {
    if (user.role === Role.GLOBAL_ADMIN || user.role === Role.TENANT_ADMIN) return;
    if (await hasPermission(user, permissionKey, user.tenantId)) return;
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

  async create(data: CreateMinistryInput, user: RequestUser) {
    await this.checkAdmin(user, "ministry:create");
    return this.ministryRepository.create(data);
  }

  async update(id: string, data: UpdateMinistryInput, user: RequestUser) {
    await this.checkAdmin(user, "ministry:edit");
    await this.getById(id);
    const result = await this.ministryRepository.update(id, data);
    if (result.count === 0) {
      throw new NotFoundError("Ministério não encontrado");
    }
    return this.ministryRepository.findById(id);
  }

  async delete(id: string, user: RequestUser) {
    await this.checkAdmin(user, "ministry:delete");
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
    const hasExplicitAccess = await hasPermission(user, "ministry:assign_members", user.tenantId);
    const ministry = await this.getById(ministryId);
    if (hasExplicitAccess && user.role !== Role.MINISTRY_LEADER) {
      return ministry;
    }
    this.checkLeadership(ministry, user.id, user.role);
    return ministry;
  }

  async addMember(ministryId: string, targetUserId: string, isLeader: boolean, reqUser: RequestUser) {
    await this.ensureCanManageMinistry(ministryId, reqUser);

    const targetUser = await this.ministryRepository.findUserById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError("Usuário não encontrado neste tenant");
    }

    const assignment = await this.ministryRepository.addMember(ministryId, targetUserId, isLeader);
    if (!assignment) {
      throw new NotFoundError("Ministério ou usuário não encontrado");
    }
    return assignment;
  }

  async removeMember(ministryId: string, targetUserId: string, reqUser: RequestUser) {
    await this.ensureCanManageMinistry(ministryId, reqUser);

    return this.ministryRepository.removeMember(ministryId, targetUserId);
  }

  async toggleMember(ministryId: string, targetUserId: string, reqUser: RequestUser) {
    await this.checkAdmin(reqUser, "ministry:assign_members");

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

    const membership = await this.ministryRepository.createMembership(ministryId, targetUserId);
    if (!membership) {
      throw new NotFoundError("Ministério ou membro não encontrado");
    }
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

    const assignment = await this.ministryRepository.assignMemberToMinistry(input);
    if (!assignment) {
      throw new NotFoundError("Ministério ou usuário não encontrado");
    }
    return assignment;
  }

  async updateAssignment(input: UpdateMemberAssignmentInput, reqUser: RequestUser) {
    const assignment = await this.ministryRepository.findAssignmentById(input.assignmentId);
    if (!assignment) {
      throw new NotFoundError("Atribuição não encontrada");
    }

    await this.ensureCanManageMinistry(assignment.ministryId, reqUser);
    const { assignmentId, ...data } = input;

    const updated = await this.ministryRepository.updateMemberAssignment(assignmentId, data);
    if (!updated) {
      throw new NotFoundError("Atribuição não encontrada");
    }
    return updated;
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

