import { execFileSync } from "node:child_process";
import path from "node:path";
import type express from "express";
import request from "supertest";
import { Role } from "@prisma/client";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import type { prisma as PrismaClientInstance } from "../../config/prisma";
import { CifraClubImportService } from "../../services/cifraClubImportService";

let app: express.Express;
let prisma: typeof PrismaClientInstance;
let container: StartedTestContainer;

function migrate(databaseUrl: string) {
  execFileSync(process.execPath, [path.resolve("node_modules", "prisma", "build", "index.js"), "migrate", "deploy"], {
    env: { PATH: process.env.PATH, NODE_ENV: "test", DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });
}

async function cleanDatabase() {
  await prisma.userInstrument.deleteMany();
  await prisma.scheduleAssignment.deleteMany();
  await prisma.scheduleSong.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.ministryMember.deleteMany();
  await prisma.ministrySong.deleteMany();
  await prisma.song.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.instrument.deleteMany();
  await prisma.ministry.deleteMany();
  await prisma.memberInvite.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

async function register(seed: string) {
  const response = await request(app).post("/api/auth/register").send({
    churchName: `Igreja ${seed}`,
    name: `Admin ${seed}`,
    email: `admin-${seed}@example.com`,
    password: "secret123",
  }).expect(201);
  return response.body.data as { token: string; user: { id: string; email: string } };
}

async function member(adminToken: string, seed: string, role: "MEMBER" | "MINISTRY_LEADER") {
  await request(app).post("/api/members").set("Authorization", `Bearer ${adminToken}`).send({
    name: `Membro ${seed}`, email: `${seed}@example.com`, password: "member123", role,
  }).expect(201);
  const login = await request(app).post("/api/auth/login").send({ email: `${seed}@example.com`, password: "member123" }).expect(200);
  return login.body.data.token as string;
}

async function createArtist(token: string, name = "Voz da Verdade") {
  const response = await request(app).post("/api/artists").set("Authorization", `Bearer ${token}`).send({ name }).expect(201);
  return response.body.data as { id: string; name: string };
}

const songPayload = (artistId: string) => ({
  title: "Pra sempre",
  artistId,
  composer: null,
  originalKey: "G",
  content: "[G]Pra sempre [D]cantarei",
  bpm: 96,
});

const songLinks = {
  cifraUrl: "https://example.com/cifra",
  letraUrl: "https://example.com/letra",
  audioUrl: "https://example.com/audio",
  videoUrl: "https://youtu.be/dQw4w9WgXcQ",
};

const canonicalVideoUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

beforeAll(async () => {
  container = await new GenericContainer("postgres:16-alpine").withEnvironment({
    POSTGRES_DB: "lauda_music_test", POSTGRES_USER: "test", POSTGRES_PASSWORD: "test",
  }).withExposedPorts(5432).start();
  const databaseUrl = `postgresql://test:test@${container.getHost()}:${container.getMappedPort(5432)}/lauda_music_test`;
  Object.assign(process.env, {
    DATABASE_URL: databaseUrl,
    JWT_SECRET: "test_access_secret",
    REFRESH_JWT_SECRET: "test_refresh_secret",
    JWT_EXPIRES_IN: "15m",
    REFRESH_JWT_EXPIRES_IN: "7d",
    NODE_ENV: "test",
  });
  migrate(databaseUrl);
  app = (await import("../../app")).default;
  prisma = (await import("../../config/prisma")).prisma;
}, 60000);

beforeEach(async () => cleanDatabase());
afterAll(async () => { if (prisma) { await cleanDatabase(); await prisma.$disconnect(); } if (container) await container.stop(); });

describe("Artists and songs API", () => {
  it("aplica as permissões de TENANT_ADMIN, MINISTRY_LEADER, MEMBER e GLOBAL_ADMIN", async () => {
    const tenant = await register("roles");
    const leaderToken = await member(tenant.token, "music-leader", "MINISTRY_LEADER");
    const memberToken = await member(tenant.token, "music-member", "MEMBER");
    const artist = await createArtist(tenant.token);

    await request(app).post("/api/songs").set("Authorization", `Bearer ${leaderToken}`).send(songPayload(artist.id)).expect(201);
    await request(app).post("/api/artists").set("Authorization", `Bearer ${memberToken}`).send({ name: "Bloqueado" }).expect(403);
    await request(app).patch(`/api/songs/${(await request(app).get("/api/songs").set("Authorization", `Bearer ${memberToken}`)).body.data.items[0].id}`).set("Authorization", `Bearer ${memberToken}`).send({ originalKey: "A" }).expect(403);

    await prisma.user.update({ where: { id: tenant.user.id }, data: { role: Role.GLOBAL_ADMIN } });
    const globalLogin = await request(app).post("/api/auth/login").send({ email: tenant.user.email, password: "secret123" }).expect(200);
    await request(app).post("/api/artists").set("Authorization", `Bearer ${globalLogin.body.data.token}`).send({ name: "Global Artist" }).expect(201);
  });

  it("protege as rotas de importação do Cifra Club por permissão e valida entrada", async () => {
    const tenant = await register("cifra-import");
    const memberToken = await member(tenant.token, "cifra-member", "MEMBER");

    await request(app)
      .get("/api/songs/cifra-club/search?artist=Aline%20Barros&title=Autor%20da%20Vida")
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(403);

    await request(app)
      .get("/api/songs/cifra-club/search?artist=&title=")
      .set("Authorization", `Bearer ${tenant.token}`)
      .expect(400);

    await request(app)
      .post("/api/songs/cifra-club/import")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ url: "https://example.com/aline-barros/autor-da-vida/" })
      .expect(400);
  });

  it("aceita busca no Cifra Club com somente artista, somente música ou ambos", async () => {
    const tenant = await register("cifra-partial-search");
    const search = jest.spyOn(CifraClubImportService.prototype, "search").mockResolvedValue({
      items: [{
        title: "Autor da Vida",
        artist: "Oficina G3",
        url: "https://www.cifraclub.com.br/oficina-g3/autor-da-vida/",
        originalKey: "G",
      }],
    });

    try {
      const artistOnly = await request(app)
        .get("/api/songs/cifra-club/search?artist=Oficina%20G3")
        .set("Authorization", `Bearer ${tenant.token}`)
        .expect(200);
      expect(artistOnly.body.data.items).toHaveLength(1);
      expect(search).toHaveBeenLastCalledWith({ artist: "Oficina G3" });

      const titleOnly = await request(app)
        .get("/api/songs/cifra-club/search?title=Autor%20da%20Vida")
        .set("Authorization", `Bearer ${tenant.token}`)
        .expect(200);
      expect(titleOnly.body.data.items).toHaveLength(1);
      expect(search).toHaveBeenLastCalledWith({ title: "Autor da Vida" });

      await request(app)
        .get("/api/songs/cifra-club/search?artist=Oficina%20G3&title=Autor%20da%20Vida")
        .set("Authorization", `Bearer ${tenant.token}`)
        .expect(200);
      expect(search).toHaveBeenLastCalledWith({ artist: "Oficina G3", title: "Autor da Vida" });
    } finally {
      search.mockRestore();
    }
  });

  it("normaliza nomes, ordena busca e rejeita duplicidade por tenant", async () => {
    const tenant = await register("duplicates");
    await createArtist(tenant.token, "  Oficina   G3  ");
    const duplicate = await request(app).post("/api/artists").set("Authorization", `Bearer ${tenant.token}`).send({ name: "oficina g3" }).expect(409);
    expect(duplicate.body.error).toContain("Já existe");

    await createArtist(tenant.token, "Oficina da Música");
    const result = await request(app).get("/api/artists?search=oficina").set("Authorization", `Bearer ${tenant.token}`).expect(200);
    expect(result.body.data.items.map((item: { name: string }) => item.name)).toEqual(["Oficina da Música", "Oficina G3"]);
  });

  it("filtra músicas por artista e tom sem revelar artistas de outra igreja", async () => {
    const tenantA = await register("song-filters-a");
    const tenantB = await register("song-filters-b");
    const artistA = await createArtist(tenantA.token, "Artista A");
    const artistA2 = await createArtist(tenantA.token, "Artista B");
    const foreignArtist = await createArtist(tenantB.token, "Artista externo");

    await request(app).post("/api/songs").set("Authorization", `Bearer ${tenantA.token}`).send({
      ...songPayload(artistA.id), title: "Graça sublime", originalKey: "G",
    }).expect(201);
    await request(app).post("/api/songs").set("Authorization", `Bearer ${tenantA.token}`).send({
      ...songPayload(artistA2.id), title: "Graça futura", originalKey: "D",
    }).expect(201);

    const filtered = await request(app)
      .get(`/api/songs?search=gra%C3%A7a&artistId=${artistA.id}&originalKey=G`)
      .set("Authorization", `Bearer ${tenantA.token}`)
      .expect(200);
    expect(filtered.body.data.items.map((item: { title: string }) => item.title)).toEqual(["Graça sublime"]);
    expect(filtered.body.data.pagination).toMatchObject({ total: 1, totalPages: 1 });

    const foreign = await request(app)
      .get(`/api/songs?artistId=${foreignArtist.id}`)
      .set("Authorization", `Bearer ${tenantA.token}`)
      .expect(200);
    expect(foreign.body.data).toMatchObject({ items: [], pagination: { total: 0, totalPages: 0 } });

    await request(app)
      .get("/api/songs?originalKey=H")
      .set("Authorization", `Bearer ${tenantA.token}`)
      .expect(400);
  });

  it("cria música sem compositor, valida Tom e impede título duplicado", async () => {
    const tenant = await register("validation");
    const artist = await createArtist(tenant.token);
    const created = await request(app).post("/api/songs").set("Authorization", `Bearer ${tenant.token}`).send(songPayload(artist.id)).expect(201);
    expect(created.body.data).toMatchObject({ title: "Pra sempre", composer: null, originalKey: "G", bpm: 96 });

    await request(app).post("/api/songs").set("Authorization", `Bearer ${tenant.token}`).send({ ...songPayload(artist.id), title: " PRA   SEMPRE " }).expect(409);
    await request(app).post("/api/songs").set("Authorization", `Bearer ${tenant.token}`).send({ ...songPayload(artist.id), title: "Outro", originalKey: "H" }).expect(400);
    await request(app).post("/api/songs").set("Authorization", `Bearer ${tenant.token}`).send({ ...songPayload(artist.id), title: "BPM inválido", bpm: 301 }).expect(400);
  });

  it("cria, edita e limpa links externos da música", async () => {
    const tenant = await register("links");
    const artist = await createArtist(tenant.token);
    const created = await request(app)
      .post("/api/songs")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ ...songPayload(artist.id), ...songLinks })
      .expect(201);

    expect(created.body.data).toMatchObject({ ...songLinks, videoUrl: canonicalVideoUrl });

    const updated = await request(app)
      .patch(`/api/songs/${created.body.data.id}`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        cifraUrl: "https://example.com/nova-cifra",
        letraUrl: null,
        audioUrl: "",
        videoUrl: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      })
      .expect(200);

    expect(updated.body.data).toMatchObject({
      cifraUrl: "https://example.com/nova-cifra",
      letraUrl: null,
      audioUrl: null,
      videoUrl: canonicalVideoUrl,
    });

    const withoutVideo = await request(app)
      .patch(`/api/songs/${created.body.data.id}`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ videoUrl: null })
      .expect(200);

    expect(withoutVideo.body.data.videoUrl).toBeNull();
  });

  it("rejeita links externos inválidos", async () => {
    const tenant = await register("invalid-links");
    const artist = await createArtist(tenant.token);

    await request(app)
      .post("/api/songs")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ ...songPayload(artist.id), cifraUrl: "example.com/cifra" })
      .expect(400);

    await request(app)
      .post("/api/songs")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ ...songPayload(artist.id), title: "FTP", cifraUrl: "ftp://example.com/cifra" })
      .expect(400);

    const otherDomain = await request(app)
      .post("/api/songs")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ ...songPayload(artist.id), title: "Outro domínio", videoUrl: "https://example.com/youtube/dQw4w9WgXcQ" })
      .expect(400);

    expect(JSON.stringify(otherDomain.body)).toContain("Informe um link válido de vídeo do YouTube");

    const validSong = await request(app)
      .post("/api/songs")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ ...songPayload(artist.id), title: "URL válida" })
      .expect(201);

    await request(app)
      .patch(`/api/songs/${validSong.body.data.id}`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ videoUrl: "youtube" })
      .expect(400);
  });

  it("isola artistas e músicas de outros tenants com 404", async () => {
    const tenantA = await register("tenant-a");
    const tenantB = await register("tenant-b");
    const artistB = await createArtist(tenantB.token, "Artista B");
    const songB = await request(app).post("/api/songs").set("Authorization", `Bearer ${tenantB.token}`).send(songPayload(artistB.id)).expect(201);
    await request(app).get(`/api/artists/${artistB.id}`).set("Authorization", `Bearer ${tenantA.token}`).expect(404);
    await request(app).get(`/api/songs/${songB.body.data.id}`).set("Authorization", `Bearer ${tenantA.token}`).expect(404);
    await request(app).post("/api/songs").set("Authorization", `Bearer ${tenantA.token}`).send(songPayload(artistB.id)).expect(404);
  });

  it("exporta PDF individual/conjunto e valida a seleção", async () => {
    const tenant = await register("pdf");
    const artist = await createArtist(tenant.token, "Árvore da Vida");
    const first = await request(app).post("/api/songs").set("Authorization", `Bearer ${tenant.token}`).send(songPayload(artist.id)).expect(201);
    const second = await request(app).post("/api/songs").set("Authorization", `Bearer ${tenant.token}`).send({ ...songPayload(artist.id), title: "Canção dois", originalKey: "Am" }).expect(201);
    const pdf = await request(app).post("/api/songs/export").set("Authorization", `Bearer ${tenant.token}`).send({ songIds: [second.body.data.id, first.body.data.id] }).buffer(true).parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      res.on("end", () => callback(null, Buffer.concat(chunks)));
    }).expect(200).expect("Content-Type", /application\/pdf/);
    expect(Buffer.isBuffer(pdf.body)).toBe(true);
    expect(pdf.body.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.body.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(2);

    const individualPdf = await request(app).post("/api/songs/export").set("Authorization", `Bearer ${tenant.token}`).send({ songIds: [first.body.data.id] }).buffer(true).parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      res.on("end", () => callback(null, Buffer.concat(chunks)));
    }).expect(200);
    expect(individualPdf.body.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(1);

    await request(app)
      .post("/api/songs/export")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ songIds: [first.body.data.id], transpositions: { [first.body.data.id]: 2 } })
      .expect(200)
      .expect("Content-Type", /application\/pdf/);

    await request(app)
      .post("/api/songs/export")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ songIds: [first.body.data.id], transpositions: { [first.body.data.id]: 12 } })
      .expect(400);

    await request(app).post("/api/songs/export").set("Authorization", `Bearer ${tenant.token}`).send({ songIds: [] }).expect(400);
    await request(app).post("/api/songs/export").set("Authorization", `Bearer ${tenant.token}`).send({ songIds: Array.from({ length: 51 }, () => first.body.data.id) }).expect(400);
  });

  it("identifica cifras removidas sem descartar silenciosamente as demais", async () => {
    const tenant = await register("pdf-unavailable");
    const artist = await createArtist(tenant.token);
    const available = await request(app).post("/api/songs").set("Authorization", `Bearer ${tenant.token}`).send(songPayload(artist.id)).expect(201);
    const removed = await request(app).post("/api/songs").set("Authorization", `Bearer ${tenant.token}`).send({
      ...songPayload(artist.id), title: "Cifra removida",
    }).expect(201);
    await request(app).delete(`/api/songs/${removed.body.data.id}`).set("Authorization", `Bearer ${tenant.token}`).expect(200);

    const response = await request(app)
      .post("/api/songs/export")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ songIds: [available.body.data.id, removed.body.data.id] })
      .expect(409);

    expect(response.body).toMatchObject({
      success: false,
      code: "SONGS_UNAVAILABLE",
      details: { songIds: [removed.body.data.id] },
    });
  });
});
