import { Request, Response } from "express";
import { z } from "zod";
import { BaseController } from "./BaseController";
import { MinistryService } from "../services/ministryService";
import { MinistryRepository } from "../repositories/MinistryRepository";
import { createMinistrySchema, updateMinistrySchema } from "../validators/ministry.schema";
import {
  assignMemberToMinistrySchema,
  listMinistryMembersSchema,
  updateMemberAssignmentSchema,
} from "../validators/member.schema";

const addMemberSchema = z.object({
  userId: z.string().uuid("ID do usuário inválido"),
  isLeader: z.boolean().optional().default(false),
});

export class MinistryController extends BaseController {
  async list(req: Request, res: Response): Promise<void> {
    const repo = new MinistryRepository(req.user!.tenantId);
    const service = new MinistryService(repo);
    const ministries = await service.listAll({ id: req.user!.id, role: req.user!.role });
    this.handleSuccess(res, ministries);
  }

  async getOne(req: Request, res: Response): Promise<void> {
    const repo = new MinistryRepository(req.user!.tenantId);
    const service = new MinistryService(repo);
    const ministry = await service.getById(String(req.params.id), { id: req.user!.id, role: req.user!.role });
    this.handleSuccess(res, ministry);
  }

  async create(req: Request, res: Response): Promise<void> {
    const input = createMinistrySchema.parse(req.body);
    const repo = new MinistryRepository(req.user!.tenantId);
    const service = new MinistryService(repo);
    const ministry = await service.create(input, { role: req.user!.role });
    this.handleSuccess(res, ministry, 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const input = updateMinistrySchema.parse(req.body);
    const repo = new MinistryRepository(req.user!.tenantId);
    const service = new MinistryService(repo);
    const ministry = await service.update(String(req.params.id), input, { role: req.user!.role });
    this.handleSuccess(res, ministry);
  }

  async remove(req: Request, res: Response): Promise<void> {
    const repo = new MinistryRepository(req.user!.tenantId);
    const service = new MinistryService(repo);
    await service.delete(String(req.params.id), { role: req.user!.role });
    this.handleSuccess(res, { message: "Ministério removido com sucesso" });
  }

  async addMember(req: Request, res: Response): Promise<void> {
    const { userId, isLeader } = addMemberSchema.parse(req.body);
    const repo = new MinistryRepository(req.user!.tenantId);
    const service = new MinistryService(repo);
    const assignment = await service.addMember(String(req.params.id), userId, isLeader, {
      id: req.user!.id,
      role: req.user!.role,
    });
    this.handleSuccess(res, assignment, 201);
  }

  async removeMember(req: Request, res: Response): Promise<void> {
    const userId = z.string().uuid().parse(req.params.userId);
    const repo = new MinistryRepository(req.user!.tenantId);
    const service = new MinistryService(repo);
    await service.removeMember(String(req.params.id), userId, {
      id: req.user!.id,
      role: req.user!.role,
    });
    this.handleSuccess(res, { message: "Membro removido do ministério" });
  }

  async assignMember(req: Request, res: Response): Promise<void> {
    const input = assignMemberToMinistrySchema.parse(req.body);
    const repo = new MinistryRepository(req.user!.tenantId);
    const service = new MinistryService(repo);
    const assignment = await service.assignMember(input, {
      id: req.user!.id,
      role: req.user!.role,
    });

    this.handleSuccess(res, assignment, 201);
  }

  async updateAssignment(req: Request, res: Response): Promise<void> {
    const input = updateMemberAssignmentSchema.parse(req.body);
    const repo = new MinistryRepository(req.user!.tenantId);
    const service = new MinistryService(repo);
    const assignment = await service.updateAssignment(input, {
      id: req.user!.id,
      role: req.user!.role,
    });

    this.handleSuccess(res, assignment);
  }

  async removeAssignment(req: Request, res: Response): Promise<void> {
    const assignmentId = z.string().uuid().parse(req.params.assignmentId);
    const repo = new MinistryRepository(req.user!.tenantId);
    const service = new MinistryService(repo);
    await service.removeAssignment(assignmentId, {
      id: req.user!.id,
      role: req.user!.role,
    });

    this.handleSuccess(res, { message: "Atribuição removida do ministério" });
  }

  async listMembers(req: Request, res: Response): Promise<void> {
    const ministryId = z.string().uuid().parse(req.params.id);
    const filters = listMinistryMembersSchema.parse(req.query);
    const repo = new MinistryRepository(req.user!.tenantId);
    const service = new MinistryService(repo);
    const members = await service.listMinistryMembers(ministryId, filters);

    this.handleSuccess(res, members);
  }

  async getMyAssignments(req: Request, res: Response): Promise<void> {
    const repo = new MinistryRepository(req.user!.tenantId);
    const service = new MinistryService(repo);
    const assignments = await service.getMyAssignments({
      id: req.user!.id,
      tenantId: req.user!.tenantId,
    });

    this.handleSuccess(res, assignments);
  }
}
