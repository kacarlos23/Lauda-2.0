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
