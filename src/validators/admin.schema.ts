import { z } from "zod";

export const adminTenantParamsSchema = z.object({
  tenantId: z.string().uuid("tenantId invÃ¡lido"),
});

export const adminUsersQuerySchema = z.object({
  tenantId: z.string().uuid("tenantId invÃ¡lido").optional(),
});
