import {
  extendZodWithOpenApi,
  OpenApiGeneratorV3,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const LoginRequestSchema = registry.register(
  "LoginRequest",
  z.object({
    email: z.string().email().meta({ example: "admin@example.com" }),
    password: z.string().min(1).meta({ example: "secret123" }),
  })
);

const CreateScheduleRequestSchema = registry.register(
  "CreateScheduleRequest",
  z.object({
    title: z.string().min(3).max(100).meta({ example: "Culto de domingo" }),
    date: z.string().datetime().meta({ example: "2026-05-03T13:00:00.000Z" }),
    ministryId: z.string().uuid().meta({ example: "00000000-0000-0000-0000-000000000000" }),
  })
);

const ArtistRequestSchema = registry.register(
  "ArtistRequest",
  z.object({
    name: z.string().min(2).max(100).meta({ example: "Oficina G3" }),
    imageUrl: z.string().url().nullable().optional().meta({ example: "https://example.com/artista.jpg" }),
  })
);

const SongRequestSchema = registry.register(
  "SongRequest",
  z.object({
    title: z.string().min(1).max(200).meta({ example: "Depois da Guerra" }),
    artistId: z.string().uuid(),
    composer: z.string().max(200).nullable().optional(),
    originalKey: z.enum(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B", "Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "A#m", "Bm"]),
    content: z.string().min(1).max(100000).meta({ example: "[G]Grande é o [D]Senhor" }),
    bpm: z.number().int().min(30).max(300).nullable().optional(),
  })
);

const UpdateChurchRequestSchema = registry.register(
  "UpdateChurchRequest",
  z.object({
    name: z.string().min(1).meta({ example: "Igreja Central" }),
  })
);

const ErrorResponseSchema = registry.register(
  "ErrorResponse",
  z.object({
    success: z.boolean().meta({ example: false }),
    error: z.string().meta({ example: "Credenciais inválidas" }),
  })
);

const LoginResponseSchema = registry.register(
  "LoginResponse",
  z.object({
    success: z.boolean().meta({ example: true }),
    data: z.object({
      token: z.string().meta({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }),
      refreshToken: z.string().meta({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }),
      user: z.object({
        id: z.string().uuid(),
        name: z.string().meta({ example: "Admin" }),
        email: z.string().email().meta({ example: "admin@example.com" }),
        role: z.string().meta({ example: "TENANT_ADMIN" }),
      }),
    }),
  })
);

const ScheduleSchema = registry.register(
  "Schedule",
  z.object({
    id: z.string().uuid(),
    title: z.string().meta({ example: "Culto de domingo" }),
    date: z.string().datetime().meta({ example: "2026-05-03T13:00:00.000Z" }),
    tenantId: z.string().uuid(),
    ministryId: z.string().uuid(),
  })
);

const TenantCountSchema = registry.register(
  "TenantCount",
  z.object({
    users: z.number().int(),
    ministries: z.number().int(),
    schedules: z.number().int(),
    instruments: z.number().int(),
  })
);

const GlobalTenantSchema = registry.register(
  "GlobalTenant",
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    createdAt: z.string().datetime(),
    _count: TenantCountSchema,
  })
);

const ChurchSummaryResponseSchema = registry.register(
  "ChurchSummaryResponse",
  z.object({
    success: z.boolean().meta({ example: true }),
    data: z.object({
      tenant: z.object({
        id: z.string().uuid(),
        name: z.string(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
      }),
      _count: TenantCountSchema,
    }),
  })
);

const ScheduleListResponseSchema = registry.register(
  "ScheduleListResponse",
  z.object({
    success: z.boolean().meta({ example: true }),
    data: z.array(ScheduleSchema),
  })
);

const ScheduleResponseSchema = registry.register(
  "ScheduleResponse",
  z.object({
    success: z.boolean().meta({ example: true }),
    data: ScheduleSchema,
  })
);

const GlobalTenantListResponseSchema = registry.register(
  "GlobalTenantListResponse",
  z.object({
    success: z.boolean().meta({ example: true }),
    data: z.array(GlobalTenantSchema),
  })
);

registry.registerPath({
  method: "post",
  path: "/api/auth/login",
  summary: "Autentica usuário",
  request: {
    body: {
      content: {
        "application/json": {
          schema: LoginRequestSchema,
          example: { email: "admin@example.com", password: "secret123" },
        },
      },
    },
  },
  responses: {
    200: {
      description: "Tokens emitidos para credenciais válidas.",
      content: { "application/json": { schema: LoginResponseSchema } },
    },
    401: {
      description: "Credenciais inválidas.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/admin/tenants",
  summary: "Lista igrejas para administradores globais",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Igrejas com contagens reais.",
      content: { "application/json": { schema: GlobalTenantListResponseSchema } },
    },
    401: {
      description: "Token ausente ou inválido.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Usuário sem permissão global.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/church/me",
  summary: "Retorna dados da igreja do tenant autenticado",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Resumo da igreja do tenant.",
      content: { "application/json": { schema: ChurchSummaryResponseSchema } },
    },
    401: {
      description: "Token ausente ou inválido.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Usuário sem permissão de administração da igreja.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/church/me",
  summary: "Atualiza dados básicos da igreja do tenant autenticado",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: UpdateChurchRequestSchema,
          example: { name: "Igreja Central" },
        },
      },
    },
  },
  responses: {
    200: {
      description: "Resumo atualizado da igreja.",
      content: { "application/json": { schema: ChurchSummaryResponseSchema } },
    },
    400: {
      description: "Payload inválido.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: {
      description: "Token ausente ou inválido.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Usuário sem permissão de administração da igreja.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/church/overview",
  summary: "Retorna visão agregada da igreja do tenant autenticado",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Membros, ministérios, instrumentos e escalas do tenant.",
    },
    401: {
      description: "Token ausente ou inválido.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Usuário sem permissão de administração da igreja.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/schedules",
  summary: "Lista escalas do tenant autenticado",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Escalas isoladas pelo tenant do token.",
      content: { "application/json": { schema: ScheduleListResponseSchema } },
    },
    401: {
      description: "Token ausente ou inválido.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/schedules",
  summary: "Cria uma escala",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateScheduleRequestSchema,
          example: {
            title: "Culto de domingo",
            date: "2026-05-03T13:00:00.000Z",
            ministryId: "00000000-0000-0000-0000-000000000000",
          },
        },
      },
    },
  },
  responses: {
    201: {
      description: "Escala criada.",
      content: { "application/json": { schema: ScheduleResponseSchema } },
    },
    400: {
      description: "Payload inválido.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Usuário sem permissão para criar escalas.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get", path: "/api/artists", summary: "Busca artistas do tenant", security: [{ bearerAuth: [] }],
  request: { query: z.object({ search: z.string().optional(), page: z.coerce.number().optional(), limit: z.coerce.number().optional() }) },
  responses: { 200: { description: "Lista paginada de artistas." }, 401: { description: "Não autenticado." } },
});
registry.registerPath({
  method: "post", path: "/api/artists", summary: "Cria artista", security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: ArtistRequestSchema } } } },
  responses: { 201: { description: "Artista criado." }, 403: { description: "Perfil sem permissão." }, 409: { description: "Nome duplicado." } },
});
registry.registerPath({
  method: "patch", path: "/api/artists/{id}", summary: "Edita artista", security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }), body: { content: { "application/json": { schema: ArtistRequestSchema.partial() } } } },
  responses: { 200: { description: "Artista atualizado." }, 404: { description: "Artista não encontrado no tenant." } },
});
registry.registerPath({
  method: "get", path: "/api/songs", summary: "Busca músicas e cifras do tenant", security: [{ bearerAuth: [] }],
  request: { query: z.object({ search: z.string().optional(), artistId: z.string().uuid().optional(), page: z.coerce.number().optional(), limit: z.coerce.number().optional() }) },
  responses: { 200: { description: "Lista paginada de músicas." } },
});
registry.registerPath({
  method: "post", path: "/api/songs", summary: "Cria música e cifra", security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: SongRequestSchema } } } },
  responses: { 201: { description: "Música criada." }, 403: { description: "Perfil sem permissão." }, 409: { description: "Música duplicada para o artista." } },
});
registry.registerPath({
  method: "patch", path: "/api/songs/{id}", summary: "Edita música e cifra", security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }), body: { content: { "application/json": { schema: SongRequestSchema.partial() } } } },
  responses: { 200: { description: "Música atualizada." }, 404: { description: "Música não encontrada no tenant." } },
});
registry.registerPath({
  method: "post", path: "/api/songs/export", summary: "Exporta até 50 cifras em PDF", security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.object({ songIds: z.array(z.string().uuid()).min(1).max(50) }) } } } },
  responses: { 200: { description: "PDF gerado.", content: { "application/pdf": { schema: z.string() } } }, 404: { description: "Uma ou mais músicas não pertencem ao tenant." } },
});

/**
 * Generates the OpenAPI document served by Swagger UI.
 *
 * @returns OpenAPI 3 document for documented API routes.
 */
export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "Lauda 2.0 API",
      version: "1.0.0",
      description: "API multi-tenant para gerenciamento de ministérios.",
    },
    servers: [{ url: "http://localhost:3000" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  } as Parameters<typeof generator.generateDocument>[0]);
}
