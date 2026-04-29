import { Request, Response } from "express";
import { ForbiddenError } from "../errors/AppError";
import { BaseController } from "./BaseController";
import { ScheduleRepository } from "../repositories/ScheduleRepository";
import { ScheduleService } from "../services/scheduleService";
import { createScheduleSchema } from "../validators/schedule.validator";
import { Role } from "@prisma/client";

export class ScheduleController extends BaseController {
  /**
   * Lists schedules for the authenticated tenant.
   *
   * @param req Express request with req.user populated by auth middleware.
   * @param res Express response.
   * @returns A promise that resolves after the response is sent.
   */
  async list(req: Request, res: Response): Promise<void> {
    const repo = new ScheduleRepository(req.user!.tenantId);
    const service = new ScheduleService(repo);
    const schedules = await service.listAll();

    this.handleSuccess(res, schedules);
  }

  /**
   * Creates a schedule when the user has tenant or ministry leadership role.
   *
   * @param req Express request containing validated schedule body.
   * @param res Express response.
   * @returns A promise that resolves after the response is sent.
   */
  async create(req: Request, res: Response): Promise<void> {
    if (req.user!.role !== Role.TENANT_ADMIN && req.user!.role !== Role.MINISTRY_LEADER) {
      throw new ForbiddenError("Apenas administradores ou lideres de ministerio podem criar escalas");
    }

    const input = createScheduleSchema.parse(req.body);
    const repo = new ScheduleRepository(req.user!.tenantId);
    const service = new ScheduleService(repo);
    const schedule = await service.create(input);

    this.handleSuccess(res, schedule, 201);
  }
}
