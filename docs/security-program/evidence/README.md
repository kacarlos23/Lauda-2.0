# Indice de Evidencias

Versao: 1.0
Data: 2026-07-16
Status: evidencias documentais e tecnicas iniciais; evidencias operacionais pendentes
Aprovadores: Engenharia TBD; Seguranca TBD; Juridico/Privacidade TBD
Proxima revisao: 2026-08-16

Nao anexar tokens, PINs, dumps, senhas, chaves, dados pessoais reais, capturas com titulares, logs sensiveis ou credenciais de fornecedor.

## Evidencias documentais da Etapa 0

| Gate | Evidencia | Status |
|---|---|---|
| Data Map | `docs/security-program/data-map.md` | Produzido v1; owners/base/retencao TBD. |
| ROPA | `docs/security-program/ropa.md` | Produzido v1; controlador/operador/base juridica TBD. |
| Ownership | `docs/security-program/ownership-model.md` | Modelo produzido; nomeacao nominal pendente. |
| Publico etario | `docs/security-program/adr-age-audience.md` | Criterio formal produzido; decisao Produto/Juridico pendente. |
| Controlador/operador | `docs/security-program/adr-controller-processor.md` | Matriz tecnica produzida; aprovacao juridica pendente. |
| Encarregado | `docs/security-program/dpo-governance.md` | Modelo produzido; DPO/canal pendentes. |
| Threat model | `docs/security-program/threat-model.md` | Baseline tecnico produzido; aprovacao organizacional pendente. |
| Fornecedores | `docs/security-program/vendor-register.md` | Inventario produzido; regioes/subprocessadores pendentes. |
| Retencao | `docs/security-program/retention-matrix.md` | Matriz inicial produzida; prazos juridicos pendentes. |
| Incidentes | `docs/security-program/incident-response.md` | Playbook minimo produzido; papeis/canal/tabletop pendentes. |
| Access review | `docs/security-program/access-review.md` | Revisao repo/config produzida; recertificacao nominal pendente. |
| Decisoes/riscos | `docs/security-program/decisions.md` | Registro consolidado produzido. |

## Evidencias de codigo/testes ja identificadas

Estas evidencias foram observadas no working tree e no historico disponivel. Alteracoes de codigo preexistentes nao fazem parte dos commits documentais da Etapa 0; arquivos ainda nao versionados nao devem ser tratados como evidencia de um commit implantavel.

| Controle | Evidencia automatizada | Evidencia operacional |
|---|---|---|
| SEC-11 Reset seguro | `src/__tests__/unit/passwordReset.test.ts`; casos de reset em `src/__tests__/integration/auth.test.ts` | Provedor SMTP, rotacao do pepper e alerta ainda pendentes. |
| SEC-04 Rate limiting | `src/__tests__/unit/rateLimitMiddleware.test.ts`; `src/__tests__/unit/unifiedConfig.test.ts` | Redis/TLS/monitoramento ainda pendentes. |
| SEC-03 Lifecycle auth | `src/__tests__/unit/authMiddleware.test.ts`; casos de lifecycle em `src/__tests__/integration/auth.test.ts` | Procedimento administrativo de desativacao ainda pendente. |
| SEC-02 Sessoes/tokens | `src/__tests__/unit/tokenService.test.ts`; contratos, rotacao, reuse e concorrencia em `src/__tests__/integration/auth.test.ts` | Purge, dashboard e alerta de reuse ainda pendentes. |
| SEC-06 Revogacao | Logout/reset/troca/lifecycle em `src/__tests__/integration/auth.test.ts`; limpeza cliente em `mobile/src/store/authStore.test.ts` | SIEM e validacao operacional ainda pendentes. |
| SEC-12/SEC-18 Observabilidade segura | `redaction.test.ts`, `observability.test.ts`, `errorHandler.test.ts` | Provider, acesso, alertas e retencao produtivos pendentes. |
| RES-01/RES-02 Backup e restore | `scripts/resilience/backup-restore-drill.cjs`; `2026-07-20-restore-drill.json` | Cloud/KMS/imutabilidade e replay de eliminacoes pendentes. |
| TEN-01 Tenant isolation | `src/__tests__/unit/tenantIsolation.test.ts`; suites `admin`, `members`, `schedules` | Matriz A/B completa por endpoint pendente. |
| RBAC-01 Permissoes granulares | `src/__tests__/unit/granularPermissions.test.ts`; `src/__tests__/integration/admin.test.ts` | Recertificacao de contas reais pendente. |
| CI-01 Build/test | `.github/workflows/backend.yml`; `.github/workflows/mobile.yml` | Branch protection, secret scanning e artifact retention pendentes. |

Registro detalhado da Etapa 1: [`2026-07-16-etapa-1.md`](./2026-07-16-etapa-1.md).

Registro detalhado da Etapa 2: [`2026-07-16-etapa-2.md`](./2026-07-16-etapa-2.md).

Registro detalhado da Etapa 3: [`2026-07-17-etapa-3.md`](./2026-07-17-etapa-3.md).

Registro detalhado da Etapa 5: [`2026-07-20-etapa-5.md`](./2026-07-20-etapa-5.md). Resultado bruto sem dados pessoais: [`2026-07-20-restore-drill.json`](./2026-07-20-restore-drill.json).

Registro detalhado da Etapa 6: [`2026-07-20-etapa-6.md`](./2026-07-20-etapa-6.md). Inclui resultados locais, hashes dos SBOMs e separa explicitamente evidência executada de configuração pendente em CI/staging/pentest.

## Verificacoes de 2026-07-16 existentes no historico documental

- backend: `npm test -- --runInBand` - historico anterior indicava 18 suites e 146 testes aprovados;
- backend: `npm run build` - historico anterior indicava aprovado;
- Prisma: `npx prisma validate` - historico anterior indicava aprovado;
- mobile: `npm test -- --runInBand` - historico anterior indicava 43 suites e 234 testes aprovados;
- mobile: `npx tsc --noEmit` - historico anterior indicava aprovado.

Essas verificacoes nao foram reexecutadas por esta edicao documental, salvo se registrado em resposta final do executor.
