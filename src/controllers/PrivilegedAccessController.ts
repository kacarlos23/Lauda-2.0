import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { PrivilegedAccessService } from "../services/privilegedAccessService";
import {
  createSupportGrantSchema,
  revokeSupportGrantSchema,
  supportGrantIdSchema,
  supportResourceIdParamsSchema,
  supportResourceParamsSchema,
  supportResourceQuerySchema,
} from "../validators/supportAccess.schema";

export class PrivilegedAccessController extends BaseController {
  private readonly service = new PrivilegedAccessService();

  async createGrant(req: Request, res: Response): Promise<void> {
    const input = createSupportGrantSchema.parse(req.body);
    this.handleSuccess(res, await this.service.createSupportGrant(req.user!, input), 201);
  }

  async listGrants(_req: Request, res: Response): Promise<void> {
    this.handleSuccess(res, await this.service.listSupportGrants());
  }

  async revokeGrant(req: Request, res: Response): Promise<void> {
    const { grantId } = supportGrantIdSchema.parse(req.params);
    const { reason } = revokeSupportGrantSchema.parse(req.body);
    this.handleSuccess(res, await this.service.revokeSupportGrant(req.user!, grantId, reason));
  }

  async listSupportResource(req: Request, res: Response): Promise<void> {
    const { resource } = supportResourceParamsSchema.parse(req.params);
    const query = supportResourceQuerySchema.parse(req.query);
    this.handleSuccess(res, await this.service.listSupportResource(resource, req.supportAccess!.tenantId, query));
  }

  async getSupportResource(req: Request, res: Response): Promise<void> {
    const { resource, id } = supportResourceIdParamsSchema.parse(req.params);
    this.handleSuccess(res, await this.service.getSupportResource(resource, id, req.supportAccess!.tenantId));
  }
}
