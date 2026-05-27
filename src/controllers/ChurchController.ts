import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { ChurchRepository } from "../repositories/ChurchRepository";
import { ChurchService } from "../services/churchService";
import { updateChurchSchema } from "../validators/church.schema";

function createService(req: Request): ChurchService {
  return new ChurchService(new ChurchRepository(req.user!.tenantId));
}

export class ChurchController extends BaseController {
  async getMe(req: Request, res: Response): Promise<void> {
    const summary = await createService(req).getSummary();
    this.handleSuccess(res, summary);
  }

  async updateMe(req: Request, res: Response): Promise<void> {
    const input = updateChurchSchema.parse(req.body);
    const summary = await createService(req).update(input);
    this.handleSuccess(res, summary);
  }

  async getOverview(req: Request, res: Response): Promise<void> {
    const overview = await createService(req).getOverview();
    this.handleSuccess(res, overview);
  }
}
