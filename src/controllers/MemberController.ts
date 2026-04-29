import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { MemberService } from "../services/memberService";
import { MemberRepository } from "../repositories/MemberRepository";
import { createMemberSchema } from "../validators/member.schema";
import { z } from "zod";

const addToMinistrySchema = z.object({
  ministryId: z.string().uuid("ID do ministério inválido"),
  isLeader: z.boolean().optional().default(false),
});

export class MemberController extends BaseController {
  private buildService(req: Request) {
    const repo = new MemberRepository(req.user!.tenantId);
    return new MemberService(repo);
  }

  async list(req: Request, res: Response): Promise<void> {
    const members = await this.buildService(req).listAll();
    this.handleSuccess(res, members);
  }

  async getOne(req: Request, res: Response): Promise<void> {
    const member = await this.buildService(req).getById(String(req.params.id));
    this.handleSuccess(res, member);
  }

  async create(req: Request, res: Response): Promise<void> {
    const input = createMemberSchema.parse(req.body);
    const member = await this.buildService(req).create(input);
    this.handleSuccess(res, member, 201);
  }

  async addToMinistry(req: Request, res: Response): Promise<void> {
    const { ministryId, isLeader } = addToMinistrySchema.parse(req.body);
    const assignment = await this.buildService(req).addToMinistry(
      String(req.params.id),
      ministryId,
      isLeader,
    );
    this.handleSuccess(res, assignment, 201);
  }

  async removeFromMinistry(req: Request, res: Response): Promise<void> {
    const { ministryId } = z.object({ ministryId: z.string().uuid() }).parse(req.body);
    await this.buildService(req).removeFromMinistry(String(req.params.id), ministryId);
    this.handleSuccess(res, { message: "Membro removido do ministério" });
  }
}
