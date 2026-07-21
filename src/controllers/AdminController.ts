import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { AdminService } from "../services/adminService";
import {
  adminScheduleParamsSchema,
  adminDeleteQuerySchema,
  adminResourceIdParamsSchema,
  adminResourceParamsSchema,
  adminResourcePayloadSchema,
  adminResourceQuerySchema,
  adminGrantPermissionSchema,
  adminSetPermissionsSchema,
  adminSongParamsSchema,
  adminTenantParamsSchema,
  adminTenantScopedQuerySchema,
  adminUpdateScheduleSchema,
  adminUpdateSongSchema,
  adminUpdateTenantSchema,
  adminUpdateUserSchema,
  adminUserParamsSchema,
  adminUserPermissionsQuerySchema,
  adminUsersQuerySchema,
} from "../validators/admin.schema";
import { PermissionService } from "../services/permissionService";
import { PermissionKey } from "../constants/permissions";

export class AdminController extends BaseController {
  private readonly service = new AdminService();
  private readonly permissionService = new PermissionService();

  async listResources(_req: Request, res: Response): Promise<void> {
    this.handleSuccess(res, this.service.listResources());
  }

  async listResource(req: Request, res: Response): Promise<void> {
    const { resource } = adminResourceParamsSchema.parse(req.params);
    const query = adminResourceQuerySchema.parse(req.query);
    this.handleSuccess(res, await this.service.listResource(resource, query));
  }

  async getResource(req: Request, res: Response): Promise<void> {
    const { resource, id } = adminResourceIdParamsSchema.parse(req.params);
    this.handleSuccess(res, await this.service.getResource(resource, id));
  }

  async createResource(req: Request, res: Response): Promise<void> {
    const { resource } = adminResourceParamsSchema.parse(req.params);
    const payload = adminResourcePayloadSchema.parse(req.body);
    this.handleSuccess(res, await this.service.createResource(req.user!, resource, payload), 201);
  }

  async updateResource(req: Request, res: Response): Promise<void> {
    const { resource, id } = adminResourceIdParamsSchema.parse(req.params);
    const payload = adminResourcePayloadSchema.parse(req.body);
    this.handleSuccess(res, await this.service.updateResource(req.user!, resource, id, payload));
  }

  async activateResource(req: Request, res: Response): Promise<void> {
    const { resource, id } = adminResourceIdParamsSchema.parse(req.params);
    this.handleSuccess(res, await this.service.activateResource(req.user!, resource, id));
  }

  async deactivateResource(req: Request, res: Response): Promise<void> {
    const { resource, id } = adminResourceIdParamsSchema.parse(req.params);
    this.handleSuccess(res, await this.service.deactivateResource(req.user!, resource, id));
  }

  async deleteResource(req: Request, res: Response): Promise<void> {
    const { resource, id } = adminResourceIdParamsSchema.parse(req.params);
    adminDeleteQuerySchema.parse(req.query);
    this.handleSuccess(res, await this.service.deleteResource(req.user!, resource, id));
  }

  async listTenants(_req: Request, res: Response): Promise<void> {
    const tenants = await this.service.listTenants();
    this.handleSuccess(res, tenants);
  }

  async getTenant(req: Request, res: Response): Promise<void> {
    const { tenantId } = adminTenantParamsSchema.parse(req.params);
    const tenant = await this.service.getTenantById(tenantId);
    this.handleSuccess(res, tenant);
  }

  async updateTenant(req: Request, res: Response): Promise<void> {
    const { tenantId } = adminTenantParamsSchema.parse(req.params);
    const input = adminUpdateTenantSchema.parse(req.body);
    this.handleSuccess(res, await this.service.updateTenant(req.user!, tenantId, input));
  }

  async listUsers(req: Request, res: Response): Promise<void> {
    const query = adminUsersQuerySchema.parse(req.query);
    const users = await this.service.listUsers(query.tenantId);
    this.handleSuccess(res, users);
  }

  async listPermissions(_req: Request, res: Response): Promise<void> {
    this.handleSuccess(res, await this.permissionService.listPermissions());
  }

  async listUserPermissions(req: Request, res: Response): Promise<void> {
    const { userId } = adminUserParamsSchema.parse(req.params);
    adminUserPermissionsQuerySchema.parse(req.query);
    this.handleSuccess(res, await this.permissionService.listUserPermissions(userId));
  }

  async grantUserPermission(req: Request, res: Response): Promise<void> {
    const { userId } = adminUserParamsSchema.parse(req.params);
    const input = adminGrantPermissionSchema.parse(req.body);
    this.handleSuccess(
      res,
      await this.permissionService.grantPermission(req.user!, {
        userId,
        permissionKey: input.permissionKey as PermissionKey,
        effect: input.effect,
      }),
      201
    );
  }

  async setUserPermissions(req: Request, res: Response): Promise<void> {
    const { userId } = adminUserParamsSchema.parse(req.params);
    const input = adminSetPermissionsSchema.parse(req.body);
    this.handleSuccess(
      res,
      await this.permissionService.setUserPermissions(req.user!, {
        userId,
        overrides: input.overrides.map((override) => ({
          permissionKey: override.permissionKey as PermissionKey,
          effect: override.effect,
        })),
      })
    );
  }

  async revokeUserPermission(req: Request, res: Response): Promise<void> {
    const { userId } = adminUserParamsSchema.parse(req.params);
    const input = adminGrantPermissionSchema.parse(req.body);
    this.handleSuccess(
      res,
      await this.permissionService.revokePermission(req.user!, {
        userId,
        permissionKey: input.permissionKey as PermissionKey,
      })
    );
  }

  async updateUser(req: Request, res: Response): Promise<void> {
    const { userId } = adminUserParamsSchema.parse(req.params);
    const input = adminUpdateUserSchema.parse(req.body);
    this.handleSuccess(res, await this.service.updateUser(req.user!, userId, input));
  }

  async listMinistries(_req: Request, res: Response): Promise<void> {
    const ministries = await this.service.listMinistries();
    this.handleSuccess(res, ministries);
  }

  async listSongs(req: Request, res: Response): Promise<void> {
    const query = adminTenantScopedQuerySchema.parse(req.query);
    this.handleSuccess(res, await this.service.listSongs(query.tenantId));
  }

  async updateSong(req: Request, res: Response): Promise<void> {
    const { songId } = adminSongParamsSchema.parse(req.params);
    const input = adminUpdateSongSchema.parse(req.body);
    this.handleSuccess(res, await this.service.updateSong(req.user!, songId, input));
  }

  async listSchedules(req: Request, res: Response): Promise<void> {
    const query = adminTenantScopedQuerySchema.parse(req.query);
    this.handleSuccess(res, await this.service.listSchedules(query.tenantId));
  }

  async updateSchedule(req: Request, res: Response): Promise<void> {
    const { scheduleId } = adminScheduleParamsSchema.parse(req.params);
    const input = adminUpdateScheduleSchema.parse(req.body);
    this.handleSuccess(res, await this.service.updateSchedule(req.user!, scheduleId, input));
  }
}
