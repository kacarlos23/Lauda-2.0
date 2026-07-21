# Etapa 3 — Multi-tenant, RBAC e administração

Status atual: **controles técnicos executados em 2026-07-17; gates nominais/operacionais escalados**.

Evidência consolidada: [`../evidence/2026-07-17-etapa-3.md`](../evidence/2026-07-17-etapa-3.md).

## Resumo para leitura em voz alta

Esta etapa comprova que um tenant não acessa outro, que campos protegidos não podem ser alterados pelo cliente e que poderes globais ou de suporte são temporários, fortes e auditáveis.

## Pré-requisitos

- Sessões e identidade estáveis.
- Contrato das quatro roles revisado.
- Decisão sobre MFA e step-up.
- Decisão sobre suporte break-glass.
- Inventário inicial de `basePrisma` e bypasses globais.

## Ordem interna

1. Criar matriz de domínios e operações A contra B.
2. Adicionar testes de BOLA/IDOR para leitura e escrita.
3. Adicionar testes de mass assignment por endpoint.
4. Corrigir falhas isoladamente por domínio.
5. Inventariar e encapsular usos de `basePrisma`.
6. Consolidar o contrato RBAC no backend.
7. Testar mudança de role e overrides em tempo real.
8. Remover alvos hardcoded da promoção GLOBAL_ADMIN.
9. Exigir MFA e step-up conforme política.
10. Implementar suporte break-glass limitado e temporário.
11. Executar e agendar access review periódico.

## Estratégia por domínio

Para cada domínio, testar nesta ordem:

1. listagem e busca;
2. leitura por ID;
3. criação com IDs relacionais;
4. atualização parcial e total;
5. exclusão;
6. paginação e filtros;
7. arquivos e relatórios;
8. exportação.

Somente depois da regressão do domínio estar verde deve começar o domínio seguinte.

## Divisão sugerida de commits

1. `test: add cross-tenant harness`
2. Um commit de testes e um de correção para cada domínio.
3. `test: add property authorization matrix`
4. `security: restrict mass assignment by endpoint group`
5. `security: inventory and encapsulate base prisma bypasses`
6. `security: consolidate backend rbac contract`
7. `security: harden global admin promotion`
8. `security: require global admin mfa and step-up`
9. `security: add scoped support break-glass`
10. `docs: operationalize privilege recertification`

## Testes obrigatórios

- Sessões simultâneas dos Tenants A e B.
- Troca de IDs em path, query, body e relações.
- Troca em paginação, buscas, filtros, arquivos e exports.
- Injeção de `tenantId`, `role`, `permissions`, `ownerId`, `createdBy`, `isActive` e `deletedAt`.
- Objetos aninhados, arrays, parâmetros duplicados e casing alternativo.
- Quatro roles, permissões ALLOW/DENY e overrides.
- Role e permissão alteradas aplicadas na requisição seguinte.
- Promoção, rebaixamento e ações globais auditadas.
- Break-glass restrito a tenant/recurso e expiração automática.

## Definition of Done

- A matriz A contra B cobre todos os domínios e operações relevantes.
- Campos protegidos não podem sofrer mass assignment.
- Cada uso de `basePrisma` possui justificativa, owner e teste.
- Backend é a fonte canônica de autorização.
- Produção com dados reais exige MFA para GLOBAL_ADMIN.
- Suporte cotidiano não usa poder global irrestrito.
- Break-glass possui ticket, motivo, step-up, escopo e prazo.
- Access review inicial terminou e o próximo está agendado.
- Evidências cobrem SEC-07, SEC-07A, SEC-08, SEC-09, GOV-05 e GOV-06.

## Compatibilidade

Correções RBAC podem retirar acessos antes permitidos. Mudanças devem ser comunicadas, testadas no mobile e acompanhadas por auditoria. Exceções temporárias exigem owner e expiração.

## Próxima parte

[Etapa 4 — Lifecycle de dados e direitos](./04-lifecycle-direitos.md)
