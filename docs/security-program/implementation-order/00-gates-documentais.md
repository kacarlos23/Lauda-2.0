# Etapa 0 - Gates documentais

Versao: 1.0
Data: 2026-07-16
Status atual: **baseline documental concluida; Etapa 0 nao encerrada por gates organizacionais, juridicos e operacionais pendentes**.
Aprovadores: Engenharia TBD; Juridico/Privacidade TBD; Produto/Operacao TBD; Seguranca TBD
Proxima revisao: 2026-08-16

## Resumo

Esta etapa define quem decide, quem executa e quais riscos permanecem pendentes antes de mudancas estruturais posteriores. A execucao de 2026-07-16 concluiu a baseline documental v1, mas nao concluiu a Etapa 0 nem representa aprovacao juridica, operacional, de seguranca ou de Data Owners.

## Ordem interna e status

| Item | Status | Evidencia |
|---|---|---|
| 1. Completar Data Map por operacao/finalidade | Produzido v1 | `../data-map.md` |
| 2. Nomear ou registrar Data Owners/System Owners | Modelo produzido; nomeacao pendente | `../ownership-model.md` |
| 3. Classificar dados e tratamentos, incluindo contexto religioso | Classificacao inicial produzida; validacao juridica pendente | `../data-map.md`, `../ropa.md` |
| 4. Registrar controlador/operador por operacao | Matriz tecnica produzida; decisao juridica pendente | `../adr-controller-processor.md`, `../ropa.md` |
| 5. Tratar encarregado separadamente | Modelo produzido; DPO/canal pendentes | `../dpo-governance.md` |
| 6. Documentar publico etario e acesso provavel | ADR tecnico produzido; decisao Produto/Juridico pendente | `../adr-age-audience.md` |
| 7. Produzir threat model inicial | Baseline tecnico produzido | `../threat-model.md` |
| 8. Inventariar fornecedores/regioes/subprocessadores | Inventario produzido; regioes/subprocessadores pendentes | `../vendor-register.md` |
| 9. Criar matriz inicial de retencao | Produzida; prazos aprovados pendentes | `../retention-matrix.md` |
| 10. Criar playbook minimo de incidentes | Produzido; papeis/canal/tabletop pendentes | `../incident-response.md` |
| 11. Executar primeira revisao de privilegios | Revisao repo/config produzida; recertificacao nominal pendente | `../access-review.md` |

## Entregas

- [Data Map v1](../data-map.md)
- [ROPA v1](../ropa.md)
- [Modelo de Data Owner e System Owner](../ownership-model.md)
- [ADR de publico etario](../adr-age-audience.md)
- [ADR de controlador e operador](../adr-controller-processor.md)
- [Governanca do encarregado](../dpo-governance.md)
- [Threat model v1](../threat-model.md)
- [Vendor register v1](../vendor-register.md)
- [Matriz de retencao v1](../retention-matrix.md)
- [Playbook de incidentes v1](../incident-response.md)
- [Access review v1](../access-review.md)
- [Registro consolidado de decisoes/riscos/pendencias](../decisions.md)
- [Indice de evidencias](../evidence/README.md)

## Gates ainda pendentes

| Decisao necessaria | Papel responsavel por decidir | Bloqueio provocado | Etapa limite |
|---|---|---|---|
| Nomear Data Owners/System Owners e substitutos. | Direcao, Produto, Operacao e Engenharia; pessoas/grupos TBD. | Impede aprovacao de finalidade, acesso, retencao e risco residual; bloqueia dados reais. | Etapa 0, antes de producao com dados reais. |
| Validar classificacao juridica do contexto religioso. | Juridico/Privacidade e Data Owners; nomes TBD. | Impede bases, salvaguardas, retencao e avaliacao de impacto; bloqueia dados reais. | Etapa 0, antes de producao com dados reais. |
| Definir publico etario e acesso provavel por adolescentes. | Produto e Juridico; nomes TBD. | Impede termos, onboarding, convites e controles para menores; bloqueia distribuicao publica com dados reais. | Etapa 0, antes de distribuicao publica. |
| Aprovar controlador/operador por operacao. | Juridico e Negocio; nomes TBD. | Impede contratos, instrucoes, subprocessadores e fluxo de incidentes; bloqueia tenants reais. | Etapa 0, antes de contratos/onboarding. |
| Definir encarregado, canal e substituto. | Direcao e Juridico; nomes TBD. | Impede canal de titulares e governanca operacional; bloqueia onboarding real. | Etapa 0, antes de onboarding com dados reais. |
| Aprovar fornecedores, regioes, subprocessadores e DPAs. | Infra, Juridico e Privacidade; nomes TBD. | Impede ativacao segura de banco, SMTP, Redis, hosting e demais vendors; bloqueia producao. | Etapa 0, antes de ativar cada fornecedor produtivo. |
| Definir backup/restore, RPO/RTO e retencao. | Infra, Negocio e Security; nomes TBD. | Impede recuperacao e eliminacao verificavel; bloqueia producao. | Etapa 0/5, obrigatoriamente antes de producao. |
| Nomear Incident Commander, definir canais e executar tabletop. | Security, Juridico e Operacao; nomes TBD. | Impede resposta acionavel e evidencia de prontidao; bloqueia producao. | Etapa 0, antes de producao. |
| Recertificar `GLOBAL_ADMIN`, suporte, servico e infra. | Security, Infra e Operacao; nomes TBD. | Impede demonstrar menor privilegio e controle de acesso excepcional; bloqueia painel global/suporte com dados reais. | Etapa 0/3, antes de acesso produtivo. |

## Divisao sugerida de commits

1. `docs: add data map and ownership model`
2. `docs: add privacy and age-related decisions`
3. `docs: add threat model and vendor register`
4. `docs: add retention and incident response drafts`
5. `docs: add access review and evidence register`

## Definition of Done - status objetivo

| Criterio | Status | Justificativa |
|---|---|---|
| Todas as entidades Prisma e integracoes conhecidas inventariadas | ATENDIDO DOCUMENTALMENTE | Cobertura registrada em `data-map.md` e `vendor-register.md`; configuracoes externas nao fornecidas continuam sujeitas a revisao. |
| Cada tratamento possui Data Owner e System Owner ou pendencia formal com responsavel | PARCIAL/PENDENTE | Papeis necessarios e gates foram registrados, mas owners nominais/grupos aprovados ainda sao `TBD`. |
| Lacunas juridicas/operacionais possuem responsavel e prazo | PARCIAL/PENDENTE | Papeis decisores e etapas limite foram registrados; responsaveis nominais e datas acordadas ainda sao `TBD`. |
| Publico etario e acesso provavel possuem criterio formal de revisao | PARCIAL/PENDENTE | Criterio existe; decisao de Produto/Juridico e aprovacao real permanecem pendentes. |
| Ameacas prioritarias ligadas a controles/testes | PARCIAL/PENDENTE | Ligacoes documentais existem; revisao/aprovacao tecnica nominal e parte dos testes/controles planejados permanecem pendentes. |
| Playbook possui papeis, canal, escalonamento e T0 | PARCIAL/PENDENTE | Estrutura, severidade e T0 existem; nomes, canais operacionais e tabletop permanecem pendentes. |
| Documentos possuem versao, aprovadores e proxima revisao | PARCIAL/PENDENTE | Versao e revisao existem; os aprovadores nominais e as aprovacoes reais permanecem `TBD`. |
| Evidencias ligadas aos controles | ATENDIDO DOCUMENTALMENTE | O indice liga documentos, codigo e testes conhecidos; evidencias operacionais continuam pendentes e nao concluem os respectivos controles. |

## Inicio da Etapa 1

Nao foi identificado bloqueio tecnico de repositorio para iniciar ou continuar a Etapa 1 em desenvolvimento/teste isolado. Isso nao autoriza deploy, onboarding, suporte ou tratamento de dados reais; qualquer item da Etapa 1 que dependa de owner, fornecedor, risco aceito ou decisao juridica deve aguardar o gate correspondente acima.
