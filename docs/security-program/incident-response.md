# Playbook Minimo de Resposta a Incidentes v1

Versao: 1.0
Data: 2026-07-16
Status: rascunho operacional minimo; responsaveis nominais e canal 24x7 pendentes
Aprovadores: Incident Commander TBD; Juridico/Privacidade TBD; Engenharia TBD; Comunicacao TBD
Proxima revisao: 2026-08-16 ou apos primeiro tabletop

Este playbook separa resposta tecnica de decisoes juridicas. Ele nao define prazo regulatorio nem obriga comunicacao externa sem avaliacao do controlador/operador, do encarregado e do juridico.

## Papeis

| Papel | Responsabilidade | Nomeado |
|---|---|---|
| Incident Commander | Coordenar incidente, declarar severidade, manter timeline, decidir handoffs | TBD |
| Security/Engineering Lead | Triagem tecnica, contencao, evidencias, correcao e recuperacao | TBD |
| Juridico/Privacidade | Avaliar risco a titulares, T0, comunicacoes, bases contratuais/regulatorias | TBD |
| Encarregado/DPO | Canal com titulares/autoridade quando aplicavel; governanca independente | TBD |
| Comunicacao | Mensagens internas/externas aprovadas | TBD |
| Data Owner afetado | Decidir impacto operacional do dado/finalidade afetada | Conforme Data Map; maioria TBD |
| System Owner afetado | Executar correcao/restore/monitoramento | Engenharia/Infra TBD |
| Vendor Owner | Acionar fornecedor e coletar evidencias/SLA | Infra/Operacao TBD |

## Canais e registro

| Item | Definicao inicial |
|---|---|
| Canal primario | TBD; deve ser canal privado, auditavel e acessivel fora do sistema afetado. |
| Canal alternativo | TBD; telefone/lista externa para indisponibilidade. |
| Registro mestre | Ticket/incidente imutavel TBD; minimo: ID, timestamps, dono, severidade, fatos, decisoes, evidencias. |
| Cofre de evidencias | TBD; nao usar chat publico nem anexar segredos/dados pessoais sem necessidade. |
| Timezone | Registrar sempre com timezone. Padrao deste repositorio: America/Sao_Paulo. |

## T0

`T0` e o momento em que o controlador, por pessoa autorizada, toma conhecimento suficiente de um incidente de seguranca que possa envolver dados pessoais. Nesta etapa:

1. registrar fonte, horario, pessoa que declarou e fatos conhecidos;
2. separar deteccao tecnica de confirmacao de incidente;
3. se o Lauda atuar como operador, notificar o controlador sem demora injustificada e registrar o horario dessa notificacao;
4. juridico/privacidade calcula prazos externos a partir do enquadramento aplicavel.

## Fluxo minimo

1. Detectar e abrir registro mestre.
2. Classificar severidade inicial e nomear Incident Commander.
3. Conter sem destruir evidencias.
4. Preservar logs, amostras, hashes, versoes, configuracoes e cadeia de custodia.
5. Identificar fronteiras afetadas: app, API, banco, Redis, SMTP, Cloudflare, GitHub, dispositivo, fornecedor.
6. Confirmar dados, titulares, tenants, volume e periodo.
7. Declarar ou descartar `T0` com justificativa.
8. Avaliar papel do Lauda por operacao: controlador, operador ou ambos conforme ADR/ROPA.
9. Decidir comunicacoes a controlador, titulares, autoridade, fornecedores e times internos.
10. Recuperar, rotacionar segredos, revogar sessoes/tokens quando aplicavel e monitorar recorrencia.
11. Encerrar com post-mortem, controles, testes e updates em Data Map/ROPA/threat model.

## Severidade inicial

| Severidade | Criterio | Escalonamento |
|---|---|---|
| SEV-1 | Exfiltracao confirmada de dados pessoais/sensiveis, credenciais, backup, cross-tenant amplo, `GLOBAL_ADMIN` comprometido, ransomware | Incident Commander, Juridico/Privacidade, Engenharia, Comunicacao e owners imediatamente. |
| SEV-2 | Acesso indevido limitado, token/convite exposto, fornecedor com impacto provavel, logs com PII ou segredo | Security/Engineering Lead e Juridico/Privacidade no mesmo dia. |
| SEV-3 | Falha sem evidencia de acesso a dados, achado de teste, tentativa bloqueada | Engenharia/Security; acompanhar em backlog com prazo. |

## Cenarios minimos de tabletop

| Cenario | Evidencias a coletar | Contencao inicial | Owner necessario |
|---|---|---|---|
| Account takeover ou refresh token furtado | Logs de login/refresh, usuario, IP/UA se disponivel, timeline | Revogar sessoes quando Etapa 2 existir; trocar senha; invalidar tokens possiveis | Seguranca/Engenharia TBD |
| Cross-tenant/BOLA/IDOR | Request IDs, endpoint, usuario, tenants A/B, registros acessados | Desabilitar endpoint/role, hotfix tenant filter, consulta de impacto | Engenharia/Security TBD |
| `GLOBAL_ADMIN` comprometido | AdminAuditLog, alteracoes de role/permissao, origem, tenants tocados | Suspender conta, rotacionar credenciais, congelar painel global | Seguranca/Operacao TBD |
| Dump de PostgreSQL ou backup | Escopo de tabelas, horario, origem, criptografia, backup afetado | Isolar DB, rotacionar secrets, bloquear exportacoes | Infra/Seguranca TBD |
| Redis comprometido | Chaves, TTL, rede, credenciais Redis | Rotacionar credenciais, trocar HMAC key, fechar rede | Infra TBD |
| SMTP comprometido | Mensagens, destinatarios, PINs, logs do provedor | Suspender reset, trocar credenciais SMTP, invalidar desafios | Infra/Seguranca TBD |
| Logs com PII/segredos | Arquivo/provider, periodo, dados expostos, acessos | Redigir/remover logs, rotacionar segredos, reduzir verbosidade | Engenharia/Infra TBD |
| CI/CD comprometido | Workflow, runner, commit, token, secrets, artefatos | Revogar tokens, bloquear deploy, revisar commits e releases | Engenharia/Seguranca TBD |
| Fornecedor comprometido | Aviso fornecedor, subprocessadores, dados afetados, SLA | Acionar DPA/SLA, suspender integracao se necessario | Vendor Owner TBD |

## Template de registro

```text
ID:
Severidade inicial:
Detectado em:
Detectado por:
T0 declarado em:
T0 declarado por:
Operacao/ROPA afetada:
Tenants/titulares possivelmente afetados:
Dados possivelmente afetados:
Papel do Lauda:
Fornecedores envolvidos:
Contencao executada:
Evidencias preservadas:
Decisoes juridicas/privacidade:
Comunicacoes:
Recuperacao:
Risco residual:
Acoes corretivas:
Data de encerramento:
```

## Bloqueios atuais

| ID | Decisao/acao necessaria | Papel responsavel por decidir/executar | Bloqueio provocado | Etapa limite |
|---|---|---|---|---|
| IR-01 | Nomear Incident Commander, DPO/encarregado, juridico, comunicacao e substitutos. | Direcao, Security, Juridico e Operacao; nomes TBD. | Playbook nao pode ser acionado com accountability definida; bloqueia producao. | Etapa 0, antes de producao. |
| IR-02 | Definir canal primario/alternativo, registro mestre e cofre de evidencias. | Incident Commander, Security e Infra; nomes/provedores TBD. | Deteccao, coordenacao e cadeia de custodia nao sao operacionais; bloqueia producao. | Etapa 0/5, antes do tabletop e da producao. |
| IR-03 | Executar tabletop e registrar lacunas/remediacoes. | Incident Commander, Security, Juridico e Operacao; nomes TBD. | Nao ha evidencia de prontidao do processo; bloqueia encerramento do gate de incident response. | Etapa 0, antes de producao. |
| IR-04 | Implementar revogacao servidor-side de refresh tokens/sessoes. | Engenharia e Security; owners TBD. | Incidente de token depende de mitigacoes manuais. | Etapa 2, antes de producao com sessao persistente real. |
| IR-05 | Implementar request ID, logger estruturado e redaction aprovados. | Engenharia, Infra e Security; owners TBD. | Correlacao e escopo de incidentes ficam limitados; bloqueia observabilidade produtiva. | Etapa 5, antes de observabilidade produtiva. |
| IR-06 | Definir fornecedores produtivos, regioes, backup e restore. | Infra, Juridico e Security; nomes TBD. | Escalonamento de vendor e recuperacao ficam indefinidos; bloqueia producao. | Etapa 0 para decisoes; Etapa 5 para operacao/teste, antes de producao. |
