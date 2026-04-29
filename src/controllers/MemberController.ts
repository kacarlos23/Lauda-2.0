import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { MemberService } from "../services/memberService";
import { MemberRepository } from "../repositories/MemberRepository";
import { createMemberSchema } from "../validators/member.schema";
import { z } from "zod";

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
}
