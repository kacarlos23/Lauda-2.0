import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { MemberService } from "../services/memberService";
import { MemberRepository } from "../repositories/MemberRepository";
import { createMemberSchema } from "../validators/member.schema";
import { z, ZodError } from "zod";

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
    try {
      const members = await this.buildService(req).listAll();
      this.handleSuccess(res, members);
    } catch (error) {
      this.handleError(error, res, "MemberController.list");
    }
  }

  async getOne(req: Request, res: Response): Promise<void> {
    try {
      const member = await this.buildService(req).getById(String(req.params.id));
      this.handleSuccess(res, member);
    } catch (error) {
      if (error instanceof Error && error.message.includes("não encontrado")) {
        this.handleNotFound(res, error.message);
      } else {
        this.handleError(error, res, "MemberController.getOne");
      }
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createMemberSchema.parse(req.body);
      const member = await this.buildService(req).create(input);
      this.handleSuccess(res, member, 201);
    } catch (error) {
      if (error instanceof ZodError) {
        this.handleBadRequest(res, error.issues[0].message);
      } else if (error instanceof Error && error.message.includes("e-mail")) {
        this.handleBadRequest(res, error.message);
      } else {
        this.handleError(error, res, "MemberController.create");
      }
    }
  }

  async addToMinistry(req: Request, res: Response): Promise<void> {
    try {
      const { ministryId, isLeader } = addToMinistrySchema.parse(req.body);
      const assignment = await this.buildService(req).addToMinistry(
        String(req.params.id),
        ministryId,
        isLeader,
      );
      this.handleSuccess(res, assignment, 201);
    } catch (error) {
      if (error instanceof ZodError) {
        this.handleBadRequest(res, error.issues[0].message);
      } else if (error instanceof Error && error.message.includes("não encontrado")) {
        this.handleNotFound(res, error.message);
      } else {
        this.handleError(error, res, "MemberController.addToMinistry");
      }
    }
  }

  async removeFromMinistry(req: Request, res: Response): Promise<void> {
    try {
      const { ministryId } = z.object({ ministryId: z.string().uuid() }).parse(req.body);
      await this.buildService(req).removeFromMinistry(String(req.params.id), ministryId);
      this.handleSuccess(res, { message: "Membro removido do ministério" });
    } catch (error) {
      if (error instanceof ZodError) {
        this.handleBadRequest(res, error.issues[0].message);
      } else {
        this.handleError(error, res, "MemberController.removeFromMinistry");
      }
    }
  }
}
