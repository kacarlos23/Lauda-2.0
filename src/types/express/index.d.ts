import { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        tenantId: string;
        permissions?: string[];
      };
    }
  }
}

export {};
