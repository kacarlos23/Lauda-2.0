import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { AdminService } from "../services/adminService";
import { adminTenantParamsSchema, adminUsersQuerySchema } from "../validators/admin.schema";

export class AdminController extends BaseController {
  private readonly service = new AdminService();

  async listTenants(_req: Request, res: Response): Promise<void> {
    const tenants = await this.service.listTenants();
    this.handleSuccess(res, tenants);
  }

  async getTenant(req: Request, res: Response): Promise<void> {
    const { tenantId } = adminTenantParamsSchema.parse(req.params);
    const tenant = await this.service.getTenantById(tenantId);
    this.handleSuccess(res, tenant);
  }

  async listUsers(req: Request, res: Response): Promise<void> {
    const query = adminUsersQuerySchema.parse(req.query);
    const users = await this.service.listUsers(query.tenantId);
    this.handleSuccess(res, users);
  }

  async listMinistries(_req: Request, res: Response): Promise<void> {
    const ministries = await this.service.listMinistries();
    this.handleSuccess(res, ministries);
  }
}
