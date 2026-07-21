# Registro Consolidado de Decisoes, Riscos e Pendencias v1

Versao: 1.0
Data: 2026-07-16
Status: registro tecnico; decisoes externas pendentes
Aprovadores: Engenharia TBD; Juridico/Privacidade TBD; Produto/Operacao TBD; Seguranca TBD
Proxima revisao: 2026-08-16

## Decisoes documentais tomadas nesta etapa

| ID | Decisao | Fundamento | Impacto |
|---|---|---|---|
| DEC-01 | Tratar Data Map e ROPA como baseline tecnico v1, nao como aprovacao juridica. | Muitas bases, roles e owners dependem de juridico/negocio. | Produz artefatos verificaveis sem inventar conclusoes legais. |
| DEC-02 | Classificar dados de tenant, ministerio, escala e lideranca como possivel contexto religioso ate validacao juridica. | Produto gerencia igrejas e ministerios. | Eleva criticidade de acesso, retencao e incidentes. |
| DEC-03 | Separar ADR de controlador/operador da governanca do encarregado. | Nomeacao do encarregado nao decide papeis juridicos por operacao. | Evita conclusao implicita e facilita contratos. |
| DEC-04 | Considerar acesso provavel por adolescentes como pendente e plausivel. | Convites publicos e uso por ministerios podem envolver jovens. | Bloqueia producao/distribuicao publica sem decisao de idade. |
| DEC-05 | Tratar `GLOBAL_ADMIN` como acesso excepcional de alto risco. | Bypass total em `hasPermission`, `/api/admin/*` amplo e script de promocao. | Exige MFA/step-up, break-glass, recertificacao e auditoria forte. |
| DEC-06 | Nao considerar producao com dados reais liberada por esta etapa. | Owners, incidentes, fornecedores, backup e idade seguem pendentes. | Mantem gates bloqueantes explicitos. |

## Decisoes pendentes

Os papeis abaixo sao funcoes decisoras necessarias, nao pessoas nomeadas. Onde o nome e a data acordada nao existem, o item permanece `PARCIAL/PENDENTE` mesmo quando ha uma etapa limite registrada.

| ID | Decisao necessaria | Papel responsavel por decidir | Bloqueio provocado | Etapa em que deve ser resolvida | Artefato |
|---|---|---|---|---|---|
| PEND-01 | Nomear Data Owners, System Owners, Security Owner e substitutos. | Direcao, Produto, Operacao, Engenharia e Security; nomes/grupos TBD. | Impede aprovar finalidade, acesso, retencao e risco; bloqueia dados reais. | Etapa 0, antes de producao com dados reais. | `ownership-model.md` |
| PEND-02 | Validar classificacao juridica de dados de contexto religioso. | Juridico/Privacidade e Data Owners; nomes TBD. | Impede bases, salvaguardas, retencao e avaliacao de impacto; bloqueia dados reais. | Etapa 0, antes de producao com dados reais. | `data-map.md`, `ropa.md` |
| PEND-03 | Aprovar controlador/operador por operacao. | Juridico e Negocio; nomes TBD. | Impede contratos, instrucoes, subprocessadores e matriz de comunicacao; bloqueia tenants reais. | Etapa 0, antes de contratos/onboarding. | `adr-controller-processor.md` |
| PEND-04 | Nomear encarregado/DPO, canal e substituto. | Direcao e Juridico; nomes TBD. | Impede canal de titulares e governanca operacional; bloqueia onboarding real. | Etapa 0, antes de onboarding com dados reais. | `dpo-governance.md` |
| PEND-05 | Definir idade minima, politica para adolescentes e criterio de acesso provavel. | Produto e Juridico; nomes TBD. | Impede termos, convites, suporte e controles para menores; bloqueia distribuicao publica. | Etapa 0, antes de distribuicao publica com dados reais. | `adr-age-audience.md` |
| PEND-06 | Aprovar fornecedores, regioes, subprocessadores e DPAs. | Infra, Juridico e Privacidade; nomes TBD. | Impede ativar banco/hosting, SMTP, Redis, Cloudflare/Expo quando usados e demais vendors; bloqueia producao. | Etapa 0, antes de ativar cada fornecedor produtivo. | `vendor-register.md` |
| PEND-07 | Aprovar retencoes e mecanismos de purge/anonimizacao. | Data Owners, Juridico e Engenharia; nomes TBD. | Impede lifecycle verificavel e encerramento de tenant; bloqueia dados reais. | Etapa 0 para politica; implementacao na Etapa 4, antes de producao. | `retention-matrix.md` |
| PEND-08 | Nomear Incident Commander, definir canais/cofre/registro e executar tabletop. | Security, Juridico e Operacao; nomes TBD. | Impede resposta acionavel e evidencia de prontidao; bloqueia producao. | Etapa 0, antes de producao. | `incident-response.md` |
| PEND-09 | Recertificar contas reais e acessos de app, infra e CI. | Security, Infra e Operacao; nomes TBD. | Impede comprovar menor privilegio e controlar acessos excepcionais; bloqueia painel global/suporte produtivo. | Etapa 0/3, antes de acesso a dados reais. | `access-review.md` |
| PEND-10 | Decidir armazenamento de tokens web (`localStorage` versus cookie HttpOnly/BFF). | Arquitetura, Produto e Security; nomes TBD. | Mantem risco alto de furto de token no cliente web; bloqueia web publica com dados reais ate decisao/controle. | Etapa 1/2, antes de web publica com dados reais. | `threat-model.md` |
| PEND-11 | Aprovar RPO/RTO e provisionar backup produtivo segregado, imutavel e com KMS; o restore local de 2026-07-20 nao fecha producao. | Infra, Negocio e Security; nomes TBD. | Impede recuperacao produtiva, continuidade e delecao verificavel; bloqueia producao. | Antes de producao. | `retention-matrix.md`, `backup-restore-runbook.md`, `evidence/2026-07-20-restore-drill.json` |
| PEND-12 | Revisar e aprovar tecnicamente o threat model com aprovador identificavel. | Security e Engenharia; nomes TBD. | Impede declarar o threat model tecnicamente aprovado e encerrar formalmente a Etapa 0; nao impede trabalho isolado da Etapa 1. | Etapa 0, antes de seu encerramento formal. | `threat-model.md` |
| PEND-13 | Aprovar formalmente os artefatos da Etapa 0 e acordar responsaveis nominais/datas. | Engenharia, Security, Produto/Operacao e Juridico/Privacidade; nomes TBD. | Impede declarar os gates organizacionais/juridicos/operacionais concluidos. | Etapa 0, antes de encerramento formal e de producao com dados reais. | `implementation-order/00-gates-documentais.md` |

## Riscos residuais

| ID | Risco | Severidade | Controle atual | Residual/acao |
|---|---|---|---|---|
| RISK-01 | `GLOBAL_ADMIN` comprometido ou abusado | Alta | MFA produtivo, step-up, promoção protegida, suporte scoped e audit logs | Aprovação independente, recuperação MFA, recertificação nominal e alertas/SIEM pendentes. |
| RISK-02 | Cross-tenant por rota/admin/basePrisma nao coberto | Critica | Tenant extension e repositories; testes parciais | Matriz A/B por endpoint e revisao de `basePrisma` pendentes. |
| RISK-03 | Refresh token furtado | Media/Alta | Sessao/familia persistidas, HMAC, rotacao atomica, reuse detection e logout servidor | Web em localStorage, purge e alertas/SIEM ainda pendentes. |
| RISK-04 | Dados religiosos ou de adolescentes tratados sem decisao | Alta | Marcacao documental como possivel sensivel | Parecer juridico, idade e RIPD/controles pendentes. |
| RISK-05 | Logs/audit payload com PII ou segredos | Alta | 500 mascarado em prod; senha redigida em admin audit | Logger estruturado, redaction e retencao pendentes. |
| RISK-06 | Fornecedor/backup sem regiao, DPA ou retencao | Alta/Critica | Inventario v1 | Vendor review e backup/restore pendentes. |
| RISK-07 | Convites compartilhados sem expiracao obrigatoria | Media/Alta | Codigo unico, active flag e rate limit | Expiracao/quota/auditoria pendentes. |
| RISK-08 | Avatar data URL no banco pode ampliar PII e tamanho | Media | Validacao ate 3 MB e tipo imagem | Politica de storage, retencao, remocao e malware/content review pendente. |
| RISK-09 | PDFs exportados circulam fora do controle do sistema | Media | Autorizacao antes de exportar | Watermark/auditoria/orientacao/retencao local pendentes. |
| RISK-10 | CI/CD e dependencias com permissao/pinning nao definidos | Alta | CI roda build/testes; lockfiles | Branch protection, secret scanning, dependency/SBOM policy pendentes. |

## Evidencias produzidas nesta etapa

| Evidencia | Arquivo |
|---|---|
| Data Map por operacao/finalidade e inventario Prisma | `data-map.md` |
| ROPA por operacao | `ropa.md` |
| Modelo de Data Owner/System Owner | `ownership-model.md` |
| ADR de idade/publico | `adr-age-audience.md` |
| ADR controlador/operador | `adr-controller-processor.md` |
| Governanca do encarregado | `dpo-governance.md` |
| Threat model | `threat-model.md` |
| Vendor register | `vendor-register.md` |
| Retention matrix | `retention-matrix.md` |
| Playbook de incidentes | `incident-response.md` |
| Access review inicial | `access-review.md` |
| Indice de evidencias | `evidence/README.md` |

## Regra de status

Um item com owner, prazo, fornecedor, base juridica, canal ou aprovador `TBD` nao pode ser reportado como concluido ou aprovado. Ele pode ser reportado apenas como `PARCIAL/PENDENTE` ou como pendencia bloqueante documentada. A baseline documental estar concluida nao encerra esses gates.
