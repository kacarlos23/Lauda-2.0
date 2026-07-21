import { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: {
        id: string;
        sessionId: string;
        role: Role;
        tenantId: string;
        permissions?: string[];
        mfaVerifiedAt?: Date | null;
        stepUpExpiresAt?: Date | null;
      };
      supportAccess?: {
        grantId: string;
        tenantId: string;
        resource: string;
        resourceId: string | null;
        scopes: string[];
        ticketReference: string;
      };
    }
  }
}

export {};
