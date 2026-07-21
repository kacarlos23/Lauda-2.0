# Threat Model v1

Versao: 1.0
Data: 2026-07-16
Status: baseline tecnico produzido para orientar implementacao; revisao/aprovacao tecnica nominal e aprovacao organizacional pendentes
Aprovadores: Engenharia/Security TBD; Produto/Operacao TBD; Juridico/Privacidade TBD
Proxima revisao: 2026-08-16 ou antes de mudancas em auth, tenant, admin, fornecedor, logs, publico etario ou exportacao

## Escopo

Backend Express/Prisma, PostgreSQL, cliente Expo/React Native/web, scripts administrativos, CI GitHub Actions, integracao Cifra Club, Redis/SMTP futuros e Cloudflare Tunnel configuravel.

## Trust boundaries

```text
Usuario mobile/web
  -> Cliente Expo/React Native/web
  -> API Express publica
  -> Auth/RBAC/rate limit
  -> Tenant Context/Prisma extension
  -> PostgreSQL

API Express
  -> Redis futuro para rate limit
  -> SMTP futuro para reset
  -> Cifra Club via Playwright
  -> PDF em memoria para resposta ao cliente

GLOBAL_ADMIN / suporte
  -> /api/admin usando basePrisma
  -> Todos os tenants, permissoes e audit logs

CI/CD e operadores
  -> GitHub Actions, npm, Playwright browsers
  -> Scripts locais, Docker, Cloudflare Tunnel, secrets/envs
```

## Superficies principais

| Superficie | Evidencia | Observacao |
|---|---|---|
| Auth, sessao e reset | `auth.routes.ts`, `authService.ts`, `authSessionService.ts`, `tokenService.ts`, `passwordReset.ts` | JWT com purpose/issuer/audience/sid/jti; sessao/familia persistidas; reset com HMAC/pepper e revogacao. |
| Tenant isolation | `config/prisma.ts`, repositories tenant-scoped | Extensao cobre modelos principais; `Tenant`, `UserPermission`, `AdminAuditLog` e admin usam `basePrisma`. |
| RBAC granular | `permissionContract.ts`, `permissionService.ts` | `GLOBAL_ADMIN` bypass total; overrides ALLOW/DENY por tenant. |
| Admin global | `adminRoutes.ts`, `AdminService`, `AdminRepository` | MFA produtivo, step-up para mutações, auditoria e transições protegidas; aprovação nominal pendente. |
| Mobile/web storage | `sessionStorage.ts`, `authStore.ts` | SecureStore nativo; `localStorage` web. |
| Export/PDF | `SongPdfService`, `ScheduleReportPdfService`, mobile services | Dados pessoais podem sair para arquivo local. |
| Fornecedores | `.env.example`, `cloudflare`, workflows | Redis/SMTP/Cloudflare/GitHub/Cifra Club/hosting pendentes de review. |

## Ameaças prioritarias

| ID | Ameaca | Ativo/impacto | Controle existente | Teste/evidencia existente | Controle planejado ou lacuna | Prioridade |
|---|---|---|---|---|---|---|
| TM-01 | Account takeover | Conta, tenant, escalas, dados pessoais | bcrypt, erro generico login, rate limit, reset HMAC/pepper, auth eligibility | `auth.test.ts`, `passwordReset.test.ts`, `rateLimitMiddleware.test.ts` | MFA/step-up, alertas, device/session registry, revogacao e reuse detection | Alta |
| TM-02 | Token theft | Access/refresh token no cliente; sessao indevida | Access curto; segredo separado; hash de refresh; rotacao/reuse; logout e lifecycle servidor-side | `tokenService.test.ts`, `auth.test.ts`, `api.test.ts`, `authStore.test.ts` | Web ainda usa `localStorage`; purge/SIEM/alertas pendentes | Alta |
| TM-03 | Cross-tenant/BOLA/IDOR | Dados de outro tenant | Prisma tenant extension; repositories filtram tenant; validacoes de relacao | `tenantIsolation.test.ts`, suites `admin`, `members`, `schedules` | Matriz A/B sistematica por endpoint; cobrir `basePrisma`, `UserPermission`, `AdminAuditLog`, admin generic CRUD | Alta |
| TM-04 | Privilege escalation | Role/permissao indevida, acesso admin | RBAC canônico do banco, não-delegável, MFA/step-up, self-change/último admin protegidos | `granularPermissions.test.ts`, `admin.test.ts`, `privilegedAccess.test.ts` | Recertificação nominal, alertas e revisão independente | Média/Alta |
| TM-05 | Mass assignment | Alteracao de role/tenant/status/campos protegidos | Zod schemas por rota; `writableFields` admin explicito | Testes parciais de admin/auth | Testar todos POST/PATCH/PUT; revisar admin generic payload e audit payload | Alta |
| TM-06 | Abuso de `GLOBAL_ADMIN` | Todos os tenants e dados | MFA produtivo, step-up, auditoria, promoção sem hardcode e suporte por grant scoped/expirável | `admin.test.ts`; `privilegedAccess.test.ts`; `AdminAuditLog` | Aprovação independente, inventário de contas, recuperação MFA e SIEM pendentes | Alta |
| TM-07 | Abuso de suporte | Leitura/alteracao indevida por operador | Audit logs parciais; access review documental | `access-review.md` | Politica de suporte, escopo por tenant, justificativa, expiracao, revisao e monitoramento | Alta |
| TM-08 | Insider threat | Exfiltracao por dev/admin/infra | Git repo, CI, logs e scripts separados parcialmente | Workflows sem secrets prod aparentes | Least privilege GitHub/DB/Cloudflare, secret scanning, approvals, break-glass | Alta |
| TM-09 | Comprometimento CI/CD | Codigo malicioso, secrets, deploy | GitHub Actions build/teste; lockfiles | `.github/workflows/*.yml` | Branch protection, pinned actions policy, SBOM, dependency review, secrets policy | Alta |
| TM-10 | Vazamento de banco | PII, credenciais hash, contexto religioso | bcrypt; reset token HMAC/pepper; tenant IDs | N/A operacional | Criptografia at-rest, TLS, KMS/secrets, least privilege, monitoring, backups seguros | Critica |
| TM-11 | Vazamento de backup | Todos os dados historicos | Nenhum comprovado no repo | Nao ha config | Definir backup criptografado, imutabilidade, expiracao, restore test e purge | Critica |
| TM-12 | Logs contendo PII ou segredos | Exposicao em logs locais/provider/CI | `errorHandler` mascara 500 em prod; senha redigida em audit payload | `authMiddleware.test.ts` para erros; evidencia parcial | Request IDs, logger estruturado, redaction de payloads, politica de logs/artifacts | Alta |
| TM-13 | Fornecedor comprometido | SMTP, Redis, Cloudflare, GitHub, hosting, Cifra Club | Vendor register v1 | `vendor-register.md` | Due diligence, DPAs, regioes, SLA incidente, chaves rotacionaveis | Alta |
| TM-14 | Convite compartilhado/abusado | Ingresso indevido em tenant/ministerio | Codigo unico, active/isActive, rate limit, regeneracao | `auth.test.ts` parcial | Expiracao obrigatoria, quota, auditoria, owner e notificacao | Media/Alta |
| TM-15 | Dados de contexto religioso mal classificados | Tratamento sem base/controles adequados | Data Map marca possivel sensivel | `data-map.md`, `ropa.md` | Decisao juridica, RIPD quando aplicavel, minimizacao, acesso e retencao | Alta |
| TM-16 | Exposicao por PDF/exportacao | Arquivos locais com nomes, escalas e musicas | Autorizacao `song:view`/`schedule:view_reports`; backend nao persiste | Testes de servicos/export parciais | Watermark/audit/export logs, orientacao a usuarios, cleanup local, limitar e-mails no PDF | Media |
| TM-17 | Cifra Club/import externo | SSRF limitado, termos externos, dados em query | Host validado para import; user-agent; search usa base fixa | `cifraClubImportService.test.ts` | Validar termos, timeout/egress, evitar PII em search, monitorar layout/abuso | Media |
| TM-18 | Rate limit bypass/failure | Brute force e abuso de reset/convite | HMAC key, Redis obrigatorio prod, failure mode configuravel | `rateLimitMiddleware.test.ts`, `unifiedConfig.test.ts` | Provisionar Redis seguro; failure mode closed prod; monitoramento | Alta |

## Controles planejados por gate

| Gate futuro | Controle esperado | Ameaças cobertas |
|---|---|---|
| Etapa 1 - Contencao tecnica | Hardening de reset/rate/lifecycle/erros ja parcial | TM-01, TM-12, TM-18 |
| Etapa 2 - Sessoes | Sessao persistente, refresh rotation, revogacao, reuse detection | TM-01, TM-02 |
| Etapa 3 - Multi-tenant/RBAC/admin | Matriz A/B, BOLA/IDOR, mass assignment, admin safeguards | TM-03, TM-04, TM-05, TM-06 |
| Etapa 4 - Lifecycle/direitos | Purge, anonim, direitos, retencao | TM-10, TM-11, TM-15, TM-16 |
| Etapa 5 - Observabilidade/infra/resiliencia | Logs redigidos, request IDs, backup/restore, fornecedor | TM-09, TM-10, TM-11, TM-12, TM-13 |
| Etapa 6 - Secure SDLC | Branch protection, dependency review, secret scanning, threat model updates | TM-08, TM-09, TM-13 |

## Riscos residuais aceitos?

Nenhum risco critico esta aceito nesta etapa. Riscos criticos permanecem pendentes ate owners, fornecedores, backup/restore, incident response, sessoes revogaveis e controles de `GLOBAL_ADMIN` serem aprovados e implementados.
