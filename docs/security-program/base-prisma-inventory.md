# Inventário de acesso Prisma sem escopo de tenant

Versão: 1.0  
Data: 2026-07-17  
Status: inventário técnico concluído; owners nominais dependem de nomeação organizacional  
Próxima revisão: 2026-10-16 ou a cada novo uso proposto

O cliente cru existe somente em `src/config/prisma.ts`. Novos usos da exportação `basePrisma` falham em `basePrismaArchitecture.test.ts` quando não constam da allowlist versionada em `src/security/basePrismaAllowlist.ts`.

| Local | Owner funcional | Contexto autorizado | Restrição/teste |
|---|---|---|---|
| `src/config/prisma.ts` | Platform Engineering | Construir o cliente tenant-scoped a partir do único `PrismaClient` cru | Teste impede outro `new PrismaClient`; extensão força tenant em where e data de escritas autenticadas. |
| `src/events/domainEvents.ts` | Platform Engineering | Executar o dispatcher cross-tenant fora de contexto HTTP, com claim concorrente do outbox e projeção idempotente | IDs de tenant vêm do evento durável; unicidade `eventId + userId`; testes de isolamento, atomicidade e deduplicação. |
| `src/middlewares/authMiddleware.ts` | Identity Engineering | Resolver sessão e estado canônico antes de abrir o contexto tenant | `authMiddleware.test.ts`; JWT não é fonte de role/tenant/permissão. |
| `src/realtime/websocketServer.ts` | Platform Engineering | Validar a sessão vinculada ao ticket opaco antes de existir contexto tenant da conexão WebSocket | Ticket curto/de uso único, predicados de usuário e tenant e sessão ativa; `schedules.test.ts`. |
| `src/repositories/authRepository.ts` | Identity Engineering | Identidade pré-auth, reset, MFA e revogação atômica | `auth.test.ts`, `privilegedAccess.test.ts`, testes unitários de auth. |
| `src/services/authSessionService.ts` | Identity Engineering | Sessões/refresh families são registros de sistema, não recursos de tenant expostos | `auth.test.ts`, `tokenService.test.ts`. |
| `src/repositories/MemberRepository.ts` | Identity Engineering | Inativar membro e revogar sessões na mesma transação com predicate de tenant | `members.test.ts`, `auth.test.ts`. |
| `src/repositories/ChurchRepository.ts` | Tenant Platform | Acessar o modelo raiz `Tenant`; toda consulta recebe `tenantId` autenticado explícito | `admin.test.ts` cobre overview e update A/B. |
| `src/services/permissionService.ts` | Security Engineering | Carregar overrides canônicos e escrever mudanças exclusivas de GLOBAL_ADMIN com auditoria | `granularPermissions.test.ts`, `admin.test.ts`. |
| `src/repositories/AdminRepository.ts` | Security Engineering | Administração global explicitamente role/MFA/step-up-gated | `admin.test.ts`, `privilegedAccess.test.ts`; mutações auditadas. |
| `src/services/privilegedAccessService.ts` | Security Engineering | Emitir/vincular/expirar/revogar/auditar grants de suporte | `privilegedAccess.test.ts`. |
| `scripts/promote-global-admin.ts` | Security Engineering | Bootstrap apenas fora de produção, com ator/alvo/motivo/ticket/confirmação e auditoria | `globalAdminPromotion.test.ts`; execução em produção é bloqueada. |
| `scripts/debug-admin-tenants.ts` | Platform Engineering | Diagnóstico local explícito | Produção bloqueada; exige motivo e confirmação textual. |

Não há justificativa para importar `basePrisma` em controllers, rotas ou serviços de domínio tenant. O teste arquitetural é a barreira contra essa expansão acidental.
