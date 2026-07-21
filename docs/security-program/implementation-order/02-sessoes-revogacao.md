# Etapa 2 — Sessões e revogação

Status atual: **não iniciada**.

## Resumo para leitura em voz alta

Esta etapa transforma refresh tokens stateless em sessões controláveis. O objetivo é permitir rotação, logout real, detecção de reutilização e revogação imediata após eventos de segurança.

## Decisão arquitetural obrigatória

Antes do código, aprovar o ADR de sessões. Ele deve definir:

- sessão por dispositivo ou por login;
- família de refresh tokens;
- política para refresh concorrente;
- logout da sessão atual e logout global;
- retenção e metadados de sessão;
- rollout e prazo do formato legado;
- comportamento web e mobile;
- estratégia para issuer, audience, `type`, `sid` e `jti`.

## Ordem interna

1. Escrever testes do contrato de token e sessão.
2. Criar tabela de sessões e famílias em migration aditiva.
3. Emitir access token com `type: access`.
4. Emitir refresh com `type: refresh`, `sid` e `jti`.
5. Validar algoritmo, issuer e audience.
6. Armazenar somente hash do refresh token.
7. Implementar rotação atômica.
8. Implementar detecção de reutilização.
9. Implementar logout atual e global.
10. Revogar sessões após reset/troca de senha.
11. Revogar por desativação ou exclusão de usuário/tenant.
12. Adaptar mobile e web.
13. Medir uso legado e removê-lo no prazo definido.

## Mudanças que devem chegar juntas

- Persistência de sessão, claims, rotação e cliente consumidor.
- Reuse detection e política de revogação da família.
- Reset de senha, desativação e revogação.
- Compatibilidade legada, telemetria e prazo de remoção.

## Divisão sugerida de commits

1. `docs: decide session and token lifecycle`
2. `test: define token purpose and session rotation`
3. `db: add sessions and refresh families`
4. `security: add token purpose issuer and audience`
5. `security: rotate refresh tokens atomically`
6. `security: detect refresh token reuse`
7. `security: add current and global logout`
8. `security: revoke sessions on credential lifecycle`
9. `mobile: adopt server-side session lifecycle`
10. `security: remove legacy refresh compatibility`

## Testes obrigatórios

- Refresh token nunca é aceito como Bearer.
- Access token nunca é aceito no refresh.
- Claims ausentes, errados ou de algoritmo inesperado falham.
- Refresh antigo falha depois da rotação.
- Reutilização revoga a família definida.
- Concorrência possui resultado determinístico.
- Logout atual não afeta sessões fora do escopo escolhido.
- Logout global revoga todas as sessões elegíveis.
- Reset e troca de senha revogam sessões.
- Usuário ou tenant inativo/excluído não consegue refresh.
- Mobile remove credenciais locais após revogação ou logout.

## Definition of Done

- Rotação e reuse detection são atômicos.
- Logout é efetivo no servidor.
- Eventos de credencial e lifecycle revogam as sessões definidas.
- Access e refresh têm purpose inequívoco.
- Compatibilidade legada possui owner e prazo, ou foi removida.
- Backend, mobile, integração e E2E relevantes estão verdes.
- Evidências estão vinculadas a SEC-02, SEC-03 e SEC-06.

## Compatibilidade

Exigir novos claims pode invalidar tokens existentes. O rollout deve escolher explicitamente entre invalidação deliberada, janela curta de compatibilidade ou expiração natural. Nenhum modo legado pode ficar sem prazo.

## Próxima parte

[Etapa 3 — Multi-tenant, RBAC e administração](./03-multitenant-rbac-administracao.md)

