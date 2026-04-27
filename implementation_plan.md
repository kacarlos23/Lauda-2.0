# Plano de Implementação: App de Gerenciamento de Ministérios (Node.js)

Este plano detalha os passos técnicos exatos para construir o MVP com a arquitetura de Node.js + Prisma validada.

## User Review Required

> [!IMPORTANT]
> A estrutura do banco de dados (Schema Prisma) foi criada e está disponível na seção abaixo. Por favor, valide os modelos, os relacionamentos e os níveis de acesso (Enums) antes de iniciarmos a geração do código.

## Proposed Changes

### Backend (Node.js + TypeScript + Express + Prisma)

#### 1. Setup Inicial e Camadas
- Inicializar projeto Node.js com TypeScript.
- Configurar pastas seguindo a arquitetura estrita: `src/routes`, `src/controllers`, `src/services`, `src/repositories`, `src/middlewares`, `src/validators`.
- Instalar dependências core: Express, Prisma, Zod, jsonwebtoken, bcryptjs.

#### 2. Modelagem de Dados (Estrutura do Banco de Dados Completa)
Criar o arquivo principal `prisma/schema.prisma` com a seguinte estrutura:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  GLOBAL_ADMIN
  TENANT_ADMIN
  MINISTRY_LEADER
  MEMBER
}

enum AssignmentStatus {
  PENDING
  ACCEPTED
  DECLINED
}

model Tenant {
  id        String   @id @default(uuid())
  name      String
  domain    String?  @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users      User[]
  ministries Ministry[]
  schedules  Schedule[]
  songs      Song[]
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  name      String
  phone     String?
  role      Role     @default(MEMBER)
  
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  ministries MinistryMember[]
  schedules  ScheduleAssignment[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId])
}

model Ministry {
  id          String   @id @default(uuid())
  name        String
  description String?
  
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  members     MinistryMember[]
  schedules   Schedule[]
  songs       MinistrySong[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([tenantId])
}

model MinistryMember {
  id         String   @id @default(uuid())
  
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  ministryId String
  ministry   Ministry @relation(fields: [ministryId], references: [id], onDelete: Cascade)

  tenantId   String
  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  isLeader   Boolean  @default(false)
  createdAt  DateTime @default(now())

  @@unique([userId, ministryId])
  @@index([ministryId])
  @@index([tenantId])
}

model Schedule {
  id          String   @id @default(uuid())
  title       String
  date        DateTime
  
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  ministryId  String
  ministry    Ministry @relation(fields: [ministryId], references: [id], onDelete: Cascade)

  assignments ScheduleAssignment[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([tenantId])
  @@index([ministryId])
}

model ScheduleAssignment {
  id         String   @id @default(uuid())
  
  scheduleId String
  schedule   Schedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  tenantId   String
  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  role       String   // ex: "Guitarrista", "Bateria", "Recepção"
  status     AssignmentStatus @default(PENDING)
  createdAt  DateTime @default(now())

  @@unique([scheduleId, userId])
  @@index([tenantId])
}

model Song {
  id        String   @id @default(uuid())
  title     String
  artist    String?
  bpm       Int?
  
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  ministries MinistrySong[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId])
}

model MinistrySong {
  id         String   @id @default(uuid())
  
  songId     String
  song       Song     @relation(fields: [songId], references: [id], onDelete: Cascade)
  
  ministryId String
  ministry   Ministry @relation(fields: [ministryId], references: [id], onDelete: Cascade)

  tenantId   String
  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([songId, ministryId])
  @@index([tenantId])
}
```

#### 3. Isolamento Multi-Tenant (Segurança Backend)
- Implementar Middleware de Autenticação para validar o JWT e disponibilizar `req.user` (contendo `id`, `role` e `tenantId`).
- Implementar **Prisma Client Extensions** (`prisma.$extends`) para injetar automaticamente a cláusula `{ where: { tenantId } }` em todas as queries. Isso mitiga falhas humanas nos Repositories e garante isolamento absoluto.

#### 4. API Core e Validadores
- Criar schemas de validação Zod para todas as requisições (`UserSchema`, `MinistrySchema`).
- Implementar `AuthController`: login e registro (com geração do tenant, emissão de Access Token e Refresh Token).
- Implementar endpoints para gerenciar Membros, Ministérios e Escalas.

---

### Frontend (React Native + Expo)

#### 1. Setup Inicial
- Inicializar projeto Expo com Expo Router (`app/`).
- Instalar dependências: `axios`, `zustand`, `expo-secure-store`.

#### 2. Estado Global e Comunicação
- Criar o *store* do Zustand (`store/authStore.ts`) para gerenciar o estado da sessão (Access Token, Refresh Token) e as permissões do usuário.
- Configurar interceptors do Axios para anexar o Access Token automaticamente, e lidar com erros 401 realizando a renovação silenciosa da sessão usando o Refresh Token no SecureStore.

#### 3. Telas Iniciais (Views)
- **Autenticação:** Tela de Login.
- **Navegação Principal:** Layout de abas tabulares responsivas à role do usuário.
- **Telas Dinâmicas:** 
  - Diretório de Membros (Visualização vs Edição).
  - Gestão e Visualização de Escalas.

## Verification Plan

### Testes Automatizados
- Executar `npx prisma migrate dev` para assegurar que a criação do banco de dados não gere erros no schema.
- Criar testes de integração verificando se requisições sem o token JWT ou requisitando dados de um *Tenant* diferente são bloqueadas (Erro 403 Forbidden).
