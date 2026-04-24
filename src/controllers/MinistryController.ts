import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { MinistryService } from "../services/ministryService";
import { MinistryRepository } from "../repositories/MinistryRepository";
import { createMinistrySchema, updateMinistrySchema } from "../validators/ministry.schema";
import { ZodError } from "zod";

export class MinistryController extends BaseController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const repo = new MinistryRepository(req.user!.tenantId);
      const service = new MinistryService(repo);
      const ministries = await service.listAll();
      this.handleSuccess(res, ministries);
    } catch (error) {
      this.handleError(error, res, "MinistryController.list");
    }
  }

  async getOne(req: Request, res: Response): Promise<void> {
    try {
      const repo = new MinistryRepository(req.user!.tenantId);
      const service = new MinistryService(repo);
      const ministry = await service.getById(String(req.params.id));
      this.handleSuccess(res, ministry);
    } catch (error) {
      if (error instanceof Error && error.message.includes("não encontrado")) {
        this.handleNotFound(res, error.message);
      } else {
        this.handleError(error, res, "MinistryController.getOne");
      }
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createMinistrySchema.parse(req.body);
      const repo = new MinistryRepository(req.user!.tenantId);
      const service = new MinistryService(repo);
      const ministry = await service.create(input);
      this.handleSuccess(res, ministry, 201);
    } catch (error) {
      if (error instanceof ZodError) {
        this.handleBadRequest(res, error.issues[0].message);
      } else {
        this.handleError(error, res, "MinistryController.create");
      }
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const input = updateMinistrySchema.parse(req.body);
      const repo = new MinistryRepository(req.user!.tenantId);
      const service = new MinistryService(repo);
      const ministry = await service.update(String(req.params.id), input);
      this.handleSuccess(res, ministry);
    } catch (error) {
      if (error instanceof ZodError) {
        this.handleBadRequest(res, error.issues[0].message);
      } else if (error instanceof Error && error.message.includes("não encontrado")) {
        this.handleNotFound(res, error.message);
      } else {
        this.handleError(error, res, "MinistryController.update");
      }
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    try {
      const repo = new MinistryRepository(req.user!.tenantId);
      const service = new MinistryService(repo);
      await service.delete(String(req.params.id));
      this.handleSuccess(res, { message: "Ministério removido com sucesso" });
    } catch (error) {
      if (error instanceof Error && error.message.includes("não encontrado")) {
        this.handleNotFound(res, error.message);
      } else {
        this.handleError(error, res, "MinistryController.remove");
      }
    }
  }
}
