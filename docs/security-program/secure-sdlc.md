# Secure SDLC v1

Versão: 1.0  
Data: 2026-07-20  
Technical owner: repository maintainer (`@kacarlos23`)  
Security/System/Data Owners formais: **TBD — bloqueiam release produtivo**  
Próxima revisão: 2026-10-20 ou antes por gatilho de mudança

## Diagnóstico inicial

O projeto usa Node.js/TypeScript, Express 5, Prisma 7 e PostgreSQL no backend; Expo/React Native/Web no cliente; npm e dois lockfiles. O CI anterior compilava/testava backend e mobile e executava Playwright, mas não possuía scanning contínuo, SBOM, DAST, retenção de evidência de segurança nem política de gates. O release não tinha workflow próprio. A infraestrutura codificada limita-se ao Compose local com PostgreSQL 15 e Redis 7.4; não há Dockerfile de aplicação nem Terraform/Kubernetes/cloud IaC.

Sessões persistidas/refresh rotation, revogação, tenant context, RBAC, `GLOBAL_ADMIN`, MFA/step-up e suporte temporário estão implementados e cobertos por testes. Isso constitui estabilização técnica, não aceite operacional. Staging isolado e dataset sintético não foram encontrados.

## Pré-requisitos

| Pré-requisito | Estado | Evidência/efeito |
|---|---|---|
| Sessões estabilizadas | Técnico: atendido | `tokenService.test.ts`, `auth.test.ts`, evidência da Etapa 2. |
| Multi-tenancy estabilizado | Técnico: atendido | `privilegedAccess.test.ts`, `tenantIsolation.test.ts`, evidência da Etapa 3. |
| Staging isolado | Não atendido | ZAP fica fail-closed e não executa sem environment/allowlist. |
| Dados sintéticos DAST | Não atendido | `SYNTHETIC_DATASET_ID` deve começar por `synthetic-`; produção deve declarar `false`. |
| Owners | Parcial | CODEOWNER técnico existe; nomeações organizacionais continuam TBD. |
| Exceções | Atendido tecnicamente | `.security/exceptions.yml`, campos obrigatórios e expiração. |
| Critérios runtime/dev/infra | Atendido | Relatórios e gates separados. |

## Ferramentas, configuração e baseline

| Controle | Ferramenta/versão | Escopo | Baseline 2026-07-20 | Gate | Owner técnico |
|---|---|---|---|---|---|
| Secrets | Gitleaks 8.30.1, imagem por digest | Git completo + self-test | 1 falso positivo sintético; 0 secrets confirmados | Imediato | `@kacarlos23` |
| Dependencies | npm audit do runner | backend/mobile, runtime/tooling separados | Reteste 2026-07-21: BE runtime 3 moderate/1 low; BE tooling 7 high/4 moderate/1 low; mobile runtime 13 moderate | runtime high; tooling critical | `@kacarlos23` |
| SAST | CodeQL Action v4 por commit SHA, `security-extended` | JS/TS backend e mobile | Pendente primeira execução GitHub | Observação | `@kacarlos23` |
| IaC | KICS 2.1.20 por digest | somente `docker-compose.yml` | 0 high/critical; 2 moderate abertos; 2 info | High/critical | `@kacarlos23` |
| Containers | Grype 0.112.0 por digest | somente `postgres:15`, `redis:7.4-alpine` | Postgres local antigo: 33 critical/142 high; Redis: 0 high/critical | Observação, com critical em SLA até 2026-07-22 | `@kacarlos23` |
| SBOM | CycloneDX npm 4.2.1 | backend e mobile por lockfile | 2 gerações idênticas por componente | Bloqueia release se não reproduzir | `@kacarlos23` |
| DAST tradicional | OWASP ZAP 2.17.0 por digest | staging explicitamente allowlisted | Bloqueado sem staging sintético | Manual/observação | `@kacarlos23` |
| DAST lógico | Jest/Supertest/Testcontainers | API + PostgreSQL sintéticos | matriz A/B/global/suporte/property auth | Bloqueante | `@kacarlos23` |

Versões, digests e SHAs ficam nos workflows. Supressões só podem existir em `.gitleaks.toml` ou registro equivalente, vinculadas a `.security/exceptions.yml`.

## Severidade e SLA

| Classe | Exemplo | SLA em dias corridos |
|---|---|---|
| Secret confirmado | Token/chave utilizável | Bloqueio, revogação e rotação imediatos |
| Critical | tenant/auth bypass, exploração ativa, exposição material | 2 dias |
| High | Compromisso prático de C/I/A | 14 dias |
| Moderate runtime | Impacto/precondição limitados, alcançável em produção | 30 dias |
| Moderate dev/tooling | Restrito a build/teste, sem caminho produtivo demonstrado | 60 dias |
| Low | Defense-in-depth | 90 dias |

Um possível secret é redigido e triado sem ser copiado. Se confirmado: bloquear CI, revogar no provedor, rotacionar consumidores, revisar logs/histórico e registrar incidente/evidência sem o valor. Reescrever histórico não substitui revogação.

## Exceções

1. Abrir registro antes de suprimir, com finding, justificativa, owner, aprovador, criação, expiração, condição de revisão e controles compensatórios.
2. Security Owner aprova; o autor não aprova sozinho risco de produção.
3. Expiração máxima padrão: 90 dias. Renovação exige nova análise e nova data.
4. CI/revisão mensal acusa registro expirado; achado volta a bloquear quando aplicável.
5. Falso positivo deve ser suprimido no menor escopo possível. Aceite de risco nunca é uma exclusão ampla de regra.

## DAST lógico

O comando `npm run security:dast:logical` cria dois tenants sintéticos em PostgreSQL efêmero e exercita simultaneamente:

- path e IDs de recursos;
- query, filtros, busca e paginação;
- body e relações cross-tenant;
- exportação de músicas e relatório/PDF de escala (arquivo gerado);
- estado persistido após tentativa de mass assignment;
- acesso global exclusivamente em rotas administrativas;
- grant de suporte read-only vinculado a usuário, sessão, tenant, recurso, ticket e expiração;
- allowlists de propriedades em create/update/replay de objeto.

Não há endpoint de upload/arquivo arbitrário; a cobertura de arquivo aplicável é a autorização antes de gerar PDFs. A adição futura de upload exige novo caso A/B.

## Operação recorrente

Toda semana e a cada PR/release: detectar, triar, corrigir em lote isolado, executar testes relevantes, anexar relatórios/SBOM, revisar exceções e promover gates somente após baseline. Revisão extraordinária ocorre quando mudarem finalidade, público, fornecedor, arquitetura, classificação dos dados ou perfil de risco.

Branch protection deve exigir `Secret scanning`, `Dependency scanning`, `IaC scan`, `Logical multi-tenant harness`, Backend CI e Mobile CI. CodeQL e Grype tornam-se required somente depois da triagem inicial documentada.
