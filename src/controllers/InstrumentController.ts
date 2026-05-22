import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { InstrumentRepository } from "../repositories/InstrumentRepository";
import { InstrumentService } from "../services/instrumentService";
import { createInstrumentSchema, instrumentIdSchema, updateInstrumentSchema } from "../validators/instrument.schema";

export class InstrumentController extends BaseController {
  private buildService(req: Request) {
    const repo = new InstrumentRepository(req.user!.tenantId);
    return new InstrumentService(repo);
  }

  async list(req: Request, res: Response): Promise<void> {
    const instruments = await this.buildService(req).listAll();
    this.handleSuccess(res, instruments);
  }

  async create(req: Request, res: Response): Promise<void> {
    const input = createInstrumentSchema.parse(req.body);
    const instrument = await this.buildService(req).create(input);
    this.handleSuccess(res, instrument, 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = instrumentIdSchema.parse(req.params);
    const input = updateInstrumentSchema.parse(req.body);
    const instrument = await this.buildService(req).update(id, input);
    this.handleSuccess(res, instrument);
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = instrumentIdSchema.parse(req.params);
    const instrument = await this.buildService(req).delete(id);
    this.handleSuccess(res, instrument);
  }
}
