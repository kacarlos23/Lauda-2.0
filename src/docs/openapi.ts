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

const RefreshRequestSchema = registry.register(
  "RefreshRequest",
  z.object({ refreshToken: z.string().min(1).max(4096) }),
);

const ChangePasswordRequestSchema = registry.register(
  "ChangePasswordRequest",
  z.object({ currentPassword: z.string().min(6), newPassword: z.string().min(6) }),
);

const CreateScheduleRequestSchema = registry.register(
  "CreateScheduleRequest",
  z.object({
    title: z.string().min(3).max(100).meta({ example: "Culto de domingo" }),
    date: z.string().datetime().meta({ example: "2026-05-03T13:00:00.000Z" }),
    ministryId: z.string().uuid().meta({ example: "00000000-0000-0000-0000-000000000000" }),
    comments: z.string().nullable().optional().meta({ description: "HTML sanitizado; máximo de 3.000 caracteres visíveis" }),
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
    comments: z.string().nullable().optional().meta({ description: "HTML sanitizado; máximo de 3.000 caracteres visíveis" }),
    cifraUrl: z.string().url().nullable().optional(),
    letraUrl: z.string().url().nullable().optional(),
    audioUrl: z.string().url().nullable().optional(),
    videoUrl: z.string().url().nullable().optional().meta({
      description: "URL opcional de um vídeo individual do YouTube. Formas watch, youtu.be, shorts, embed e live são aceitas e armazenadas no formato canônico.",
      example: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    }),
    tags: z.array(z.string().min(1).max(40)).max(12).optional().meta({
      description: "Temas da música neste tenant. A omissão preserva os temas atuais na edição.",
      example: ["Adoração", "Natal"],
    }),
  })
);

const songTransferFields = z.array(z.enum(["originalKey", "content", "bpm", "cifraUrl", "letraUrl", "audioUrl", "videoUrl", "comments", "tags"])).optional().meta({
  description: "Campos a exportar ou aplicar. Sem esta lista, vale o catálogo antigo: tom, cifra, link da cifra e temas.",
});
const songTransferExisting = z.enum(["create", "update", "skip"]).optional().meta({
  description: "Músicas que já existem (mesmo título e artista). create preserva o conteúdo e só vincula; update grava os campos selecionados; skip não altera. O padrão é create.",
});

const PortableSongSchema = registry.register(
  "PortableSong",
  z.object({
    title: z.string().min(1).max(200),
    artist: z.string().min(1).max(200),
    originalKey: z.enum(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B", "Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "A#m", "Bm"]).optional(),
    content: z.string().min(1).max(100000).optional(),
    bpm: z.number().int().nullable().optional(),
    cifraUrl: z.string().url().nullable().optional(),
    letraUrl: z.string().url().nullable().optional(),
    audioUrl: z.string().url().nullable().optional(),
    videoUrl: z.string().url().nullable().optional(),
    comments: z.string().nullable().optional(),
    tags: z.array(z.string().min(1).max(40)).max(12).optional().meta({
      description: "Temas opcionais. Arquivos antigos sem este campo continuam válidos. Na exportação, a lista é omitida quando a música não tem temas.",
      example: ["Adoração", "Natal"],
    }),
  }),
);

const SongTransferDocumentSchema = registry.register(
  "SongTransferDocument",
  z.object({
    format: z.literal("lauda.music-catalog"),
    version: z.literal(1),
    songs: z.array(PortableSongSchema).min(1).max(2000),
  }),
);

const UpdateChurchRequestSchema = registry.register(
  "UpdateChurchRequest",
  z.object({
    name: z.string().min(1).meta({ example: "Igreja Central" }),
    comments: z.string().nullable().optional().meta({ description: "HTML sanitizado; máximo de 3.000 caracteres visíveis" }),
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
      accessToken: z.string().meta({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }),
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
    comments: z.string().nullable(),
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
    comments: z.string().nullable(),
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
        comments: z.string().nullable(),
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
  method: "post",
  path: "/api/auth/refresh",
  summary: "Rotaciona refresh token de uso único",
  request: { body: { content: { "application/json": { schema: RefreshRequestSchema } } } },
  responses: {
    200: { description: "Novo par de tokens para a mesma sessão.", content: { "application/json": { schema: LoginResponseSchema } } },
    401: { description: "Token inválido, reutilizado ou sessão revogada.", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

for (const path of ["/api/auth/logout", "/api/auth/logout-all"] as const) {
  registry.registerPath({
    method: "post",
    path,
    summary: path.endsWith("logout-all") ? "Revoga todas as sessões do usuário" : "Revoga a sessão atual",
    security: [{ bearerAuth: [] }],
    responses: {
      200: { description: "Revogação concluída." },
      401: { description: "Access token ou sessão inválidos.", content: { "application/json": { schema: ErrorResponseSchema } } },
    },
  });
}

registry.registerPath({
  method: "post",
  path: "/api/auth/change-password",
  summary: "Troca a senha e revoga todas as sessões",
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: ChangePasswordRequestSchema } } } },
  responses: {
    200: { description: "Senha alterada e sessões revogadas." },
    401: { description: "Sessão ou senha atual inválida.", content: { "application/json": { schema: ErrorResponseSchema } } },
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
const SongScopeQuery = z.object({
  search: z.string().optional().meta({ description: "Título, artista ou tema. O prefixo # busca apenas por tema." }),
  artistId: z.string().uuid().optional(),
  originalKey: SongRequestSchema.shape.originalKey.optional(),
  ministryId: z.string().uuid().optional(),
});

registry.registerPath({
  method: "get", path: "/api/songs", summary: "Busca músicas e cifras do tenant", security: [{ bearerAuth: [] }],
  request: { query: SongScopeQuery.extend({
    tags: z.union([z.string(), z.array(z.string())]).optional().meta({
      description: "Um ou mais temas. A música entra se tiver qualquer um deles. Aceita o parâmetro repetido ou uma lista separada por vírgula.",
    }),
    untagged: z.enum(["true", "false"]).optional().meta({ description: "Quando true, também inclui músicas sem temas." }),
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
  }) },
  responses: { 200: { description: "Lista paginada de músicas. Cada música inclui seus temas em tags." } },
});
registry.registerPath({
  method: "get", path: "/api/songs/tags", summary: "Lista temas da igreja e suas contagens de músicas", security: [{ bearerAuth: [] }],
  request: { query: SongScopeQuery },
  responses: {
    200: {
      description: "As contagens consideram a busca e os filtros de artista, tom e ministério.",
      content: { "application/json": { schema: z.object({
        success: z.boolean(),
        data: z.object({
          items: z.array(z.object({ id: z.string().uuid(), name: z.string(), count: z.number().int() })),
          untaggedCount: z.number().int(),
        }),
      }) } },
    },
    401: { description: "Não autenticado." },
    403: { description: "Sem permissão para ver músicas." },
  },
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
const SongTagOperation = z.enum(["add", "remove"]);
const SongTagChangeResult = z.object({ id: z.string().uuid(), tags: z.array(z.string()) });

registry.registerPath({
  method: "patch", path: "/api/songs/{id}/tags", summary: "Adiciona ou remove um tema da música", security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { "application/json": { schema: z.object({ operation: SongTagOperation, name: z.string().min(1).max(40) }) } } },
  },
  responses: {
    200: { description: "Temas atuais da música.", content: { "application/json": { schema: z.object({ success: z.boolean(), data: SongTagChangeResult }) } } },
    403: { description: "Sem permissão para editar músicas." },
    404: { description: "Música indisponível nesta igreja." },
    409: { description: "A música já atingiu o limite de temas." },
  },
});
registry.registerPath({
  method: "patch", path: "/api/songs/tags/batch", summary: "Aplica temas a uma seleção de músicas", security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.object({
    operation: SongTagOperation,
    songIds: z.array(z.string().uuid()).min(1).max(50),
    tagIds: z.array(z.string().uuid()).max(12),
    newTags: z.array(z.string().min(1).max(40)).max(12).optional().meta({ description: "Temas ainda sem ID, aceitos somente em add." }),
  }) } } } },
  responses: {
    200: { description: "Temas atuais das músicas e número de músicas alteradas.", content: { "application/json": { schema: z.object({
      success: z.boolean(),
      data: z.object({ items: z.array(SongTagChangeResult), updated: z.number().int() }),
    }) } } },
    403: { description: "Sem permissão para editar músicas." },
    404: { description: "Uma música ou tema não foi encontrado na igreja." },
    409: { description: "Uma música já atingiu o limite de temas. O lote inteiro é revertido." },
  },
});
registry.registerPath({
  method: "post", path: "/api/songs/export", summary: "Exporta até 50 cifras em PDF", security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.object({ songIds: z.array(z.string().uuid()).min(1).max(50) }) } } } },
  responses: { 200: { description: "PDF gerado.", content: { "application/pdf": { schema: z.string() } } }, 404: { description: "Uma ou mais músicas não pertencem ao tenant." } },
});
registry.registerPath({
  method: "post", path: "/api/songs/data-export", summary: "Exporta o catálogo portátil de um ministério", security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.object({ ministryId: z.string().uuid(), songIds: z.array(z.string().uuid()).max(2000).optional(), fields: songTransferFields }) } } } },
  responses: { 200: { description: "Catálogo JSON gerado.", content: { "application/json": { schema: SongTransferDocumentSchema } } }, 403: { description: "Sem acesso ao ministério." }, 404: { description: "Ministério ou músicas não encontrados." } },
});
registry.registerPath({
  method: "post", path: "/api/songs/data-import/preview", summary: "Revisa um catálogo sem gravar músicas", security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.object({ ministryId: z.string().uuid(), document: SongTransferDocumentSchema, fields: songTransferFields, existing: songTransferExisting }) } } } },
  responses: { 200: { description: "Prévia com criações, vínculos, conflitos e itens inválidos." }, 400: { description: "Arquivo inválido." }, 403: { description: "Sem acesso ao ministério." } },
});
registry.registerPath({
  method: "post", path: "/api/songs/data-import/commit", summary: "Confirma a importação de um catálogo revisado", security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.object({ ministryId: z.string().uuid(), document: SongTransferDocumentSchema, documentHash: z.string().length(64), fields: songTransferFields, existing: songTransferExisting }) } } } },
  responses: { 201: { description: "Músicas válidas importadas e vinculadas ao ministério." }, 409: { description: "Arquivo alterado depois da revisão." } },
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
