# Contrato canônico de RBAC

Versão: 1.0  
Data: 2026-07-17  
Fonte canônica: backend (`permissionContract.ts`, `permissionService.ts`, `authMiddleware.ts`)

| Role | Escopo e baseline |
|---|---|
| `GLOBAL_ADMIN` | Administração de plataforma sem tenant vinculado. Possui catálogo completo, mas `/api/admin` exige role atual do banco, MFA em produção e step-up para mutações. Não é role de suporte cotidiano. |
| `TENANT_ADMIN` | Todas as permissões operacionais assignable, somente no próprio tenant. Não recebe `permissions:manage`. |
| `MINISTRY_LEADER` | Cria/responde escalas, cria/vê/edita músicas, anexa músicas e vê ministérios/instrumentos; regras contextuais ainda limitam operações ao ministério liderado. |
| `MEMBER` | Responde suas escalas e vê músicas, ministérios e instrumentos; self-service limitado a perfil/instrumentos próprios. |

Precedência:

1. a sessão/JWT identifica somente `sid` e `userId`;
2. o middleware recarrega usuário, role, tenant, lifecycle e sessão do banco em toda requisição;
3. o baseline vem de `rolePermissionMap`;
4. override `DENY` remove a permissão herdada;
5. override `ALLOW` adiciona permissão assignable;
6. `permissions:manage` nunca é delegável;
7. o conjunto efetivo do banco é anexado à requisição e usado pelos middlewares/serviços;
8. troca de role, tenant ou override vale na requisição seguinte; transições de GLOBAL_ADMIN também revogam sessões.

Promoção/rebaixamento GLOBAL_ADMIN exige motivo, ticket, confirmação textual, auditoria, MFA previamente habilitado quando a política produtiva está ativa, bloqueio de self-change e proteção do último admin ativo.
