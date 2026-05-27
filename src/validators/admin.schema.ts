import { z } from "zod";

export const adminTenantParamsSchema = z.object({
  tenantId: z.string().uuid("tenantId inválido"),
});

export const adminUsersQuerySchema = z.object({
  tenantId: z.string().uuid("tenantId inválido").optional(),
});
