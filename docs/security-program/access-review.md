# Access Review Inicial v1

Versao: 1.0
Data da revisao: 2026-07-16
Escopo: privilegios identificaveis no repositorio/configuracao; nao inclui consulta a ambiente produtivo ou banco real
Status: revisão técnica inicial concluída em 2026-07-17; recertificação nominal de produção pendente
Aprovadores: Security Owner TBD; Operacao TBD; Engenharia TBD
Proxima revisao: 2026-10-16 e tambem por incidente, desligamento, mudanca de funcao ou alteracao de RBAC

## Evidencias

- Roles Prisma: `GLOBAL_ADMIN`, `TENANT_ADMIN`, `MINISTRY_LEADER`, `MEMBER`.
- Permissoes granulares: `src/constants/permissionContract.ts`.
- Enforcement: `src/middlewares/authMiddleware.ts`, `src/services/permissionService.ts`.
- Admin global: `src/routes/adminRoutes.ts`, `src/services/adminService.ts`, `src/repositories/AdminRepository.ts`.
- Scripts: `scripts/promote-global-admin.ts`, `scripts/debug-admin-tenants.ts`, `scripts/start-project.ps1`, `scripts/setup-cloudflare-tunnel.ps1`.
- CI/infra: `.github/workflows/*.yml`, `docker-compose.yml`, `cloudflare/laudaapp-tunnel.example.yml`, `.env.example`.

## Matriz de privilegios da aplicacao

| Acesso | Capacidades observadas | Owner | Justificativa atual | Necessidade atual | Proxima revisao | Status/risco |
|---|---|---|---|---|---|---|
| `GLOBAL_ADMIN` | Acesso a `/api/admin/*`; MFA produtivo e step-up para mutações; bypass RBAC global | Security/Operação TBD | Administração excepcional da plataforma, não suporte cotidiano | Necessidade não comprovada por pessoa/conta; lista nominal pendente | 2026-10-16 ou antes de produção | Controle técnico forte; aprovação nominal e SIEM pendentes. |
| `TENANT_ADMIN` | Baseline com todas permissoes assignable no tenant; gerencia membros, escalas, musicas, ministerios, instrumentos e tenant | Operacao do tenant TBD | Administracao da igreja/tenant | Necessaria para tenant, mas recertificacao nominal pendente | 2026-10-16 | Alto/medio; contexto religioso e PII de membros. |
| `MINISTRY_LEADER` | Baseline: criar/responder escalas, criar/ver/editar musicas, anexar musicas, ver ministerios/instrumentos; regras de lideranca para ministerio | Operacao do tenant TBD | Coordenacao de ministerio | Necessaria quando lideranca ativa | 2026-10-16 | Medio; precisa revisar ministerios liderados. |
| `MEMBER` | Responder escalas, ver musicas/ministerios/instrumentos, editar perfil/instrumentos proprios | Operacao do tenant TBD | Uso comum do app | Necessaria para usuarios ativos | 2026-10-16 | Baixo/medio; ainda envolve contexto religioso. |
| Overrides `UserPermission` ALLOW/DENY | Ajustam permissoes assignable por usuario/tenant; `DENY` prevalece; `permissions:manage` nao delegavel | Security/Operacao TBD | Excecoes de acesso | Necessidade deve ser caso a caso | 2026-10-16 | Alto se sem expiração/justificativa; concedente e audit log existem. |
| `permissions:manage` | Catalogada como nao assignable; so `GLOBAL_ADMIN` gerencia overrides | Security TBD | Administracao central | Deve permanecer nao delegavel | 2026-10-16 | Controle parcial implementado. |
| Self-service membro | Perfil, instrumentos proprios, status da propria escala | Produto/Operacao TBD | Autonomia do titular | Necessaria | 2026-10-16 | Validar que self nao altera role/tenant. |

## Contas e acessos excepcionais identificaveis

| Item | Evidencia | Owner | Justificativa | Necessidade atual | Acao |
|---|---|---|---|---|---|
| Promoção `GLOBAL_ADMIN` | `src/services/globalAdminPromotion.ts`, script local e API administrativa | Security/Engenharia TBD | Bootstrap local ou transição controlada | Script bloqueado em produção; API exige step-up, motivo, ticket e confirmação | Nomear aprovador independente e recertificar contas reais. |
| Grants de suporte | `SupportAccessGrant`, `/api/support`, `privilegedAccessService.ts` | Security/Operação TBD | Diagnóstico read-only por tenant/recurso | Técnico: mínimo, sessão, prazo e auditoria; contas reais não inventariadas | Inventariar grantees e conectar alertas/SIEM. |
| Script `debug-admin-tenants` | Lista contagens e nomes/IDs de tenants via `basePrisma` | Engenharia/Operacao TBD | Diagnostico local/admin | Deve ser restrito a ambiente controlado | Documentar uso, proibir dados reais em maquinas locais sem aprovacao. |
| Admin generic CRUD | `AdminService.writableFields`, `AdminRepository` via `basePrisma` | Security/Engenharia TBD | Suporte global | Requer recertificacao e logs | Revisar mass assignment, payload auditado e campos sensiveis livres. |
| Contas de suporte | Nao encontradas nominalmente no repo | Operacao TBD | TBD | TBD | Criar inventario nominal antes de producao. |
| Contas de servico da aplicacao | Banco via `DATABASE_URL`; Redis/SMTP futuros | Infra TBD | Runtime | Necessarias, mas credenciais/provedor TBD | Cofre, rotacao, least privilege, TLS. |
| GitHub Actions | Workflows de CI em PR/push; envs de teste | Engenharia/Security TBD | Build/teste | Necessaria | Branch protection, permissao minima, secret scanning, artifact retention. |
| Cloudflare credentials | Script gera config em `%USERPROFILE%\.cloudflared`; nao no repo | Infra/Security TBD | Tunnel publico/local | Uso produtivo TBD | Definir owner, escopo, revogacao e logs. |
| Banco local Docker | `postgres:15` com credenciais locais padrao | Engenharia | Dev local | Somente dev | Nao usar dados reais; limpar volumes quando necessario. |

## Criterios de recertificacao

| Campo obrigatorio | Regra |
|---|---|
| Titular da conta | Pessoa, conta de servico ou grupo tecnico identificado. |
| Aprovador | Data Owner ou System Owner autorizado; nao pode ser a mesma pessoa para acesso privilegiado alto risco. |
| Justificativa | Finalidade concreta e tenant/escopo. |
| Escopo | Role, permissao, tenant, recurso e ambiente. |
| Expiracao/revisao | Obrigatoria para `GLOBAL_ADMIN`, suporte, break-glass e overrides excepcionais. |
| Evidencia | Ticket, audit log, change request ou registro assinado. |

## Decisoes pendentes

| ID | Decisao/acao necessaria | Papel responsavel por decidir/executar | Bloqueio provocado | Etapa limite |
|---|---|---|---|---|
| AR-01 | Nomear Security Owner e aprovadores de acesso. | Direcao/Operacao; nomes TBD. | Recertificacao fica sem accountable/aprovador; bloqueia producao. | Etapa 0, antes de producao. |
| AR-02 | Inventariar contas reais `GLOBAL_ADMIN`, suporte, servico, GitHub, Cloudflare, DB, Redis e SMTP. | Security/Infra; nomes TBD. | Menor privilegio e revogacao nao podem ser comprovados; bloqueia producao. | Etapa 0, antes de producao. |
| AR-03 | Aprovar operacionalmente MFA/step-up técnico e definir recuperação segura. | Security/Produto; nomes TBD. | Implementação existe, mas operação sem owner/recuperação ainda bloqueia painel global produtivo. | Antes de liberar painel global. |
| AR-04 | Nomear aprovadores e conectar monitoramento/revisão pós-uso ao grant de suporte implementado. | Security/Operação; nomes TBD. | Mecanismo técnico existe; operação com dados reais continua sem accountable/alerta. | Antes de suporte com dados reais. |
| AR-05 | Criar relatorio periodico de overrides `UserPermission` e recertificacao. | Engenharia/Security; owners TBD. | Excecoes podem persistir sem revisao; bloqueia conclusao da primeira recertificacao. | Etapa 3, ate a primeira revisao trimestral e antes de declarar access review concluido. |

## Conclusao da primeira revisao

O enforcement técnico de MFA/step-up, promoção e suporte temporário foi concluído e testado em 2026-07-17. A revisão nominal não pode ser aprovada porque owners, aprovadores independentes, contas reais, acessos de infraestrutura e fornecedores permanecem `TBD`. Até resolver AR-01/AR-02 e operacionalizar alertas, produção com dados reais/painel global permanece bloqueada.
