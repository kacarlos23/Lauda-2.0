import { execFileSync } from "node:child_process";
import path from "node:path";
import type express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { DEFAULT_INSTRUMENTS } from "../../constants/defaultInstruments";
import type { prisma as PrismaClientInstance } from "../../config/prisma";

let app: express.Express;
let prisma: typeof PrismaClientInstance;
let container: StartedTestContainer;

function migrate(databaseUrl: string): void {
  const prismaCli = path.resolve("node_modules", "prisma", "build", "index.js");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    env: {
      PATH: process.env.PATH,
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: databaseUrl,
    },
    stdio: "inherit",
  });
}

async function cleanDatabase(): Promise<void> {
  await prisma.scheduleAssignment.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.ministryMember.deleteMany();
  await prisma.ministrySong.deleteMany();
  await prisma.song.deleteMany();
  await prisma.ministry.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

async function registerTenant(seed: string): Promise<void> {
  await request(app)
    .post("/api/auth/register")
    .send({
      churchName: `Igreja ${seed}`,
      name: `Admin ${seed}`,
      email: `admin-${seed}@example.com`,
      password: "secret123",
    })
    .expect(201);
}

beforeAll(async () => {
  container = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({
      POSTGRES_DB: "lauda_auth_test",
      POSTGRES_USER: "test",
      POSTGRES_PASSWORD: "test",
    })
    .withExposedPorts(5432)
    .start();

  const databaseUrl = `postgresql://test:test@${container.getHost()}:${container.getMappedPort(5432)}/lauda_auth_test`;
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET = "test_access_secret";
  process.env.REFRESH_JWT_SECRET = "test_refresh_secret";
  process.env.JWT_EXPIRES_IN = "15m";
  process.env.REFRESH_JWT_EXPIRES_IN = "7d";
  process.env.NODE_ENV = "test";

  migrate(databaseUrl);

  const appModule = await import("../../app");
  const prismaModule = await import("../../config/prisma");
  app = appModule.default;
  prisma = prismaModule.prisma;
}, 60000);

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  if (prisma) {
    await cleanDatabase();
    await prisma.$disconnect();
  }
  if (container) {
    await container.stop();
  }
});

describe("Auth API", () => {
  it("POST /api/auth/login returns tokens and authenticated user for valid credentials", async () => {
    await registerTenant("auth-valid");

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "admin-auth-valid@example.com",
        password: "secret123",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toEqual(expect.any(String));
    expect(response.body.data.user.role).toBe("TENANT_ADMIN");
    expect(response.body.data.user.tenantId).toEqual(expect.any(String));
  });

  it("POST /api/auth/register pre-cadastra os instrumentos padrão da igreja", async () => {
    await registerTenant("auth-default-instruments");

    const instruments = await prisma.instrument.findMany({
      select: { name: true, colorHex: true },
      orderBy: { name: "asc" },
    });

    expect(instruments).toHaveLength(DEFAULT_INSTRUMENTS.length);
    expect(instruments.map((instrument) => instrument.name).sort()).toEqual(
      DEFAULT_INSTRUMENTS.map((instrument) => instrument.name).sort()
    );
  });

  it("POST /api/auth/login returns 401 for wrong password", async () => {
    await registerTenant("auth-wrong-password");

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "admin-auth-wrong-password@example.com",
        password: "wrong123",
      });

    expect(response.status).toBe(401);
  });

  it("POST /api/auth/login returns 404 for unknown e-mail", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "missing@example.com",
        password: "secret123",
      });

    expect(response.status).toBe(404);
  });

  it("login emite role GLOBAL_ADMIN no usuário, JWT e middleware permite /api/admin/tenants", async () => {
    await registerTenant("auth-global-admin");
    const storedUser = await prisma.user.update({
      where: { email: "admin-auth-global-admin@example.com" },
      data: { role: Role.GLOBAL_ADMIN },
      select: { id: true, role: true },
    });

    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email: "admin-auth-global-admin@example.com",
        password: "secret123",
      })
      .expect(200);

    const accessToken = loginResponse.body.data.accessToken as string;
    expect(loginResponse.body.data.user.role).toBe(Role.GLOBAL_ADMIN);
    expect(jwt.decode(accessToken)).toMatchObject({ userId: storedUser.id, role: Role.GLOBAL_ADMIN });

    await request(app).get("/api/admin/tenants").set("Authorization", `Bearer ${accessToken}`).expect(200);
  });

  it("token antigo TENANT_ADMIN não acessa /api/admin/tenants e novo login reflete role atualizada", async () => {
    await registerTenant("auth-role-refresh");

    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: "admin-auth-role-refresh@example.com",
        password: "secret123",
      })
      .expect(200);
    expect(oldLogin.body.data.user.role).toBe(Role.TENANT_ADMIN);

    await prisma.user.update({
      where: { email: "admin-auth-role-refresh@example.com" },
      data: { role: Role.GLOBAL_ADMIN },
    });

    await request(app)
      .get("/api/admin/tenants")
      .set("Authorization", `Bearer ${oldLogin.body.data.accessToken}`)
      .expect(200);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: "admin-auth-role-refresh@example.com",
        password: "secret123",
      })
      .expect(200);

    expect(newLogin.body.data.user.role).toBe(Role.GLOBAL_ADMIN);
    expect(jwt.decode(newLogin.body.data.accessToken)).toMatchObject({ role: Role.GLOBAL_ADMIN });
    await request(app)
      .get("/api/admin/tenants")
      .set("Authorization", `Bearer ${newLogin.body.data.accessToken}`)
      .expect(200);

    await prisma.user.update({
      where: { email: "admin-auth-role-refresh@example.com" },
      data: { role: Role.TENANT_ADMIN },
    });
    await request(app)
      .get("/api/admin/tenants")
      .set("Authorization", `Bearer ${newLogin.body.data.accessToken}`)
      .expect(403);
  });
});
