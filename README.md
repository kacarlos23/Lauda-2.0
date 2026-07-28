# Lauda 2.0

[![Backend CI](https://github.com/kacarlos23/Lauda-2.0/actions/workflows/backend.yml/badge.svg)](https://github.com/kacarlos23/Lauda-2.0/actions/workflows/backend.yml)
[![Mobile CI](https://github.com/kacarlos23/Lauda-2.0/actions/workflows/mobile.yml/badge.svg)](https://github.com/kacarlos23/Lauda-2.0/actions/workflows/mobile.yml)

Plataforma SaaS multi-tenant para organizar igrejas, ministérios, membros, escalas e repertórios. O mesmo frontend funciona em Android, iOS e web por meio do Expo e React Native.

## Funcionalidades

- autenticação, recuperação de senha e cadastro por convite;
- gestão de igrejas, ministérios, membros, instrumentos e permissões;
- criação de escalas, atribuição de equipes, respostas e relatórios;
- catálogo de artistas, músicas, cifras e exportação em PDF;
- transposição, tamanho de fonte e rolagem automática de cifras;
- painel global para administração de tenants e permissões granulares;
- isolamento de dados por igreja e controles por papel e permissão.

## Stack

| Área | Tecnologias |
| --- | --- |
| API | Node.js 22, Express 5 e TypeScript |
| Dados | PostgreSQL 15, Prisma e Redis |
| Segurança | JWT, bcrypt, rate limiting e validação Zod |
| Aplicativo | Expo SDK 54, React Native 0.81 e Expo Router 6 |
| Estado e rede | Zustand e Axios |
| Testes | Jest, Supertest, Testcontainers e Playwright |

## Identidade e interface

A interface utiliza a identidade visual editorial do Lauda:

- sidebar verde-floresta no desktop e navegação inferior no celular;
- superfícies em marfim, estrutura em verde profundo e acentos terracota;
- listas e tabelas contínuas, formulários compactos e foco web visível;
- comportamento responsivo validado em desktop, laptop, tablet, celular e zoom de 200%;
- favicon, ícones PWA, adaptive icon e marca configurados no Expo.

O relatório completo do redesign e o checklist das 26 rotas estão em
[`docs/Lauda-redesign-handoff/IMPLEMENTATION-REPORT.md`](docs/Lauda-redesign-handoff/IMPLEMENTATION-REPORT.md).

O export web gera HTML por rota, metadados específicos e rewrites somente para rotas dinâmicas com UUID. Isso permite recarregar deep links sem fallback SPA e sem erro de hidratação.

## Estrutura

```text
.
├── src/                         # API e regras de negócio
├── prisma/                      # Schema e migrations
├── mobile/
│   ├── app/                     # Rotas Expo Router
│   ├── assets/brand/            # Identidade visual
│   ├── public/                  # Favicon, manifesto e ícones web
│   └── src/                     # Componentes, stores, serviços e tema
├── scripts/                     # Operação, segurança e validações
├── docs/                        # Documentação versionada
├── docker-compose.yml           # PostgreSQL e Redis locais
└── package.json                 # Scripts do backend
```

## Requisitos

- Node.js 22;
- npm;
- Docker com Docker Compose;
- navegador Chromium para os testes E2E.

## Configuração local

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/kacarlos23/Lauda-2.0.git
cd Lauda-2.0
npm ci
npm --prefix mobile ci
```

Crie o arquivo local de ambiente a partir do modelo:

```powershell
Copy-Item .env.example .env
```

Preencha o `.env` somente com valores locais. Gere segredos independentes e aleatórios com pelo menos 32 bytes para JWT, refresh token, recuperação de senha, MFA e rate limiting.

> O `.env`, chaves privadas, certificados, logs, builds e caches são ignorados pelo Git. Nunca publique credenciais, tokens, dumps de banco ou arquivos de assinatura.

Inicie PostgreSQL e Redis:

```bash
docker compose up -d
```

Prepare o banco:

```bash
npx prisma migrate dev
```

Inicie a API:

```bash
npm run dev
```

Em outro terminal, inicie o aplicativo:

```powershell
$env:EXPO_PUBLIC_API_URL = "http://127.0.0.1:3000/api"
npm --prefix mobile start
```

O Expo permite abrir o projeto na web, Android ou iOS. Também estão disponíveis:

```bash
npm --prefix mobile run web
npm --prefix mobile run android
npm --prefix mobile run ios
```

### Ambiente isolado de navegação e tokens

Para trabalhar na branch de design system sem reutilizar portas ou dados do ambiente principal:

```powershell
Copy-Item .env.navigation.example .env
# substitua apenas a senha local do exemplo
npm run dev:navigation
```

Esse comando executa um preflight fail-closed e inicia:

- frontend em `http://127.0.0.1:8090`;
- backend em `http://127.0.0.1:3010`;
- PostgreSQL em `127.0.0.1:5435`, banco `lauda2_navigation`;
- projeto Compose `lauda-navigation-dev`, sem Redis ou Cloudflare Tunnel.

Para parar os processos e preservar o volume do banco:

```powershell
npm run dev:navigation:stop
```

O volume só deve ser removido por uma ação explícita:

```powershell
docker compose -p lauda-navigation-dev down -v
```

## Variáveis e segurança

O arquivo [`.env.example`](.env.example) documenta todas as variáveis suportadas sem conter segredos reais.

Em produção:

- injete segredos por um secret manager;
- use valores diferentes entre produção, homologação e desenvolvimento;
- configure PostgreSQL, Redis e SMTP gerenciados;
- mantenha `RATE_LIMIT_FAILURE_MODE=closed`;
- ajuste `TRUST_PROXY_HOPS` para a quantidade exata de proxies confiáveis;
- use HTTPS em `EXPO_PUBLIC_API_URL` e `MEMBER_INVITE_BASE_URL`;
- execute migrations antes de iniciar a API.

`npm start` usa `NODE_ENV=production` e falha de forma segura quando configurações obrigatórias estão ausentes. Não execute `dist/server.js` diretamente para contornar essas verificações.

## Papéis e permissões

| Papel | Escopo |
| --- | --- |
| `GLOBAL_ADMIN` | Administração global de igrejas, usuários, recursos e overrides |
| `TENANT_ADMIN` | Administração integral da própria igreja |
| `MINISTRY_LEADER` | Gestão dos ministérios onde possui vínculo de liderança |
| `MEMBER` | Consulta e atualização dos próprios dados e compromissos |

O backend calcula permissões efetivas a partir do papel e de overrides individuais `ALLOW` ou `DENY`. Um `DENY` explícito prevalece sobre o baseline do papel. Recursos normais permanecem limitados ao `tenantId` autenticado.

## Rotas do aplicativo

As 26 rotas são organizadas nos seguintes grupos:

- autenticação: login, cadastro, convite e recuperação de senha;
- visão operacional: dashboard e escalas;
- pessoas: ministérios, membros, atribuições e instrumentos;
- repertório: músicas, artistas, criação, edição e leitura de cifras;
- gestão: central mobile, igreja, perfil e administração global.

URLs, parâmetros de deep link e regras de visibilidade por permissão são preservados entre web e plataformas nativas.

## Validação

Backend:

```bash
npm run build
npm test -- --runInBand
```

Mobile:

```bash
npm --prefix mobile test -- --runInBand
npx --prefix mobile tsc --noEmit
```

E2E:

```bash
npm --prefix mobile run test:e2e
```

O Playwright cria o export de produção antes dos testes, inicia o servidor estático e valida hard reload, títulos, permissões e responsividade. No GitHub Actions, relatório, traces e screenshots ficam disponíveis por 30 dias no artifact `lauda-redesign-qa-<sha>`.

Segurança:

```bash
npm run security:policy
npm run security:dependencies -- --gate
npm run security:dast:logical
```

O Security CI também executa Gitleaks sobre todo o histórico Git. Exceções de falso positivo são temporárias e limitadas por regra, arquivo, formato e, quando necessário, commit histórico em `.security/exceptions.yml` e `.gitleaks.toml`.

Build web:

```powershell
$env:EXPO_PUBLIC_API_URL = "https://api.example.com/api"
npm --prefix mobile run build:web
npm --prefix mobile run serve:web -- --listen 8081
```

O build público rejeita URLs HTTP fora de loopback, credenciais embutidas e fallback local no bundle. `serve:web` utiliza os HTMLs exportados e o arquivo `mobile/serve.json`; não adicione `--single`, pois esse fallback entrega o HTML incorreto em deep links.

Última linha de base validada:

- backend: 31 suítes e 228 testes;
- mobile: 44 suítes e 252 testes;
- E2E web: 41 cenários sobre o export estático;
- Expo web: 53 rotas estáticas;
- segurança: Gitleaks sem achados, DAST lógico 18/18 e gate de dependências sem vulnerabilidade alta/crítica de runtime ou crítica de tooling.

## Produção

Antes de publicar:

```bash
npx prisma migrate deploy
npx prisma migrate status
npm run build
```

No frontend, configure `EXPO_PUBLIC_API_URL` com o endpoint HTTPS público. Os scripts de inicialização e validação em `scripts/` conferem ambiente, migrations, API exposta e bundle servido.

Após cada deploy web, faça smoke pelo menos em `/login` e em uma rota autenticada acessada diretamente: recarregue a página, confirme que não há erro React no console e que existe um único título específico.

O programa de segurança, evidências, threat model, retenção e resposta a incidentes está em
[`docs/security-program`](docs/security-program/README.md).

## Documentação do redesign

- [Auditoria e linha de base](docs/Lauda-redesign-handoff/IMPLEMENTATION-AUDIT.md)
- [Relatório de implementação](docs/Lauda-redesign-handoff/IMPLEMENTATION-REPORT.md)
- [Relatório de QA](docs/Lauda-redesign-handoff/qa/REPORT.md)

## Git

Este é um único repositório. O aplicativo Expo fica em `mobile/` e não é submódulo.

Antes de criar commits, confirme:

```bash
git status
git diff --check
git check-ignore -v .env
```
