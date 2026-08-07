import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { NotificationService } from "../services/notificationService";
import {
  listNotificationsSchema,
  notificationIdSchema,
  pushDeviceIdSchema,
  registerPushDeviceSchema,
} from "../validators/notification.validator";
import { ForbiddenError } from "../errors/AppError";

export class NotificationController extends BaseController {
  private readonly service = new NotificationService();

  private user(req: Request) {
    if (!req.user?.tenantId) throw new ForbiddenError("Notificações estão disponíveis apenas no contexto de uma igreja");
    return { id: req.user!.id, tenantId: req.user!.tenantId, sessionId: req.user!.sessionId };
  }

  async list(req: Request, res: Response) {
    this.handleSuccess(res, await this.service.list(this.user(req), listNotificationsSchema.parse(req.query)));
  }

  async markRead(req: Request, res: Response) {
    const { id } = notificationIdSchema.parse(req.params);
    this.handleSuccess(res, await this.service.markRead(this.user(req), id));
  }

  async markAllRead(req: Request, res: Response) {
    this.handleSuccess(res, await this.service.markAllRead(this.user(req)));
  }

  async registerDevice(req: Request, res: Response) {
    this.handleSuccess(res, await this.service.registerDevice(this.user(req), registerPushDeviceSchema.parse(req.body)), 201);
  }

  async removeDevice(req: Request, res: Response) {
    const { id } = pushDeviceIdSchema.parse(req.params);
    this.handleSuccess(res, await this.service.removeDevice(this.user(req), id));
  }

  async issueRealtimeTicket(req: Request, res: Response) {
    this.handleSuccess(res, await this.service.issueTicket(this.user(req)), 201);
  }
}
