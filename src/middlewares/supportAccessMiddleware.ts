import { NextFunction, Request, Response } from "express";
import { SupportScope } from "../constants/supportAccess";
import { UnauthorizedError } from "../errors/AppError";
import { PrivilegedAccessService } from "../services/privilegedAccessService";

const service = new PrivilegedAccessService();

export const requireSupportAccess = (scope: SupportScope) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError("Token de autenticação ausente");
      const grantId = req.header("x-support-access-id")?.trim() ?? "";
      const resource = String(req.params.resource ?? "");
      const resourceId = req.params.id ? String(req.params.id) : null;
      const grant = await service.authorizeSupportAccess({
        grantId,
        userId: req.user.id,
        userRole: req.user.role,
        sessionId: req.user.sessionId,
        scope,
        resource,
        resourceId,
      });
      req.supportAccess = {
        grantId: grant.id,
        tenantId: grant.tenantId,
        resource: grant.resource,
        resourceId: grant.resourceId,
        scopes: grant.scopes,
        ticketReference: grant.ticketReference,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
