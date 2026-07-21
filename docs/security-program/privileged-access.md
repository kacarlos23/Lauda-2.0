# GLOBAL_ADMIN, step-up e suporte temporário

Versão: 1.0  
Data: 2026-07-17  
Status técnico: implementado e testado; aprovação nominal/operacional pendente

## GLOBAL_ADMIN

- Em produção, `GLOBAL_ADMIN_MFA_REQUIRED=true` é obrigatório e não pode ser desativado pela configuração.
- TOTP usa segredo aleatório, cifrado com AES-256-GCM por `MFA_ENCRYPTION_KEY` independente.
- Login global exige senha e TOTP; promoção produtiva exige MFA previamente habilitado.
- `ADMIN_STEP_UP_REQUIRED` assume `true` em produção. Mutações globais exigem senha + TOTP recentes e expiram em `ADMIN_STEP_UP_TTL_MINUTES` (10 por padrão).
- O script antigo não contém alvo hardcoded, exige ator/alvo/motivo/ticket/confirmação/auditoria e é proibido em produção.
- Mudanças nomeadas e CRUD global escrevem `AdminAuditLog`; secrets são redigidos.

## Suporte cotidiano

Contas de suporte não recebem uma quinta role nem precisam ser `GLOBAL_ADMIN`. Um admin global com step-up emite `SupportAccessGrant` read-only com:

- grantee explícito e não-global;
- ticket, motivo e grant identificável;
- tenant e tipo de recurso obrigatórios;
- recurso individual opcional;
- scope mínimo (`read` nesta versão);
- prazo de 5 minutos até `SUPPORT_ACCESS_MAX_MINUTES` (60 por padrão);
- vínculo automático à primeira sessão que usa o grant;
- expiração/revogação automática no enforcement;
- auditoria de concessão, cada uso e revogação.

O acesso ocorre somente em `/api/support/:resource[/id]` com `x-support-access-id`. Não existem endpoints de suporte para mutação, tokens/convites, tenants ou audit logs.

## Bloqueios externos

- nomes de Security Owner, aprovador independente e contas reais não estão disponíveis;
- o processo de aprovação do ticket e alertas/SIEM ainda precisa ser escolhido;
- o inventário nominal de produção não pode ser obtido do repositório;
- enquanto isso, produção com dados reais/painel global continua bloqueada pelo programa de segurança.
