# Politica de observabilidade e logs v1

Data: 2026-07-20  
Status: implementada no backend; aprovacao de retencao, provider, regiao, acesso e alertas produtivos pendente

## Taxonomia e allowlist

Todo registro e JSON em uma unica linha. Campos comuns: `timestamp`, `level`, `category`, `event`, `service`, `environment` e `requestId`.

| Categoria | Finalidade | Campos adicionais permitidos | Retencao proposta, ainda nao aprovada |
|---|---|---|---|
| `access` | Volume, latencia e resposta HTTP | `method`, rota parametrizada, `statusCode`, `durationMs`, `outcome` | 30 dias |
| `security` | Deteccao e contencao | `actorId`, `tenantId`, `resource`, `resourceId`, `outcome`, `errorName` | 180 dias |
| `audit` | Acoes administrativas tipadas | `actorId`, `tenantId`, `resource`, `resourceId`, `outcome` | 365 dias, sujeito a legal hold aprovado |
| `observability` | Saude de componentes e erros | `component`, `statusCode`, `durationMs`, `outcome`, `errorName` | 30 dias |

Campos fora da allowlist sao descartados antes da serializacao. `Authorization`, cookies, tokens, PINs, convites, reset codes, senhas, hashes, body, e-mail, telefone, notas, perfil e avatar sao redigidos centralmente. Mensagem bruta de excecao nao e campo permitido.

## Correlacao

O middleware aceita `X-Request-ID` somente com 1 a 64 caracteres da classe segura `[A-Za-z0-9._:-]`; valores ausentes ou invalidos sao substituidos por UUID aleatorio. O ID e devolvido na resposta, mantido em `AsyncLocalStorage`, incluido nos logs e persistido em `AdminAuditLog.requestId`.

## Auditoria administrativa

Os eventos aceitos estao enumerados em `src/audit/adminAudit.ts`. Cada tipo possui allowlist propria. `create` e `update` registram `changedFields`, nao os valores recebidos. Eventos de permissao e suporte preservam somente IDs, escopos, efeitos, ticket e expiracao necessarios a investigacao. Payload livre nao e a API padrao.

## Acesso e fornecedores

- Provider de observabilidade: **TBD**.
- Regiao e residencia: **TBD**.
- Grupos com leitura, administracao, exportacao e delecao de logs: **TBD**.
- Acesso individual, MFA, least privilege e trilha do provider: requisito bloqueante, ainda sem evidencia externa.
- Nao enviar dados a Sentry, Datadog, CloudWatch, Firebase, Expo, analytics ou crash dumps antes de o adaptador aplicar esta politica e o fornecedor ser aprovado.

## Alertas minimos a provisionar

Refresh reuse, erros 5xx, falha de SMTP, falha de Redis, alteracao privilegiada, cross-tenant bloqueado, aumento de 401/403, falha de backup/restore, backlog/latencia/retry do outbox, conexoes/reconexoes WebSocket e falhas/tickets/recibos de push. Thresholds, plantao e destino ainda dependem de provider e canal 24x7.
