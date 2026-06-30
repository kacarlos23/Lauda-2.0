import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { ScheduleRepository } from "../repositories/ScheduleRepository";
import { ScheduleService } from "../services/scheduleService";
import {
  assignmentParamsSchema,
  createAssignmentSchema,
  createScheduleSchema,
  listSchedulesSchema,
  updateScheduleSchema,
  updateAssignmentStatusSchema,
  uuidParamSchema,
} from "../validators/schedule.validator";

export class ScheduleController extends BaseController {
  private buildService(req: Request) {
    const repo = new ScheduleRepository(req.user!.tenantId);
    return new ScheduleService(repo);
  }

  /**
   * Lists schedules for the authenticated tenant.
   *
   * @param req Express request with req.user populated by auth middleware.
   * @param res Express response.
   * @returns A promise that resolves after the response is sent.
   */
  async list(req: Request, res: Response): Promise<void> {
    const schedules = await this.buildService(req).listAll(listSchedulesSchema.parse(req.query));

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
    const input = createScheduleSchema.parse(req.body);
    const schedule = await this.buildService(req).createForUser(input, {
      id: req.user!.id,
      role: req.user!.role,
    });

    this.handleSuccess(res, schedule, 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = uuidParamSchema.parse(req.params);
    const input = updateScheduleSchema.parse(req.body);
    const schedule = await this.buildService(req).updateForUser(id, input, {
      id: req.user!.id,
      role: req.user!.role,
    });

    this.handleSuccess(res, schedule);
  }

  async addAssignment(req: Request, res: Response): Promise<void> {
    const { id } = uuidParamSchema.parse(req.params);
    const input = createAssignmentSchema.parse(req.body);
    const assignment = await this.buildService(req).addAssignment(id, input, {
      id: req.user!.id,
      role: req.user!.role,
    });

    this.handleSuccess(res, assignment, 201);
  }

  async updateAssignmentStatus(req: Request, res: Response): Promise<void> {
    const params = assignmentParamsSchema.parse(req.params);
    const input = updateAssignmentStatusSchema.parse(req.body);
    const assignment = await this.buildService(req).updateAssignmentStatus(
      params.id,
      params.assignmentId,
      input,
      {
        id: req.user!.id,
        role: req.user!.role,
      }
    );

    this.handleSuccess(res, assignment);
  }

  async removeAssignment(req: Request, res: Response): Promise<void> {
    const params = assignmentParamsSchema.parse(req.params);
    await this.buildService(req).removeAssignment(params.id, params.assignmentId, {
      id: req.user!.id,
      role: req.user!.role,
    });

    this.handleSuccess(res, { message: "Atribuição removida da escala" });
  }

  async listMine(req: Request, res: Response): Promise<void> {
    const schedules = await this.buildService(req).listMine(req.user!.id);
    this.handleSuccess(res, schedules);
  }
}
