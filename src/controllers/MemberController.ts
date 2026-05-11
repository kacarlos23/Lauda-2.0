import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { MemberService } from "../services/memberService";
import { MemberRepository } from "../repositories/MemberRepository";
import { addMemberMinistrySchema, createMemberSchema } from "../validators/member.schema";

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

  async addMinistry(req: Request, res: Response): Promise<void> {
    const input = addMemberMinistrySchema.parse(req.body);
    const assignment = await this.buildService(req).addMinistry(
      String(req.params.id),
      input.ministryId,
      input.isLeader
    );
    this.handleSuccess(res, assignment, 201);
  }
}
