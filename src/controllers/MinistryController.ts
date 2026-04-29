import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { MinistryService } from "../services/ministryService";
import { MinistryRepository } from "../repositories/MinistryRepository";
import { createMinistrySchema, updateMinistrySchema } from "../validators/ministry.schema";


export class MinistryController extends BaseController {
  async list(req: Request, res: Response): Promise<void> {
    const repo = new MinistryRepository(req.user!.tenantId);
    const service = new MinistryService(repo);
    const ministries = await service.listAll();
    this.handleSuccess(res, ministries);
  }

  async getOne(req: Request, res: Response): Promise<void> {
    const repo = new MinistryRepository(req.user!.tenantId);
    const service = new MinistryService(repo);
    const ministry = await service.getById(String(req.params.id));
    this.handleSuccess(res, ministry);
  }

  async create(req: Request, res: Response): Promise<void> {
    const input = createMinistrySchema.parse(req.body);
    const repo = new MinistryRepository(req.user!.tenantId);
    const service = new MinistryService(repo);
    const ministry = await service.create(input);
    this.handleSuccess(res, ministry, 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const input = updateMinistrySchema.parse(req.body);
    const repo = new MinistryRepository(req.user!.tenantId);
    const service = new MinistryService(repo);
    const ministry = await service.update(String(req.params.id), input);
    this.handleSuccess(res, ministry);
  }

  async remove(req: Request, res: Response): Promise<void> {
    const repo = new MinistryRepository(req.user!.tenantId);
    const service = new MinistryService(repo);
    await service.delete(String(req.params.id));
    this.handleSuccess(res, { message: "Ministério removido com sucesso" });
  }
}
