import { NextFunction, Request, Response } from "express";
import { isSupportResourceName, SupportScope } from "../constants/supportAccess";
import { ForbiddenError, UnauthorizedError, ValidationError } from "../errors/AppError";
import { PrivilegedAccessService } from "../services/privilegedAccessService";

const service = new PrivilegedAccessService();

export const requireSupportAccess = (scope: SupportScope) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError("Token de autenticação ausente");
      const grantId = req.header("x-support-access-id")?.trim();
      if (!grantId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(grantId)) {
        throw new ForbiddenError("Grant de suporte válido é obrigatório");
      }
      const resource = String(req.params.resource ?? "");
      if (!isSupportResourceName(resource)) throw new ValidationError("Recurso de suporte inválido");
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
