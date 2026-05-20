# Lauda 2.0

Lauda 2.0 é um SaaS multi-tenant para igrejas gerenciarem ministérios, membros, escalas, assignments e repertório. O repositório contém uma API Node.js/Express com Prisma/PostgreSQL e um app mobile Expo/React Native.

## Stack

- Backend: Node.js, Express, TypeScript, Zod
- Database: PostgreSQL
- ORM: Prisma
- Authentication: JWT, refresh token e bcrypt
- Mobile: Expo, React Native, Expo Router, Zustand

## Setup

```bash
npm install
docker compose up -d
npx prisma migrate dev
npm run dev
```

Mobile:

```bash
cd mobile
npm install
npm start
```

## Autenticação

Todo usuário pertence a uma igreja, representada por `tenant`. Os fluxos de autenticação retornam o tenant atual no formato:

```json
{
  "tenant": {
    "id": "tenant-uuid",
    "name": "Comunidade Vida Nova"
  }
}
```

### Criar igreja e administrador

`POST /api/auth/register`

```json
{
  "churchName": "Comunidade Vida Nova",
  "name": "Ana Admin",
  "email": "ana@example.com",
  "password": "secret123"
}
```

Resposta:

```json
{
  "success": true,
  "data": {
    "token": "jwt",
    "accessToken": "jwt",
    "refreshToken": "refresh-jwt",
    "user": {
      "id": "user-uuid",
      "name": "Ana Admin",
      "email": "ana@example.com",
      "role": "TENANT_ADMIN",
      "tenantId": "tenant-uuid"
    },
    "tenant": {
      "id": "tenant-uuid",
      "name": "Comunidade Vida Nova"
    }
  }
}
```

### Login

`POST /api/auth/login`

```json
{
  "email": "ana@example.com",
  "password": "secret123"
}
```

Retorna tokens, `user` e `tenant`.

### Refresh

`POST /api/auth/refresh`

```json
{
  "refreshToken": "refresh-jwt"
}
```

Retorna novos tokens, `user` e `tenant`.

### Cadastro por convite

`POST /api/auth/member-register`

```json
{
  "inviteCode": "código-do-convite",
  "name": "Carlos Membro",
  "email": "carlos@example.com",
  "phone": "11999999999",
  "password": "secret123"
}
```

O usuário entra na igreja associada ao convite. A resposta também retorna `tenant.id` e `tenant.name`, para o app mostrar claramente a igreja atual.

## Permissões

- `GLOBAL_ADMIN`: administrador global. Pode gerenciar dados do tenant presente no token.
- `TENANT_ADMIN`: administrador da igreja. Pode gerenciar ministérios, membros e escalas da própria igreja.
- `MINISTRY_LEADER`: líder de ministério. Pode gerenciar membros/escalas apenas nos ministérios em que possui `MinistryMember.isLeader = true`.
- `MEMBER`: membro comum. Pode ver seus próprios dados e aceitar ou recusar suas próprias escalas.

## Regras Multi-Tenant

- Todo usuário possui `tenantId`.
- Todo ministério, escala, assignment, música e vínculo possui `tenantId`.
- Queries de dados protegidos filtram pelo `tenantId` do token.
- Um usuário de uma igreja não pode listar, criar, alterar ou remover dados de outra igreja.
- Para schedules, o ministério informado também precisa pertencer ao mesmo tenant.

## Ministérios

### Criar ministério

`POST /api/ministries`

Permissão: `TENANT_ADMIN` ou `GLOBAL_ADMIN`.

```json
{
  "name": "Louvor",
  "description": "Equipe de música"
}
```

### Adicionar membro ao ministério

`POST /api/ministries/:id/members`

Permissão: administrador da igreja ou líder do próprio ministério.

```json
{
  "userId": "user-uuid",
  "isLeader": true
}
```

Use `isLeader: true` para definir a pessoa como líder daquele ministério.

## Escalas

### Criar escala

`POST /api/schedules`

Permissão: `GLOBAL_ADMIN`, `TENANT_ADMIN` ou `MINISTRY_LEADER` do ministério informado.

```json
{
  "title": "Culto de domingo",
  "date": "2026-05-24T13:00:00.000Z",
  "ministryId": "ministry-uuid"
}
```

Regras:

- `ministryId` precisa pertencer ao tenant autenticado.
- `MINISTRY_LEADER` só cria escala no ministério em que é líder.
- `MEMBER` recebe 403.

### Adicionar assignment

`POST /api/schedules/:id/assignments`

Permissão: administrador ou líder do ministério da escala.

```json
{
  "userId": "member-user-uuid",
  "role": "Vocal"
}
```

Resposta:

```json
{
  "success": true,
  "data": {
    "id": "assignment-uuid",
    "scheduleId": "schedule-uuid",
    "userId": "member-user-uuid",
    "role": "Vocal",
    "status": "PENDING",
    "tenantId": "tenant-uuid"
  }
}
```

Regras:

- A escala e o membro precisam pertencer ao tenant autenticado.
- Não é permitido duplicar o mesmo `userId` na mesma escala.
- O status inicial é `PENDING`.

### Aceitar ou recusar escala

`PATCH /api/schedules/:id/assignments/:assignmentId/status`

Permissão: apenas o próprio membro do assignment.

```json
{
  "status": "ACCEPTED"
}
```

Status permitidos: `PENDING`, `ACCEPTED`, `DECLINED`.

### Remover assignment

`DELETE /api/schedules/:id/assignments/:assignmentId`

Permissão: administrador ou líder do ministério da escala.

Sempre valida tenant, escala e se o assignment pertence à escala informada.

### Minhas escalas

`GET /api/schedules/me`

Retorna apenas assignments do usuário autenticado:

```json
{
  "success": true,
  "data": [
    {
      "assignmentId": "assignment-uuid",
      "status": "PENDING",
      "role": "Vocal",
      "schedule": {
        "id": "schedule-uuid",
        "title": "Culto de domingo",
        "date": "2026-05-24T13:00:00.000Z",
        "ministryId": "ministry-uuid",
        "ministry": {
          "id": "ministry-uuid",
          "name": "Louvor"
        }
      }
    }
  ]
}
```

## Mobile

O app salva o `tenant` no estado global de autenticação. A Home e o Perfil exibem `Igreja atual: Nome da Igreja`. O cadastro por convite mostra a igreja retornada pelo backend ao concluir o fluxo. Papéis técnicos são exibidos com labels amigáveis:

- `GLOBAL_ADMIN`: Administrador global
- `TENANT_ADMIN`: Administrador da igreja
- `MINISTRY_LEADER`: Líder de ministério
- `MEMBER`: Membro

## Verificação

```bash
npm test
npm run build
```

Mobile:

```bash
cd mobile
npm run test:e2e
npx tsc --noEmit
```
