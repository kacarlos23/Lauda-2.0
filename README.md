# Lauda 2.0

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
MEMBER_INVITE_BASE_URL="lauda://member-register"
PORT=3000
```

The `.env` file is intentionally ignored by Git.

`MEMBER_INVITE_BASE_URL` is used by the API to build public member registration links, for example `lauda://member-register?code=...`.

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

### Validation

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

Recommended next step: use instruments to sort or filter members in schedule assignment dropdowns, for example placing members with the matching instrument/cargo at the top while still allowing any member to be selected.

## Priorizacao de membros em escalas por instrumento

O app mobile possui um utilitario reutilizavel para ordenar membros durante a escolha de assignments de escala:

- `mobile/src/utils/memberInstrumentPriority.ts` compara a funcao/cargo digitada com os instrumentos do membro.
- Membros compativeis aparecem no topo, mas todos continuam selecionaveis.
- A lista continua ordenada por nome dentro dos grupos compativeis e nao compativeis.
- Exemplos: "Teclado" prioriza membros com instrumento Teclado; "Baterista" prioriza membros com Bateria.
- O componente `mobile/src/components/MemberPickerWithInstrumentPriority.tsx` renderiza membros nessa ordem, mostra badges de instrumentos e destaca membros compativeis.

Nao foi criado endpoint novo para isso. O fluxo usa `GET /api/members`, que ja retorna `instruments`; se performance virar problema no futuro, uma extensao possivel seria `GET /api/members?instrument=Teclado`.

A tela mobile atual de escalas lista as escalas do usuario e permite aceitar/recusar convites. Ela ainda nao possui uma tela visual de lider/admin para criar assignments, entao a integracao visual completa deve ser feita quando essa tela de gestao de escala existir.

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
