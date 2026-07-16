# Etapa 1 — Contenção técnica

Status atual: **implementada no codigo e bloqueada operacionalmente**.

## Resumo para leitura em voz alta

Esta etapa reduz os riscos imediatos de tomada de conta e acesso indevido. Ela protege recuperação de senha, endpoints públicos, usuários excluídos e tenants inativos antes de introduzir sessões persistentes.

## Pré-requisitos

- Secrets independentes disponíveis por ambiente.
- Decisão operacional sobre Redis e comportamento em indisponibilidade.
- Provedor SMTP e tratamento de seus dados aprovados antes da produção.
- Migration e rollback revisados.

## Ordem interna

1. Adicionar testes de reset e ausência de dados sensíveis em logs.
2. Aplicar migration aditiva do reset seguro.
3. Introduzir CSPRNG, challenge e HMAC com pepper.
4. Limitar tentativas, expiração e consumo atômico.
5. Remover logs de PIN e configurar entrega segura.
6. Implantar a infraestrutura comum de rate limiting.
7. Proteger login e refresh.
8. Proteger forgot-password e reset-password.
9. Proteger registro e convites.
10. Aplicar elegibilidade canônica de usuário e tenant.
11. Separar erros JWT de falhas de banco e permissões.

## Mudanças que devem chegar juntas

- HMAC do reset, pepper, tentativas, expiração, consumo único e remoção de logs.
- Elegibilidade em login, refresh, Bearer e contexto do tenant.
- Configuração de Redis, trust proxy e limites por endpoint no ambiente de produção.

## Divisão sugerida de commits

1. `test: define password reset security regressions`
2. `db: add password reset challenge fields`
3. `security: harden password reset lifecycle`
4. `security: add rate limit infrastructure`
5. `security: rate limit authentication endpoints`
6. `security: rate limit registration and invite endpoints`
7. `security: enforce canonical auth eligibility`
8. `fix: preserve infrastructure authentication errors`

## Testes obrigatórios

- PIN criptograficamente aleatório e sempre com seis dígitos.
- Dump do banco insuficiente para validar o PIN sem o pepper.
- PIN expirado, consumido ou bloqueado por tentativas falha.
- Duas requisições concorrentes não consomem o mesmo desafio.
- PIN, senha, token e e-mail desnecessário não aparecem em logs.
- Resposta de forgot-password não enumera contas.
- Login desconhecido e senha incorreta retornam resposta equivalente.
- Limites por IP e identificador funcionam separadamente.
- Chaves do limiter não contêm e-mail, telefone, token ou convite em claro.
- Respostas bloqueadas incluem `429` e `Retry-After`.
- Usuário ou tenant inativo/excluído falha em login, refresh e Bearer.
- Falha de banco não vira incorretamente `401`.

## Definition of Done

- Nenhum PIN é armazenado ou registrado em claro.
- SHA-256 isolado do PIN não é usado.
- Pepper e chave do limiter são independentes e ficam fora do banco.
- Redis é usado quando houver múltiplas instâncias ou produção.
- Trust proxy corresponde à topologia real.
- Lifecycle é consistente em todos os fluxos de autenticação.
- Backend, integration tests e testes de logs estão verdes.
- Evidências estão anexadas a SEC-11, SEC-04, SEC-03 e SEC-18.

## Compatibilidade

- A migration invalida desafios de reset antigos.
- Novas variáveis obrigatórias podem causar fail-fast em produção.
- Usuários e tenants anteriormente aceitos podem perder acesso imediatamente.
- Revogação após troca de senha permanece dependente da Etapa 2.

## Evidencia desta execucao

O diagnostico, a associacao com SEC-11, SEC-04, SEC-03 e SEC-18, os comandos
executados, os resultados e os bloqueios operacionais estao registrados em
[`../evidence/2026-07-16-etapa-1.md`](../evidence/2026-07-16-etapa-1.md).

A estrategia de deploy e rollback esta em
[`../../../prisma/migrations/20260716120000_harden_password_reset/README.md`](../../../prisma/migrations/20260716120000_harden_password_reset/README.md).

## Pendências atuais antes de encerrar a etapa

- Provisionar e comprovar Redis em produção.
- Aprovar e comprovar SMTP.
- Provisionar secrets independentes no secret manager por ambiente.
- Confirmar `trust proxy` na topologia produtiva final.
- Testar backup e rollback em staging.
- Definir Data Owner do fluxo de reset.
- Implementar revogação de sessões após reset na Etapa 2.

## Próxima parte

[Etapa 2 — Sessões e revogação](./02-sessoes-revogacao.md)
