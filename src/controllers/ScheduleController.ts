import { Request, Response } from "express";
import { ZodError } from "zod";
import { BaseController } from "./BaseController";
import { ScheduleRepository } from "../repositories/ScheduleRepository";
import { ScheduleService } from "../services/scheduleService";
import { createScheduleSchema } from "../validators/schedule.schema";

export class ScheduleController extends BaseController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createScheduleSchema.parse(req.body);
      const repo = new ScheduleRepository(req.user!.tenantId);
      const service = new ScheduleService(repo);
      const schedule = await service.create(input);

      this.handleSuccess(res, schedule, 201);
    } catch (error) {
      if (error instanceof ZodError) {
        this.handleBadRequest(res, error.issues[0].message);
      } else if (error instanceof Error && error.message.includes("nao encontrado")) {
        this.handleNotFound(res, error.message);
      } else {
        this.handleError(error, res, "ScheduleController.create");
      }
    }
  }
}
