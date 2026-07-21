# Etapa 5 — Observabilidade, infraestrutura e resiliência

Status atual: **parcialmente implementada e comprovada localmente em 2026-07-20; operação produtiva bloqueada**.

## Resumo para leitura em voz alta

Esta etapa torna incidentes detectáveis e recuperáveis sem transformar logs ou ferramentas de observabilidade em novas fontes de vazamento. Ela também comprova criptografia, backup e restore.

## Decisões obrigatórias

- Campos permitidos por categoria de log.
- Fornecedores e regiões de observabilidade.
- Estratégia de Secret Manager ou KMS.
- RPO, RTO e frequência de restore.
- Imutabilidade e segregação de backup.
- Papéis nominais e canal 24 por 7 de incidentes.
- Autoridade para declarar o T0.

## Ordem interna

1. Definir taxonomia e allowlist de logs.
2. Introduzir request IDs.
3. Implantar logger estruturado.
4. Implantar redaction central.
5. Tipar eventos de auditoria.
6. Restringir acesso a logs e secrets.
7. Migrar produção para Secret Manager ou KMS.
8. Comprovar TLS e separação de ambientes.
9. Criptografar e segregar backups.
10. Aprovar RPO e RTO.
11. Executar restore completo.
12. Reaplicar eliminações depois do restore.
13. Executar tabletop de incidente.
14. Atualizar playbook, métricas e ações corretivas.

## Divisão sugerida de commits e mudanças

Código deve permanecer separado de configuração operacional:

1. `observability: add request correlation ids`
2. `observability: add structured logger`
3. `security: centralize sensitive data redaction`
4. `audit: introduce typed administrative events`
5. `infra: adopt managed secrets and key rotation`
6. `infra: enforce encrypted transport and storage`
7. `resilience: define backup and restore automation`
8. `docs: record incident tabletop and remediations`

## Dados proibidos em logs

- Authorization e cookies.
- Access e refresh tokens.
- PINs, convites e reset tokens.
- Senhas e hashes quando desnecessários.
- Corpo integral de requests.
- E-mail, telefone, notas e perfil sem finalidade aprovada.
- Payload completo de usuário.

A mesma política se aplica a Sentry, Datadog, CloudWatch, Firebase, Expo, analytics, crash dumps e ferramentas futuras.

## Testes e exercícios obrigatórios

- Redaction unitária e por integração.
- Request ID preservado entre API e auditoria.
- Ausência de segredos em logs de sucesso e erro.
- Acesso a secrets individual e auditável.
- Produção não reutiliza chaves de staging.
- Restore cumpre RPO e RTO.
- Restore reaplica eliminações.
- Tabletop de token theft, cross-tenant, banco, backup, ransomware e fornecedor.
- Timeline registra detecção, confirmação, T0, contenção e comunicação.

## Definition of Done

- Logger usa allowlist e redaction central.
- Retenção distingue acesso, segurança, auditoria e observabilidade.
- Secrets, banco, volumes e backups atendem à política de criptografia.
- Restore foi executado e medido.
- Playbook possui pessoas, canal e relógio operacional.
- Ações do tabletop têm owners e prazos.
- Evidências cobrem SEC-12, RES-01, RES-02 e RES-03.

## Compatibilidade e operação

Alterar formato de logs pode afetar alertas e dashboards. Rotacionar secrets pode invalidar sessões ou integrações. Restore e rotação devem possuir runbooks, janela, rollback seguro e comunicação.

## Próxima parte

[Etapa 6 — Secure SDLC](./06-secure-sdlc.md)
