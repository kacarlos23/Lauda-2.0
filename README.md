# Lauda 2.0

[![Backend CI](https://github.com/kacarlos23/Lauda-2.0/actions/workflows/backend.yml/badge.svg)](https://github.com/kacarlos23/Lauda-2.0/actions/workflows/backend.yml)
[![Mobile CI](https://github.com/kacarlos23/Lauda-2.0/actions/workflows/mobile.yml/badge.svg)](https://github.com/kacarlos23/Lauda-2.0/actions/workflows/mobile.yml)

Lauda 2.0 is a SaaS project for managing church ministries, members, schedules, assignments, and songs. The repository contains a Node.js API, a PostgreSQL database modeled with Prisma, and an Expo/React Native mobile app.

## Stack

- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Validation: Zod
- Authentication: JWT and bcrypt
- Mobile: Expo, React Native, Expo Router, Zustand
- Local infrastructure: Docker Compose

## Project Structure

```text
.
|-- src/                 # Backend API
|-- prisma/              # Prisma schema and migrations
|-- mobile/              # Expo/React Native app
|-- docker-compose.yml   # Local PostgreSQL service
|-- package.json         # Backend scripts and dependencies
`-- README.md
```

## Requirements

- Node.js
- npm
- Docker and Docker Compose

## Environment

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/lauda2"
JWT_SECRET="change-this-secret"
REFRESH_JWT_SECRET="change-this-refresh-secret"
MEMBER_INVITE_BASE_URL="https://laudaapp.com/convite"
PORT=3000
```

The `.env` file is intentionally ignored by Git.

`MEMBER_INVITE_BASE_URL` is used by the API to build public member registration links, for example `https://laudaapp.com/convite?code=ABCD-1234`.

## Backend Setup

Install dependencies:

```bash
npm install
```

Start PostgreSQL:

```bash
docker compose up -d
```

Run Prisma migrations:

```bash
npx prisma migrate dev
```

Start the API in development mode:

```bash
npm run dev
```

Build and run the compiled API:

```bash
npm run build
npm start
```

Run automated tests:

```bash
npm test
```

The integration tests use Testcontainers and require Docker to be running.

## Roles e permissões

`GLOBAL_ADMIN` é o administrador global do sistema. Ele visualiza todas as igrejas e usa a aba Global no app. Rotas globais usam o Prisma base para não aplicar filtro pelo `tenantId` do próprio cadastro.

`TENANT_ADMIN` administra apenas a própria igreja. Ele gerencia ministérios, membros, escalas, instrumentos e convites do seu tenant. A aba Igreja/Dados da Igreja é visível apenas para esse perfil.

`MINISTRY_LEADER` administra apenas os ministérios onde possui vínculo como líder. Ele não tem permissão global e não acessa Dados da Igreja.

`MEMBER` visualiza seus dados, escalas e ministérios, e atualiza seus próprios instrumentos/cargos. Ele não gerencia outros usuários e não acessa Dados da Igreja.

Permissões operacionais são calculadas pelo backend a partir do baseline do papel e dos overrides individuais `ALLOW`/`DENY`. `DENY` prevalece sobre o baseline. Somente `GLOBAL_ADMIN` pode editar overrides pelo painel global; a mudança vale na requisição seguinte, sem exigir novo login. `permissions:manage` não é delegável.

Endpoints do contrato granular:

- `GET /api/admin/permissions`: catálogo com a propriedade `assignable`.
- `GET /api/admin/users/:userId/permissions`: retorna `baseline`, `overrides` e `effective`.
- `PUT /api/admin/users/:userId/permissions`: substitui overrides com `{ overrides: [{ permissionKey, effect }] }`.
- O formato legado `{ permissionKeys: [...] }` é aceito temporariamente como overrides `ALLOW`.

Antes de iniciar ou publicar o backend, execute `npx prisma migrate deploy` e confirme `npx prisma migrate status` sem migrations pendentes.

### Admin Global API

Todas as rotas abaixo exigem `Authorization: Bearer <token>` e role `GLOBAL_ADMIN`; outras roles recebem `403` e usuários anônimos recebem `401`.

- `GET /api/admin/tenants`: lista todas as igrejas com contagens reais de usuários, ministérios, escalas e instrumentos.
- `GET /api/admin/tenants/:tenantId`: detalha uma igreja específica, seus usuários, ministérios, instrumentos e contagens.
- `GET /api/admin/users`: lista usuários de todos os tenants sem retornar senha. Aceita `?tenantId=<uuid>`.
- `GET /api/admin/ministries`: lista ministérios globais com `tenant: { id, name }`.

Resposta de exemplo de `GET /api/admin/tenants`:

```json
{
  "success": true,
  "data": [
    {
      "id": "00000000-0000-0000-0000-000000000000",
      "name": "Igreja Central",
      "createdAt": "2026-05-27T00:00:00.000Z",
      "_count": {
        "users": 2,
        "ministries": 1,
        "schedules": 0,
        "instruments": 10
      }
    }
  ]
}
```

Para validar se os contadores são reais, faça login novamente após promover o usuário global e chame `GET /api/admin/tenants` com o token novo. Se a API retornar dados e o app mostrar zero, investigue a base URL mobile, o token persistido e a interpretação de `{ success, data }`. Token antigo pode causar `403` ou estado aparente de zero; a tela mobile agora mostra erro quando a API falha em vez de tratar falha como lista vazia.

Diagnóstico local registrado em 2026-05-27:

- Banco usado pelo backend atual: `postgresql://postgres:postgres@localhost:5434/lauda2?schema=public`.
- O banco local contém 8 igrejas e 15 usuários; o usuário global está com `role = "GLOBAL_ADMIN"`.
- `GET http://localhost:3000/api/admin/tenants` retornou `404` porque o processo nessa porta era uma instância antiga do backend, iniciada antes das rotas administrativas atuais.
- Subindo o backend atual em `PORT=3001`, `GET /api/admin/tenants` retornou `{ "success": true, "data": [...] }` com igrejas e contagens reais, incluindo usuários maiores que zero.
- Causa raiz local dos contadores zerados/indisponíveis: app/backend apontando para uma instância antiga na porta 3000. Reinicie o backend usado pelo app ou ajuste `EXPO_PUBLIC_API_URL` para a instância atual.

Diagnóstico local registrado em 2026-06-01:

- A porta `3000` ainda possuía um processo escutando; o backend atual desta branch foi iniciado em `PORT=3001` para isolar o teste.
- Foi criado um usuário temporário pelo fluxo normal de registro, promovido localmente para `GLOBAL_ADMIN` e logado novamente para emitir um JWT novo. O payload do JWT continha `role = "GLOBAL_ADMIN"`.
- Chamada manual: `GET http://localhost:3001/api/admin/tenants`, base URL `http://localhost:3001/api`, com `Authorization: Bearer <token>` enviado.
- Resultado: HTTP `200`, body `{ "success": true, "data": [...] }`, com igrejas reais do banco local e contagens `_count.users`, `_count.ministries`, `_count.schedules` e `_count.instruments`.
- Causa raiz confirmada neste ambiente: o backend e o banco estão retornando dados reais; o erro do Painel Global ocorre quando o mobile aponta para uma instância/baseURL incorreta ou usa sessão/token antigo sem `GLOBAL_ADMIN`.
- Para comparar banco e API, rode `npm run debug:admin-tenants` e depois chame `GET /api/admin/tenants` com um token `GLOBAL_ADMIN` novo.

Os endpoints normais (`/api/members`, `/api/ministries`, `/api/schedules`, `/api/instruments`) continuam tenant-scoped por padrão para preservar o isolamento multi-tenant.

### Dados da Igreja API

Todas as rotas abaixo exigem `Authorization: Bearer <token>` e role `TENANT_ADMIN`. `GLOBAL_ADMIN`, `MINISTRY_LEADER`, `MEMBER` e anônimos não acessam esse fluxo inicial.

- `GET /api/church/me`: retorna a igreja do usuário autenticado e contagens reais do tenant.
- `PATCH /api/church/me`: atualiza dados básicos da própria igreja. Payload inicial: `{ "name": "Novo nome" }`.
- `GET /api/church/overview`: retorna membros, ministérios, instrumentos e escalas do próprio tenant, sem senha.

Resposta de exemplo de `GET /api/church/me`:

```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "00000000-0000-0000-0000-000000000000",
      "name": "Igreja Central",
      "createdAt": "2026-05-27T00:00:00.000Z",
      "updatedAt": "2026-05-27T00:00:00.000Z"
    },
    "_count": {
      "users": 10,
      "ministries": 3,
      "schedules": 5,
      "instruments": 8
    }
  }
}
```

A área Dados da Igreja no mobile centraliza a gestão do tenant: permite editar o nome da igreja e navegar para os CRUDs existentes de membros, ministérios, escalas e instrumentos/cargos. Todas as queries usam o `tenantId` do token, nunca um `tenantId` arbitrário do body.

### Promover usuário para administrador global

O usuário de referência para administração global é `kacarlos2016@proton.me`.

Para promover esse usuário sem expor senha:

```bash
npm run promote:global-admin
```

O script procura o usuário pelo e-mail e altera apenas a role para `GLOBAL_ADMIN`. Ele não cria usuário, não altera `password` e não contém senha em plaintext. Se o usuário não existir, crie-o pelo fluxo normal do produto e rode o script novamente em ambiente controlado.

Depois da promoção, faça logout/login para receber um JWT novo com `role: "GLOBAL_ADMIN"`. Não use token antigo e não commite senhas reais.

Para validar o painel global:

1. Rode `npm run promote:global-admin`.
2. Faça logout/login com o usuário promovido.
3. Abra a aba Global no app.
4. Confira os contadores de igrejas, usuários, ministérios e escalas.
5. Se os valores estiverem zerados, verifique a resposta de `GET /api/admin/tenants` e confirme se o token enviado é do usuário promovido.
6. Rode `npm run debug:admin-tenants` para confirmar que o backend está conectado ao banco esperado. O script apenas lê totais e não imprime senhas.

### Mobile Admin

- A aba Global é visível apenas para `GLOBAL_ADMIN`.
- A aba Igreja/Dados da Igreja é visível apenas para `TENANT_ADMIN`.
- `EXPO_PUBLIC_API_URL` pode apontar para a raiz do backend ou para `/api`; o app normaliza a URL para evitar chamadas duplicadas como `/api/api`.

## Schedule API

All schedule endpoints require `Authorization: Bearer <token>` and are scoped by the authenticated user's `tenantId`.

### Endpoints

`GET /api/schedules`

Lists schedules from the authenticated tenant only.

`POST /api/schedules`

Creates a schedule.

```json
{
  "title": "Culto de domingo",
  "date": "2026-05-24T13:00:00.000Z",
  "ministryId": "00000000-0000-0000-0000-000000000000"
}
```

`POST /api/schedules/:id/assignments`

Adds a member to a schedule.

```json
{
  "userId": "00000000-0000-0000-0000-000000000000",
  "role": "Vocal",
  "status": "PENDING"
}
```

`PATCH /api/schedules/:id/assignments/:assignmentId/status`

Accepts, declines, or resets an assignment status.

```json
{
  "status": "ACCEPTED"
}
```

Allowed statuses: `PENDING`, `ACCEPTED`, `DECLINED`.

`DELETE /api/schedules/:id/assignments/:assignmentId`

Removes an assignment from a schedule.

`GET /api/schedules/me`

Lists only assignments and schedules for the authenticated user, including schedule, ministry, role, and status.

### Permission Rules

- `GLOBAL_ADMIN` and `TENANT_ADMIN` can create schedules and manage assignments for any ministry in their own tenant.
- `MINISTRY_LEADER` can create schedules and manage assignments only for ministries where the user has a `MinistryMember` record with `isLeader = true`.
- `MEMBER` cannot create schedules or manage assignments.
- A member can update only their own schedule assignment status.
- Cross-tenant access returns `404` for missing tenant-owned resources or `403` for forbidden actions.

### Recommended Flow

1. Admin creates a ministry with `POST /api/ministries`.
2. Admin adds members to the tenant and ministries.
3. Admin or ministry leader creates a schedule with `POST /api/schedules`.
4. Admin or ministry leader adds assignments with `POST /api/schedules/:id/assignments`.
5. Member accepts or declines with `PATCH /api/schedules/:id/assignments/:assignmentId/status`.
6. Member views upcoming schedules with `GET /api/schedules/me`.

## Ministry Member Toggle API

Stack audit for this feature: the project is not Django/DRF + React web. It is Node.js/Express with Prisma/PostgreSQL and an Expo/React Native mobile app, so the requested flow was adapted to the existing backend and mobile frontend.

`POST /api/ministries/:id/toggle-member`

Payload:

```json
{
  "member_id": "00000000-0000-0000-0000-000000000000"
}
```

The API follows the existing response envelope (`{ "success": true, "data": ... }`). The `data` payload when linking is:

```json
{
  "status": "linked",
  "member_id": "00000000-0000-0000-0000-000000000000",
  "ministry_id": "11111111-1111-1111-1111-111111111111"
}
```

The `data` payload when unlinking is:

```json
{
  "status": "unlinked",
  "member_id": "00000000-0000-0000-0000-000000000000",
  "ministry_id": "11111111-1111-1111-1111-111111111111"
}
```

Permission: only church admins (`TENANT_ADMIN` or `GLOBAL_ADMIN`) can use this endpoint. Anonymous requests receive `401`; authenticated non-admin users receive `403`.

Multi-tenant rules:

- The ministry must belong to the authenticated tenant.
- The member must belong to the authenticated tenant.
- Cross-tenant ministry or member IDs return `404` where appropriate.
- `MinistryMember` keeps one membership per user/ministry pair and preserves metadata such as `isLeader`.

Mobile flow:

1. Admin opens a ministry detail screen.
2. The "Adicionar membros" section lists all tenant members.
3. Admin taps once to link or unlink a member.
4. The UI updates optimistically while the request runs.
5. On API failure, the previous state is restored and an error message is shown.

## Instrumentos/Cargos dos membros

Stack audit for this feature: the implementation uses the real project stack, Node.js/Express/TypeScript, Prisma/PostgreSQL, and Expo/React Native. No Django, DRF, React web, or Material UI code was introduced.

Members can keep their own instruments/cargos updated in the profile. Church admins and ministry leaders can see instrument badges in the member list, which helps identify skills for future schedule assignment flows.

### Backend

Prisma models:

- `Instrument`: tenant-scoped catalog item with `name`, optional `colorHex`, and `@@unique([tenantId, name])`.
- `UserInstrument`: join model between `User` and `Instrument`, also carrying `tenantId`; each user/instrument pair is unique.
- `User.instruments`, `Tenant.instruments`, and `Tenant.userInstruments` expose the relations.

Endpoints:

- `GET /api/instruments`: authenticated users list instruments from their own tenant.
- `POST /api/instruments`: `TENANT_ADMIN` or `GLOBAL_ADMIN` creates a tenant instrument.
- `PATCH /api/instruments/:id`: `TENANT_ADMIN` or `GLOBAL_ADMIN` updates name/color for a tenant instrument.
- `DELETE /api/instruments/:id`: `TENANT_ADMIN` or `GLOBAL_ADMIN` deletes a tenant instrument. Existing user links are removed by cascade.
- `PATCH /api/members/:id/instruments`: replaces the member instrument list and returns complete instruments.

Permissions and isolation:

- Any authenticated user can list available instruments for their tenant.
- A user can update only their own instruments.
- `TENANT_ADMIN` and `GLOBAL_ADMIN` can update instruments for members in their own tenant.
- `MEMBER` and `MINISTRY_LEADER` cannot update another member's instruments by default.
- Instrument IDs from another tenant are rejected.
- Member list/detail responses expose `instruments: [{ id, name, colorHex }]`, not raw Prisma join rows.

### Mobile

- `mobile/src/services/instrumentService.ts` wraps `GET /instruments` and `PATCH /members/:id/instruments`.
- `mobile/app/(tabs)/members/index.tsx` renders instrument badges and a fallback when no instrument is informed.
- `mobile/app/(tabs)/profile.tsx` lets the signed-in user toggle multiple instruments/cargos with optimistic UI and rollback on error.
- `authStore` persists updated `user.instruments` in `auth_user`, so session restore keeps the local profile consistent.

### Mobile - Catálogo de instrumentos/cargos

Admin users can manage the tenant instrument catalog in `mobile/app/(tabs)/instruments/index.tsx`. The route is hidden from the tab bar and is opened from the Profile button "Gerenciar instrumentos/cargos", visible only to `TENANT_ADMIN` and `GLOBAL_ADMIN`.

Audit for the admin catalog:

- Available endpoints: `GET /api/instruments`, `POST /api/instruments`, `PATCH /api/instruments/:id`, and `DELETE /api/instruments/:id`.
- Backend permissions: all authenticated users can list instruments; only `TENANT_ADMIN` and `GLOBAL_ADMIN` can create, update, or delete.
- Mobile route: `/(tabs)/instruments/index`, navigated as `/instruments`.
- Mobile service/store: `mobile/src/services/instrumentService.ts` exposes catalog CRUD and member instrument updates; `mobile/src/store/instrumentStore.ts` keeps the screen from calling the API directly.
- Delete behavior: deleting an instrument removes existing member links by cascade and the mobile UI confirms this before sending the request.

Manual test flow:

1. Sign in as a church admin.
2. Open Profile and tap "Gerenciar instrumentos/cargos".
3. Create an instrument with a name of at least two characters and an optional `#RRGGBB` color.
4. Edit the instrument name and color.
5. Delete the instrument and confirm that the item is removed.
6. Sign in as a `MEMBER` or `MINISTRY_LEADER` and confirm the management button is not shown and direct access redirects to Profile.
7. Confirm Profile still lets users edit their own instruments, the Members list still shows badges, and schedule flows still open normally.

### Validation

GitHub Actions runs backend and mobile validation on pull requests and pushes to `main`.

Backend:

```bash
npm test
npm run build
```

Mobile:

```bash
cd mobile
npm test
npx tsc --noEmit
npm run test:e2e
```

Backend integration tests use Testcontainers with PostgreSQL, so Docker must be available locally and in CI. Mobile E2E tests use Playwright; the CI job installs browsers before running `npm run test:e2e`, and Playwright starts Expo web through the configured `webServer`.

Recommended next step: use instruments to sort or filter members in schedule assignment dropdowns, for example placing members with the matching instrument/cargo at the top while still allowing any member to be selected.

## Priorizacao de membros em escalas por instrumento

O app mobile possui um utilitário reutilizável para ordenar membros durante a escolha de assignments de escala:

- `mobile/src/utils/memberInstrumentPriority.ts` compara a função/cargo digitada com os instrumentos do membro.
- Membros compatíveis aparecem no topo, mas todos continuam selecionáveis.
- A lista continua ordenada por nome dentro dos grupos compatíveis e não compatíveis.
- Exemplos: "Teclado" prioriza membros com instrumento Teclado; "Baterista" prioriza membros com Bateria.
- O componente `mobile/src/components/MemberPickerWithInstrumentPriority.tsx` renderiza membros nessa ordem, mostra badges de instrumentos e destaca membros compatíveis.

Não foi criado endpoint novo para isso. O fluxo usa `GET /api/members`, que já retorna `instruments`; se performance virar problema no futuro, uma extensão possível seria `GET /api/members?instrument=Teclado`.

A tela mobile atual de escalas lista as escalas do usuário e permite aceitar/recusar convites. Ela ainda não possui uma tela visual de líder/admin para criar assignments, então a integração visual completa deve ser feita quando essa tela de gestão de escala existir.

## Catálogo de músicas e cifras

Usuários autenticados podem consultar músicas e exportar cifras. `GLOBAL_ADMIN`, `TENANT_ADMIN` e
`MINISTRY_LEADER` também podem criar artistas, cadastrar músicas e editar cifras; `MEMBER` possui
acesso somente de leitura e exportação. Artistas, músicas e PDFs são sempre isolados pelo tenant.

- `GET/POST /api/artists` e `GET/PATCH /api/artists/:id` gerenciam artistas.
- `GET/POST /api/songs` e `GET/PATCH /api/songs/:id` gerenciam músicas e cifras.
- `POST /api/songs/export` recebe de 1 a 50 IDs e devolve `application/pdf`.
- A aba Músicas oferece busca, criação guiada, editor monoespaçado e exportação individual/conjunta.
- A tela Artistas permite editar nome e URL HTTP/HTTPS opcional da imagem; exclusão e fusão não são suportadas.

### Importação assistida do Cifra Club

O formulário de música permite buscar uma cifra no Cifra Club, selecionar o resultado correto, revisar uma prévia e preencher automaticamente tom original, link da cifra e conteúdo. A importação é assistida: o backend não cria nem edita a música sozinho.

Rotas:

- `GET /api/songs/cifra-club/search?artist=...&title=...`
- `POST /api/songs/cifra-club/import` com `{ "url": "https://www.cifraclub.com.br/..." }`

As rotas exigem autenticação e permissão de edição de músicas (`GLOBAL_ADMIN`, `TENANT_ADMIN` ou `MINISTRY_LEADER`). O importador usa Playwright no backend para tentar o botão "Baixar cifra"; se o download falhar ou a página/contexto fechar durante a tentativa, o erro é tratado e o serviço tenta o fallback do conteúdo público da página. Esse comportamento evita que uma falha externa derrube o servidor Node.

Testes relacionados:

```bash
npm test -- --runInBand src\__tests__\unit\cifraClubImportService.test.ts
npm test -- --runInBand src\__tests__\integration\music.test.ts
```

### Consistência da lista de músicas no mobile

O estado mobile de músicas preserva a lista já carregada após criar ou editar uma música. Quando uma música nova é salva, ela é mesclada na lista local; quando uma música é editada, apenas o item correspondente é substituído. Requisições antigas de listagem que retornam depois de uma criação/edição são ignoradas para evitar que dados antigos apaguem a lista atual.

Testes relacionados:

```bash
cd mobile
npm test -- --runInBand --runTestsByPath src/store/musicStore.test.ts src/services/musicService.test.ts
```

O conteúdo da cifra usa preferencialmente ChordPro (`[G]Grande é o [D]Senhor`) e aceita cifras antigas com
acordes sobre a letra. O limite é de 100 mil caracteres. Espaços e quebras de linha são preservados.
Uma igreja não pode cadastrar duas músicas com o mesmo título normalizado para o mesmo artista.

Na leitura da música, `chordsheetjs` transforma o conteúdo em linhas renderizáveis e `tonal` transpõe os
acordes localmente. O Zustand mantém, durante a sessão, o tom escolhido por música, tamanho da fonte e
velocidade de rolagem. A rolagem automática usa Shared Values do Reanimated e considera o BPM opcional
(30–300) e o multiplicador escolhido pelo usuário. A transposição de leitura não altera o conteúdo salvo.

## Mobile Setup

Install mobile dependencies:

```bash
cd mobile
npm install
```

Start Expo:

```bash
npm start
```

Run on a target platform:

```bash
npm run android
npm run ios
npm run web
```

## Git Notes

This repository is configured as a single Git project from the root. The mobile app is included as a regular folder, not as a nested repository or submodule.

Ignored files include local environment variables, dependencies, build output, Expo cache, generated native folders, logs, and local editor/system files.
