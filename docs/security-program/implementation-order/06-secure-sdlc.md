# Etapa 6 — Secure SDLC

Status em 2026-07-20: **baseline técnico implantado; conclusão operacional bloqueada**.

O pipeline agora executa continuamente o ciclo `detectar → triar → corrigir → testar → evidenciar → revisar`. Secret scanning, dependency scanning separado, IaC high/critical e regressões lógicas multi-tenant já possuem gates. SAST e containers entram em observação até a primeira execução remota ser triada. DAST tradicional somente pode ser disparado contra staging allowlisted, isolado e sintético.

Não é correto encerrar a etapa neste momento: staging/dados sintéticos não foram provisionados, os owners organizacionais continuam sem nomeação formal e não existe laudo de pentest independente nem reteste.

## Artefatos executáveis

- política e SLAs: [Secure SDLC](../secure-sdlc.md);
- exceções temporárias: [`.security/exceptions.yml`](../../../.security/exceptions.yml);
- findings triados: [`.security/findings.yml`](../../../.security/findings.yml);
- CI: [Security CI](../../../.github/workflows/security.yml);
- DAST tradicional: [Traditional DAST](../../../.github/workflows/dast.yml);
- SBOM por release: [Release security evidence](../../../.github/workflows/release-security.yml);
- pentest/reteste: [Registro de pentest](../pentest-stage6.md);
- evidência inicial: [Etapa 6](../evidence/2026-07-20-etapa-6.md).

## Gates atuais

| Controle | Estado | Regra |
|---|---|---|
| Secret confirmado/novo | Bloqueante | Qualquer finding não allowlisted bloqueia; o próprio CI prova o comportamento com sentinel sintético. |
| Dependência runtime | Bloqueante gradual | High/critical bloqueia; moderate existente tem SLA e backlog. |
| Dependência dev/tooling | Bloqueante gradual | Critical bloqueia; highs históricos permanecem explícitos e com SLA. |
| DAST lógico | Bloqueante | Falha de A/B, `GLOBAL_ADMIN`, suporte ou property authorization falha o job. |
| CodeQL | Observação | Baseline somente existe após upload do primeiro SARIF no GitHub. |
| KICS | Bloqueante gradual | High/critical bloqueia após baseline local triado; 2 moderate possuem backlog. |
| Grype | Observação | Primeiro relatório remoto precisa ser triado antes de elevar o gate. |
| ZAP | Manual/observação | Exige environment protegido, confirmação, host allowlisted e dataset sintético. |

## Condições para conclusão

1. Nomear e aprovar System Owner, Security Owner, Data Owners e substitutos.
2. Provisionar `staging-security` isolado e registrar dataset `synthetic-*` sem dados produtivos.
3. Executar e triar CodeQL, KICS, Grype e ZAP; atualizar `.security/findings.yml`.
4. Contratar executor independente, executar o escopo de `pentest-stage6.md` somente após o aceite formal da estabilização de sessões/multi-tenancy.
5. Corrigir achados em lotes isolados, executar reteste independente e anexar laudos sem dados sensíveis.

## Retorno ao índice

[Ordem de implementação](./README.md)
