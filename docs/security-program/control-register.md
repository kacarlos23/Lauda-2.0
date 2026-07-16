# Registro de Controles

Versao: 1.0
Data: 2026-07-16
Status: controles documentais e tecnicos iniciais
Aprovadores: Engenharia TBD; Seguranca TBD; Produto/Operacao TBD; Juridico/Privacidade TBD
Proxima revisao: 2026-08-16

Os estados tecnicos abaixo descrevem o working tree inspecionado em 2026-07-16. Eles nao afirmam que o codigo correspondente integra os commits documentais da Etapa 0 nem substituem revisao/teste do commit de codigo que vier a versiona-los.

| Controle | Estado | Owner | Implementacao/procedimento | Evidencia | Proxima acao |
|---|---|---|---|---|---|
| PRV-01 Data Map | Baseline tecnico v1 | Data Owners TBD; System Owner Engenharia TBD | Inventario por operacao, entidades Prisma, clientes, scripts, fornecedores e infra conhecida | `data-map.md` | Validar owners, bases, retencoes e classificacao religiosa. |
| PRV-02 ROPA | Baseline tecnico v1 | Juridico/Data Owners TBD | Registro de operacoes por finalidade com papel controlador/operador a validar | `ropa.md` | Aprovar bases e papeis por operacao. |
| GOV-01 Ownership | Modelo criado; nomeacao pendente | Direcao/Operacao/Engenharia TBD | Modelo Data Owner/System Owner/Security Owner | `ownership-model.md` | Nomear pessoas/grupos e substitutos. |
| PRV-06 Publico etario | Criterio documentado; decisao pendente | Produto/Juridico TBD | ADR de idade e acesso provavel | `adr-age-audience.md` | Definir idade minima e politica para adolescentes. |
| PRV-07 Controlador/operador | Matriz tecnica; decisao pendente | Juridico/Negocio TBD | ADR separado por operacao | `adr-controller-processor.md` | Aprovar contratos/instrucoes/subprocessadores. |
| PRV-08 Encarregado | Modelo criado; nomeacao pendente | Direcao/Juridico TBD | Governanca do encarregado separada de controlador/operador | `dpo-governance.md` | Nomear DPO/canal/substituto. |
| THR-01 Threat model | Baseline tecnico v1 | Security/Engenharia TBD | Trust boundaries, ameacas, controles e testes | `threat-model.md` | Revisao humana e backlog de controles. |
| VR-01 Vendor register | Inventario tecnico v1 | Infra/Juridico TBD | Registro de fornecedores, regioes e subprocessadores pendentes | `vendor-register.md` | Due diligence e DPAs antes de producao. |
| RET-01 Retencao | Matriz inicial; prazos pendentes | Data Owners/Juridico TBD | Categorias, retencao atual/proposta e purge pendente | `retention-matrix.md` | Aprovar prazos e implementar jobs/purge. |
| RES-03 Incidentes | Playbook minimo; papeis pendentes | Incident Commander/Juridico TBD | T0, severidades, papeis, fluxo e tabletop minimo | `incident-response.md` | Nomear papeis, canal 24x7 e executar tabletop. |
| GOV-05 Access review | Revisao repo/config v1; recertificacao pendente | Security/Operacao TBD | Matriz de roles, scripts, acessos excepcionais e infra | `access-review.md` | Inventariar contas reais e recertificar. |
| SEC-11 Reset seguro | Parcial | System Owner Engenharia TBD; Data Owner Seguranca TBD | CSPRNG, HMAC-SHA-256, pepper versionado, tentativas, expiracao, consumo atomico e SMTP opcional | `passwordReset.test.ts`, `auth.test.ts` | Revogar sessoes na Etapa 2 e aprovar owner. |
| SEC-04 Rate limiting | Implementado no app; operacao pendente | Engenharia/Infra TBD | IP/identificador em chaves HMAC; Redis obrigatorio em producao; failure mode configuravel | `rateLimitMiddleware.test.ts`, `unifiedConfig.test.ts` | Provisionar Redis, TLS, auth, monitoramento. |
| SEC-03 Lifecycle auth | Implementado para auth | Engenharia TBD | Elegibilidade cobre `isActive`, `deletedAt` e tenant em login/refresh/Bearer/me | `authMiddleware.test.ts`, `auth.test.ts` | Aplicar a jobs/scripts e procedimentos admin. |
| SEC-18 Erros/logs | Parcial | Engenharia/Infra TBD | 500 mascarado em prod; senha redigida em audit payload admin | `errorHandler.ts`, testes auth | Logger estruturado, request ID, redaction e retencao. |
| SEC-15 Dependencias | Pendente/triado | Engenharia TBD | Lockfiles e CI existentes | `package-lock.json`, workflows | SBOM, dependency review, audit policy sem `--force`. |

Nenhum item com owner, aprovador, fornecedor, prazo ou evidencia operacional `TBD` deve ser reportado como concluido.
