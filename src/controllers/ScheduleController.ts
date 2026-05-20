import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { ScheduleRepository } from "../repositories/ScheduleRepository";
import { AuthenticatedUser, ScheduleService } from "../services/scheduleService";
import {
  assignmentParamsSchema,
  createAssignmentSchema,
  createScheduleSchema,
  updateAssignmentStatusSchema,
  uuidParamsSchema,
} from "../validators/schedule.validator";

export class ScheduleController extends BaseController {
  /**
   * Lists schedules for the authenticated tenant.
   *
   * @param req Express request with req.user populated by auth middleware.
   * @param res Express response.
   * @returns A promise that resolves after the response is sent.
   */
  async list(req: Request, res: Response): Promise<void> {
    const service = this.buildService(req);
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
    const input = createScheduleSchema.parse(req.body);
    const service = this.buildService(req);
    const schedule = await service.create(input, this.getAuthenticatedUser(req));

    this.handleSuccess(res, schedule, 201);
  }

  async addAssignment(req: Request, res: Response): Promise<void> {
    const { id } = uuidParamsSchema.parse(req.params);
    const input = createAssignmentSchema.parse(req.body);
    const service = this.buildService(req);
    const assignment = await service.addAssignment(id, input, this.getAuthenticatedUser(req));

    this.handleSuccess(res, assignment, 201);
  }

  async updateAssignmentStatus(req: Request, res: Response): Promise<void> {
    const { id, assignmentId } = assignmentParamsSchema.parse(req.params);
    const input = updateAssignmentStatusSchema.parse(req.body);
    const service = this.buildService(req);
    const assignment = await service.updateAssignmentStatus(
      id,
      assignmentId,
      input,
      this.getAuthenticatedUser(req)
    );

    this.handleSuccess(res, assignment);
  }

  async removeAssignment(req: Request, res: Response): Promise<void> {
    const { id, assignmentId } = assignmentParamsSchema.parse(req.params);
    const service = this.buildService(req);
    await service.removeAssignment(id, assignmentId, this.getAuthenticatedUser(req));

    this.handleSuccess(res, { deleted: true });
  }

  async listMine(req: Request, res: Response): Promise<void> {
    const service = this.buildService(req);
    const schedules = await service.listMine(this.getAuthenticatedUser(req));

    this.handleSuccess(res, schedules);
  }

  private buildService(req: Request): ScheduleService {
    return new ScheduleService(new ScheduleRepository(req.user!.tenantId));
  }

  private getAuthenticatedUser(req: Request): AuthenticatedUser {
    return {
      userId: req.user!.id,
      role: req.user!.role,
      tenantId: req.user!.tenantId,
    };
  }
}
