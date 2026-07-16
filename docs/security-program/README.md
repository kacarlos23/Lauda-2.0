# Programa de Seguranca, Privacidade e Protecao de Dados

Versao do indice: 1.0
Data: 2026-07-16
Status geral: baseline documental da Etapa 0 concluida; Etapa 0 nao encerrada por gates organizacionais, juridicos e operacionais pendentes
Aprovadores: Engenharia TBD; Juridico/Privacidade TBD; Produto/Operacao TBD; Seguranca TBD
Proxima revisao: 2026-08-16

Este diretorio contem os artefatos verificaveis do programa. Um controle so pode ser marcado como concluido quando tiver owner, decisao, procedimento ou implementacao, evidencia, teste/revisao e risco residual registrados.

## Estado em 2026-07-16

| Etapa | Estado | Evidencia atual |
|---|---|---|
| 0 - Gates documentais | Baseline documental concluida; gates externos pendentes; producao com dados reais bloqueada | Data Map, ROPA, ownership, ADRs, governanca do encarregado, threat model, vendor register, retencao, incident response, access review e registro consolidado. Owners, fornecedores, incident commander, DPO, idade, bases legais e aprovacoes permanecem `TBD`. |
| 1 - Contencao tecnica | Parcialmente implementada no working tree; fora destes commits documentais | Reset com HMAC/pepper, rate limiting, lifecycle e erros foram observados no working tree; revogacao de sessoes depende da Etapa 2. O codigo nao integra os commits da Etapa 0. |
| 2 - Sessoes | Nao iniciada | Requer ADR/modelo de sessao, rotacao e revogacao. |
| 3 - Multi-tenant/RBAC/admin | Nao iniciada | Requer matriz A/B, mass assignment e hardening de admin global. |
| 4 - Lifecycle/direitos | Nao iniciada | Requer retencoes aprovadas, purge e owners. |
| 5 - Observabilidade/infra/resiliencia | Nao iniciada | Requer fornecedores, logs, backup/restore, RPO/RTO. |
| 6 - Secure SDLC | Nao iniciada | Requer politica CI/CD, dependencias, secrets e branch protection. |

## Artefatos da Etapa 0

| Entrega | Arquivo |
|---|---|
| Data Map v1 | [data-map.md](./data-map.md) |
| ROPA/registro de operacoes v1 | [ropa.md](./ropa.md) |
| Modelo de Data Owner e System Owner | [ownership-model.md](./ownership-model.md) |
| ADR sobre publico etario e acesso provavel | [adr-age-audience.md](./adr-age-audience.md) |
| ADR sobre controlador e operador | [adr-controller-processor.md](./adr-controller-processor.md) |
| Governanca separada do encarregado | [dpo-governance.md](./dpo-governance.md) |
| Threat model v1 | [threat-model.md](./threat-model.md) |
| Vendor register v1 | [vendor-register.md](./vendor-register.md) |
| Politica/matriz inicial de retencao | [retention-matrix.md](./retention-matrix.md) |
| Playbook minimo de resposta a incidentes | [incident-response.md](./incident-response.md) |
| Access review inicial | [access-review.md](./access-review.md) |
| Registro consolidado de decisoes, riscos e pendencias | [decisions.md](./decisions.md) |
| Indice de evidencias | [evidence/README.md](./evidence/README.md) |
| Registro de controles | [control-register.md](./control-register.md) |

## Regras

- `TBD` significa pendencia nao concluida.
- Aprovacao tecnica desta documentacao nao substitui aprovacao juridica, operacional ou de Data Owner.
- Mudancas de schema, logs, telemetria, fornecedor, exportacao, auth, RBAC ou publico etario devem atualizar Data Map, ROPA e threat model.
- Evidencia de codigo sem teste/revisao nao conclui controle.
- Producao com dados reais permanece bloqueada enquanto ownership, incident response, fornecedores relevantes e decisao etaria estiverem pendentes.

## Status detalhado da Etapa 0

Veja [Etapa 0 - Gates documentais](./implementation-order/00-gates-documentais.md). Os roadmaps das Etapas 1 a 6 nao fazem parte dos commits de encerramento documental desta Etapa 0.
