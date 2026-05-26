import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/repositories/prismaClient";

async function cleanDatabase() {
  await prisma.scheduleAssignment.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.ministryMember.deleteMany();
  await prisma.ministrySong.deleteMany();
  await prisma.song.deleteMany();
  await prisma.ministry.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

async function registerTenant(seed: string) {
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      churchName: `Igreja ${seed}`,
      name: `Admin ${seed}`,
      email: `admin-${seed}@example.com`,
      password: "secret123",
    })
    .expect(201);

  return response.body.data as {
    token: string;
    tenant: { id: string; name: string };
    user: { id: string; email: string; name: string; role: string };
  };
}

async function createMinistry(token: string, name: string) {
  const response = await request(app)
    .post("/api/ministries")
    .set("Authorization", `Bearer ${token}`)
    .send({ name })
    .expect(201);

  return response.body.data as { id: string; tenantId: string; name: string };
}

describe("POST /api/schedules", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it("exige autenticação", async () => {
    await request(app)
      .post("/api/schedules")
      .send({
        title: "Culto de domingo",
        date: "2026-05-03T13:00:00.000Z",
        ministryId: "00000000-0000-0000-0000-000000000000",
      })
      .expect(401);
  });

  it("impede criar escala usando ministério de outro tenant", async () => {
    const tenantA = await registerTenant("tenant-a");
    const tenantB = await registerTenant("tenant-b");
    const ministryB = await createMinistry(tenantB.token, "Louvor B");

    await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenantA.token}`)
      .send({
        title: "Escala isolada",
        date: "2026-05-03T13:00:00.000Z",
        ministryId: ministryB.id,
      })
      .expect(404);

    const schedules = await prisma.schedule.findMany({
      where: { ministryId: ministryB.id },
    });

    expect(schedules).toHaveLength(0);
  });

  it("cria escala autenticada no tenant correto e responde 201", async () => {
    const tenant = await registerTenant("tenant-c");
    const ministry = await createMinistry(tenant.token, "Louvor C");

    const response = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        title: "Culto de domingo",
        date: "2026-05-03T13:00:00.000Z",
        ministryId: ministry.id,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        title: "Culto de domingo",
        ministryId: ministry.id,
        tenantId: tenant.tenant.id,
      },
    });
    expect(response.body.data.id).toEqual(expect.any(String));
  });
});
