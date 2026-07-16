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
| SEC-18 Classificacao de erros | `src/__tests__/unit/authMiddleware.test.ts`; `src/middlewares/errorHandler.ts` | Request ID/logger estruturado ainda pendente. |
| TEN-01 Tenant isolation | `src/__tests__/unit/tenantIsolation.test.ts`; suites `admin`, `members`, `schedules` | Matriz A/B completa por endpoint pendente. |
| RBAC-01 Permissoes granulares | `src/__tests__/unit/granularPermissions.test.ts`; `src/__tests__/integration/admin.test.ts` | Recertificacao de contas reais pendente. |
| CI-01 Build/test | `.github/workflows/backend.yml`; `.github/workflows/mobile.yml` | Branch protection, secret scanning e artifact retention pendentes. |

## Verificacoes de 2026-07-16 existentes no historico documental

- backend: `npm test -- --runInBand` - historico anterior indicava 18 suites e 146 testes aprovados;
- backend: `npm run build` - historico anterior indicava aprovado;
- Prisma: `npx prisma validate` - historico anterior indicava aprovado;
- mobile: `npm test -- --runInBand` - historico anterior indicava 43 suites e 234 testes aprovados;
- mobile: `npx tsc --noEmit` - historico anterior indicava aprovado.

Essas verificacoes nao foram reexecutadas por esta edicao documental, salvo se registrado em resposta final do executor.
