import { z } from "zod";
import { richTextCommentsSchema } from "./richText.schema";
import { PermissionEffect, Role } from "@prisma/client";
import { MUSICAL_KEYS, youtubeVideoUrlSchema } from "./song.schema";
import { adminResourceNames } from "../repositories/AdminRepository";
import { legacyPermissionAliases, normalizePermissionKey, permissionDefinitions } from "../constants/permissions";

const permissionKeys = [
  ...permissionDefinitions.map((permission) => permission.key),
  ...Object.keys(legacyPermissionAliases),
] as [string, ...string[]];
const permissionKeySchema = z.enum(permissionKeys).transform((key) => normalizePermissionKey(key)!);

export const adminTenantParamsSchema = z.object({
  tenantId: z.string().uuid("tenantId inválido"),
});

export const adminUserParamsSchema = z.object({
  userId: z.string().trim().min(1, "userId inválido"),
});

export const adminSongParamsSchema = z.object({
  songId: z.string().uuid("songId inválido"),
});

export const adminScheduleParamsSchema = z.object({
  scheduleId: z.string().uuid("scheduleId inválido"),
});

export const adminResourceParamsSchema = z.object({
  resource: z.enum(adminResourceNames, "Recurso administrativo inválido"),
});

export const adminResourceIdParamsSchema = adminResourceParamsSchema.extend({
  id: z.string().uuid("ID inválido"),
});

export const adminUsersQuerySchema = z.object({
  tenantId: z.string().uuid("tenantId inválido").optional(),
});

export const adminTenantScopedQuerySchema = z.object({
  tenantId: z.string().uuid("tenantId inválido").optional(),
});

export const adminUserPermissionsQuerySchema = z.object({
  tenantId: z.string().uuid("tenantId invÃ¡lido").optional(),
});

const deprecatedAdminGrantPermissionSchema = z.object({
  permissionKey: z.enum(permissionKeys),
  tenantId: z.string().uuid("tenantId invÃ¡lido").nullable().optional(),
});

const deprecatedAdminSetPermissionsSchema = z.object({
  permissionKeys: z.array(z.enum(permissionKeys)),
  tenantId: z.string().uuid("tenantId invÃ¡lido").nullable().optional(),
});

export const adminGrantPermissionSchema = z.object({
  permissionKey: permissionKeySchema,
  effect: z.enum(PermissionEffect).default(PermissionEffect.ALLOW),
});

export const adminSetPermissionsSchema = z.union([
  z.object({
    overrides: z.array(z.object({ permissionKey: permissionKeySchema, effect: z.enum(PermissionEffect) })),
  }),
  z.object({ permissionKeys: z.array(permissionKeySchema) }).transform((input) => ({
    overrides: input.permissionKeys.map((permissionKey) => ({ permissionKey, effect: PermissionEffect.ALLOW })),
  })),
]);

void deprecatedAdminGrantPermissionSchema;
void deprecatedAdminSetPermissionsSchema;

export const adminResourceQuerySchema = z.object({
  tenantId: z.string().uuid("tenantId inválido").optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const adminResourcePayloadSchema = z.record(z.string(), z.unknown());

export const adminDeleteQuerySchema = z.object({
  confirm: z.literal("permanent"),
});

const optionalNullableText = (max = 500) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() || null : value),
    z.string().max(max).nullable().optional()
  );

const externalLinkSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() || null : value),
  z.string()
    .url("Informe uma URL válida")
    .refine((value) => value.startsWith("http://") || value.startsWith("https://"), "Use uma URL iniciada com http:// ou https://")
    .nullable()
    .optional()
);

export const adminUpdateTenantSchema = z.object({
  name: z.string().trim().min(1, "Nome da igreja é obrigatório").max(200).optional(),
  domain: optionalNullableText(255),
  comments: richTextCommentsSchema,
}).refine((input) => Object.keys(input).length > 0, "Informe ao menos um campo para atualizar");

export const adminUpdateUserSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(200).optional(),
  email: z.string().trim().email("E-mail inválido").max(255).optional(),
  phone: optionalNullableText(50),
  avatarUrl: optionalNullableText(2000),
  comments: richTextCommentsSchema,
  role: z.enum(Role).optional(),
  tenantId: z.string().uuid("tenantId inválido").nullable().optional(),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres").max(120).optional(),
  reason: z.string().trim().min(10).max(500).optional(),
  ticketReference: z.string().trim().min(3).max(100).optional(),
  confirmation: z.string().trim().max(300).optional(),
}).refine(
  (input) => input.role !== Role.GLOBAL_ADMIN || input.tenantId !== undefined,
  "Ao transformar em GLOBAL_ADMIN, informe tenantId como null ou uma igreja"
).refine((input) => Object.keys(input).length > 0, "Informe ao menos um campo para atualizar");

export const adminUpdateSongSchema = z.object({
  title: z.string().trim().min(1, "Título é obrigatório").max(200).optional(),
  composer: optionalNullableText(200),
  originalKey: z.enum(MUSICAL_KEYS, "Tom inválido").optional(),
  content: z.string().min(1, "A cifra é obrigatória").max(100_000).optional(),
  comments: richTextCommentsSchema,
  bpm: z.number().int().min(30).max(300).nullable().optional(),
  cifraUrl: externalLinkSchema,
  letraUrl: externalLinkSchema,
  audioUrl: externalLinkSchema,
  videoUrl: youtubeVideoUrlSchema,
  artistId: z.string().uuid("artistId inválido").optional(),
}).refine((input) => Object.keys(input).length > 0, "Informe ao menos um campo para atualizar");

export const adminUpdateScheduleSchema = z.object({
  title: z.string().trim().min(3, "Título deve ter entre 3 e 100 caracteres").max(100).optional(),
  date: z.string().datetime("Data deve estar em formato ISO datetime válido").transform((value) => new Date(value)).optional(),
  ministryId: z.string().uuid("Ministério inválido").optional(),
  comments: richTextCommentsSchema,
  songIds: z.array(z.string().uuid("Música inválida")).optional(),
  assignments: z.array(z.object({
    userId: z.string().uuid("Usuário inválido"),
    role: z.string().trim().min(2, "Função deve ter ao menos 2 caracteres").max(100),
  })).optional(),
}).refine((input) => Object.keys(input).length > 0, "Informe ao menos um campo para atualizar");

export type AdminUpdateTenantInput = z.infer<typeof adminUpdateTenantSchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export type AdminUpdateSongInput = z.infer<typeof adminUpdateSongSchema>;
export type AdminUpdateScheduleInput = z.infer<typeof adminUpdateScheduleSchema>;

