import { z } from "zod";
import { supportResourceNames } from "../constants/supportAccess";

export const supportGrantIdSchema = z.object({
  grantId: z.string().uuid("grantId inválido"),
});

export const createSupportGrantSchema = z.object({
  granteeId: z.string().uuid("granteeId inválido"),
  tenantId: z.string().uuid("tenantId inválido"),
  resource: z.enum(supportResourceNames),
  resourceId: z.string().uuid("resourceId inválido").nullable().optional(),
  scopes: z.array(z.literal("read")).min(1).max(1).default(["read"]),
  ticketReference: z.string().trim().min(3).max(100),
  reason: z.string().trim().min(10).max(500),
  expiresInMinutes: z.number().int().min(5).max(1440),
});

export const revokeSupportGrantSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

export const supportResourceParamsSchema = z.object({
  resource: z.enum(supportResourceNames),
});

export const supportResourceIdParamsSchema = supportResourceParamsSchema.extend({
  id: z.string().uuid("ID inválido"),
});

export const supportResourceQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateSupportGrantInput = z.infer<typeof createSupportGrantSchema>;
