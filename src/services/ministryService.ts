import { MinistryRepository } from "../repositories/MinistryRepository";
import { CreateMinistryInput, UpdateMinistryInput } from "../validators/ministry.schema";
import { NotFoundError, ForbiddenError } from "../errors/AppError";
import { Role } from "@prisma/client";

export class MinistryService {
  constructor(private readonly ministryRepository: MinistryRepository) {}

  async listAll() {
    return this.ministryRepository.findAll();
  }

  async getById(id: string) {
    const ministry = await this.ministryRepository.findById(id);
    if (!ministry) {
      throw new NotFoundError("Ministério não encontrado");
    }
    return ministry;
  }

  async create(data: CreateMinistryInput) {
    return this.ministryRepository.create(data);
  }

  async update(id: string, data: UpdateMinistryInput) {
    await this.getById(id); // validates ownership + existence
    const result = await this.ministryRepository.update(id, data);
    if (result.count === 0) {
      throw new NotFoundError("Ministério não encontrado");
    }
    return this.ministryRepository.findById(id);
  }

  async delete(id: string) {
    await this.getById(id); // validates ownership + existence
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

  async addMember(ministryId: string, targetUserId: string, isLeader: boolean, reqUser: { id: string, role: string }) {
    const ministry = await this.getById(ministryId);
    this.checkLeadership(ministry, reqUser.id, reqUser.role);
    
    return this.ministryRepository.addMember(ministryId, targetUserId, isLeader);
  }

  async removeMember(ministryId: string, targetUserId: string, reqUser: { id: string, role: string }) {
    const ministry = await this.getById(ministryId);
    this.checkLeadership(ministry, reqUser.id, reqUser.role);
    
    return this.ministryRepository.removeMember(ministryId, targetUserId);
  }
}
