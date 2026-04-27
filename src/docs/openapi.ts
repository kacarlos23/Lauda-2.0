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

const ErrorResponseSchema = registry.register(
  "ErrorResponse",
  z.object({
    success: z.boolean().meta({ example: false }),
    error: z.string().meta({ example: "Credenciais invalidas" }),
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

registry.registerPath({
  method: "post",
  path: "/api/auth/login",
  summary: "Autentica usuario",
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
      description: "Tokens emitidos para credenciais validas.",
      content: { "application/json": { schema: LoginResponseSchema } },
    },
    401: {
      description: "Credenciais invalidas.",
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
      description: "Token ausente ou invalido.",
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
      description: "Payload invalido.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Usuario sem permissao para criar escalas.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
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
      description: "API multi-tenant para gerenciamento de ministerios.",
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
