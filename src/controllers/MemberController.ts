import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { MemberService } from "../services/memberService";
import { MemberRepository } from "../repositories/MemberRepository";
import { addMemberMinistrySchema, createMemberSchema, updateMemberInstrumentsSchema, updateMemberPermissionsSchema, updateMemberSchema, updateMyProfileSchema } from "../validators/member.schema";

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

  async getMe(req: Request, res: Response): Promise<void> {
    const member = await this.buildService(req).getById(req.user!.id);
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

  async updateInstruments(req: Request, res: Response): Promise<void> {
    const input = updateMemberInstrumentsSchema.parse(req.body);
    const member = await this.buildService(req).updateInstruments(String(req.params.id), input, req.user!);
    this.handleSuccess(res, member);
  }

  async update(req: Request, res: Response): Promise<void> {
    const input = updateMemberSchema.parse(req.body);
    this.handleSuccess(res, await this.buildService(req).update(String(req.params.id), input, req.user!));
  }

  async remove(req: Request, res: Response): Promise<void> {
    this.handleSuccess(res, await this.buildService(req).remove(String(req.params.id), req.user!));
  }

  async updatePermissions(req: Request, res: Response): Promise<void> {
    const input = updateMemberPermissionsSchema.parse(req.body);
    const member = await this.buildService(req).updatePermissions(String(req.params.id), input, req.user!);
    this.handleSuccess(res, member);
  }

  async updateMyInstruments(req: Request, res: Response): Promise<void> {
    const input = updateMemberInstrumentsSchema.parse(req.body);
    const member = await this.buildService(req).updateInstruments(req.user!.id, input, req.user!);
    this.handleSuccess(res, member);
  }

  async updateMyProfile(req: Request, res: Response): Promise<void> {
    const input = updateMyProfileSchema.parse(req.body);
    const member = await this.buildService(req).updateMyProfile(req.user!.id, input);
    this.handleSuccess(res, member);
  }
}
