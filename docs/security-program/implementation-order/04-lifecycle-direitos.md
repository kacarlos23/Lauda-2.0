# Etapa 4 — Lifecycle de dados e direitos

Status atual: **não iniciada**.

## Resumo para leitura em voz alta

Esta etapa converte retenção e direitos dos titulares em processos executáveis. Ela define quando dados são mantidos, anonimizados, eliminados, exportados ou preservados por obrigação legítima.

## Decisões obrigatórias

- Retenção por categoria e finalidade.
- Critério e autoridade para legal hold.
- Identidade necessária em solicitações de titulares.
- Escopo de exportação por titular, tenant e GLOBAL_ADMIN.
- Anonimização versus exclusão por entidade.
- Prazo e método de encerramento de tenant.
- Tratamento das cópias em backups.

## Ordem interna

1. Aprovar a matriz de retenção.
2. Definir eventos de início e fim de cada prazo.
3. Implementar limpeza de reset e convites.
4. Implementar limpeza de sessões.
5. Separar retenção de logs por categoria.
6. Criar protocolo de solicitações de titulares.
7. Implementar verificação de identidade.
8. Criar exportadores allowlist e tenant-aware.
9. Implementar correção, bloqueio e decisão de eliminação.
10. Implementar anonimização ou purge de usuário.
11. Implementar encerramento e purge de tenant.
12. Criar ledger mínimo de eliminações.
13. Reaplicar eliminações depois de restore.

## Mudanças que devem chegar juntas

- Exportação, verificação de identidade, isolamento e auditoria.
- Purge, legal hold, backup expiry e reaplicação após restore.
- Política aprovada, job correspondente e evidência de execução.

## Divisão sugerida de commits

1. `docs: approve retention and legal hold matrix`
2. `test: define privacy lifecycle regressions`
3. `privacy: purge expired auth challenges and invites`
4. `privacy: purge expired sessions`
5. `privacy: add data subject request workflow`
6. `privacy: add tenant-aware data export`
7. `privacy: anonymize or purge deleted users`
8. `privacy: close and purge terminated tenants`
9. `privacy: add deletion ledger and restore replay`

## Testes obrigatórios

- Job idempotente e seguro para reexecução.
- Dados antes do prazo são preservados.
- Dados após o prazo seguem a ação aprovada.
- Legal hold suspende apenas o descarte necessário.
- Titular A nunca exporta dados de B.
- Tenant Admin A nunca exporta dados do Tenant B.
- GLOBAL_ADMIN excepcional gera justificativa e auditoria.
- Usuário eliminado não aparece em APIs e buscas normais.
- Tenant encerrado não volta a ficar acessível.
- Restore reaplica eliminações pendentes.

## Definition of Done

- Toda categoria possui retenção, descarte e owners.
- Solicitações têm protocolo, identidade, decisão e trilha.
- Exportadores são allowlist e tenant-aware.
- Jobs são idempotentes, observáveis e reexecutáveis.
- Backups possuem política de expiração e reaplicação.
- Privacy regression está verde.
- Evidências cobrem PRV-01, PRV-03 e PRV-04.

## Compatibilidade

Purge e anonimização são destrutivos. Antes da ativação, validar contratos, obrigações legais, backups, relatórios, integrações e impactos no suporte. Rollback por restauração não pode reintroduzir dados já eliminados sem controle.

## Próxima parte

[Etapa 5 — Observabilidade, infraestrutura e resiliência](./05-observabilidade-infra-resiliencia.md)

