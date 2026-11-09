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
  await prisma.songTagAssignment.deleteMany();
  await prisma.song.deleteMany();
  await prisma.songTag.deleteMany();
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

async function createMinistry(token: string, name: string) {
  const response = await request(app).post("/api/ministries").set("Authorization", `Bearer ${token}`).send({ name }).expect(201);
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
  let databaseUrl = process.env.MUSIC_TEST_DATABASE_URL;
  if (databaseUrl) {
    const target = new URL(databaseUrl);
    if (!["127.0.0.1", "localhost"].includes(target.hostname) || target.pathname !== "/lauda_music_test") {
      throw new Error("MUSIC_TEST_DATABASE_URL deve apontar para um banco local isolado chamado lauda_music_test");
    }
  } else {
    container = await new GenericContainer("postgres:16-alpine").withEnvironment({
      POSTGRES_DB: "lauda_music_test", POSTGRES_USER: "test", POSTGRES_PASSWORD: "test",
    }).withExposedPorts(5432).start();
    databaseUrl = `postgresql://test:test@${container.getHost()}:${container.getMappedPort(5432)}/lauda_music_test`;
  }
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
  it("revisa novas cifras e exibe registros antigos limpos sem reescrever o banco", async () => {
    const tenant = await register("invisible-chords");
    const artist = await createArtist(tenant.token);
    const raw = "\uFEFF    G\u200B\tD\nTexto editado 👩‍🎤";
    const clean = "    G   D\nTexto editado 👩‍🎤";
    const created = await request(app).post("/api/songs").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ...songPayload(artist.id), content: raw }).expect(201);
    const id = created.body.data.id;
    expect(created.body.data.content).toBe(clean);
    expect((await prisma.song.findUniqueOrThrow({ where: { id } })).content).toBe(clean);
    await request(app).post("/api/songs").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ...songPayload(artist.id), title: "Sem texto", content: "\u200B\uFEFF" }).expect(400);
    await prisma.song.update({ where: { id }, data: { content: raw } });
    const loaded = await request(app).get(`/api/songs/${id}`).set("Authorization", `Bearer ${tenant.token}`).expect(200);
    const listed = await request(app).get("/api/songs").set("Authorization", `Bearer ${tenant.token}`).expect(200);
    expect(loaded.body.data.content).toBe(clean);
    expect(listed.body.data.items[0].content).toBe(clean);
    expect((await prisma.song.findUniqueOrThrow({ where: { id } })).content).toBe(raw);
  });

  it("revisa cifras do catálogo na prévia, na gravação e na exportação", async () => {
    const tenant = await register("catalog-invisibles");
    const ministry = await createMinistry(tenant.token, "Louvor de teste");
    const raw = "\u200BG\tC\nTexto editado";
    const clean = "G       C\nTexto editado";
    const document = { format: "lauda.music-catalog", version: 1, songs: [{ title: "Música revisada", artist: "Artista", originalKey: "G", content: raw }] };
    const preview = await request(app).post("/api/songs/data-import/preview").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document }).expect(200);
    await request(app).post("/api/songs/data-import/commit").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document, documentHash: preview.body.data.documentHash }).expect(201);
    const stored = await prisma.song.findFirstOrThrow({ where: { title: "Música revisada" } });
    expect(stored.content).toBe(clean);
    await prisma.song.update({ where: { id: stored.id }, data: { content: raw } });
    const exported = await request(app).post("/api/songs/data-export").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id }).expect(200);
    expect(exported.body.songs[0].content).toBe(clean);
    expect((await prisma.song.findUniqueOrThrow({ where: { id: stored.id } })).content).toBe(raw);
  });
  it("persiste o tom padrão junto da cifra editada e respeita tenant e permissão", async () => {
    const tenant = await register("default-key");
    const otherTenant = await register("other-default-key");
    const memberToken = await member(tenant.token, "default-key-member", "MEMBER");
    const artist = await createArtist(tenant.token);
    const created = await request(app).post("/api/songs").set("Authorization", `Bearer ${tenant.token}`)
      .send(songPayload(artist.id)).expect(201);
    const id = created.body.data.id;
    const url = `/api/songs/${id}`;
    await request(app).patch(url).set("Authorization", `Bearer ${tenant.token}`)
      .send({ content: "[G]Texto já editado [D/F#]preservado" }).expect(200);
    const payload = { originalKey: "A", content: "[A]Texto já editado [E/G#]preservado" };
    await request(app).patch(url).send(payload).expect(401);
    await request(app).patch(url).set("Authorization", `Bearer ${memberToken}`).send(payload).expect(403);
    await request(app).patch(url).set("Authorization", `Bearer ${otherTenant.token}`).send(payload).expect(404);
    await request(app).patch(url).set("Authorization", `Bearer ${tenant.token}`).send(payload).expect(200);
    // A fresh login/read verifies database persistence, independently of frontend caches.
    const login = await request(app).post("/api/auth/login").send({ email: tenant.user.email, password: "secret123" }).expect(200);
    const saved = await request(app).get(url).set("Authorization", `Bearer ${login.body.data.token}`).expect(200);
    expect(saved.body.data).toMatchObject({ ...payload, title: "Pra sempre", bpm: 96, artistId: artist.id });
    await request(app).get(url).set("Authorization", `Bearer ${otherTenant.token}`).expect(404);
    const listed = await request(app).get("/api/songs?originalKey=A").set("Authorization", `Bearer ${tenant.token}`).expect(200);
    expect(listed.body.data.items.map((song: { id: string }) => song.id)).toContain(id);
  });
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

  it("revisa, importa, vincula e exporta somente os dados portáteis por ministério", async () => {
    const tenant = await register("song-transfer");
    const memberToken = await member(tenant.token, "song-transfer-member", "MEMBER");
    const ministryA = await createMinistry(tenant.token, "Louvor da manhã");
    const ministryB = await createMinistry(tenant.token, "Louvor da noite");
    const document = {
      format: "lauda.music-catalog",
      version: 1,
      songs: [{
        title: "Cristo Venceu",
        artist: "JMM",
        originalKey: "A",
        content: "[Intro]\nA D F#m E",
        cifraUrl: "https://www.cifraclub.com.br/jmm/cristo-venceu/",
      }],
    };

    await request(app).post("/api/songs/data-import/preview").set("Authorization", `Bearer ${memberToken}`).send({ ministryId: ministryA.id, document }).expect(403);

    const previewA = await request(app)
      .post("/api/songs/data-import/preview")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministryA.id, document })
      .expect(200);
    expect(previewA.body.data).toMatchObject({ total: 1, counts: { CREATE: 1, CONFLICT: 0, INVALID: 0 } });

    await request(app)
      .post("/api/songs/data-import/commit")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministryA.id, document, documentHash: "0".repeat(64) })
      .expect(409);

    const importedA = await request(app)
      .post("/api/songs/data-import/commit")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministryA.id, document, documentHash: previewA.body.data.documentHash })
      .expect(201);
    expect(importedA.body.data).toMatchObject({ created: 1, linked: 1, conflicts: 0, invalid: 0 });

    const previewB = await request(app)
      .post("/api/songs/data-import/preview")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministryB.id, document })
      .expect(200);
    expect(previewB.body.data.counts).toMatchObject({ LINK: 1, CREATE: 0 });

    await request(app)
      .post("/api/songs/data-import/commit")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministryB.id, document, documentHash: previewB.body.data.documentHash })
      .expect(201);

    const exported = await request(app)
      .post("/api/songs/data-export")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministryB.id })
      .expect(200)
      .expect("Content-Type", /application\/json/);
    expect(exported.body).toEqual(document);

    const filtered = await request(app)
      .get(`/api/songs?ministryId=${ministryA.id}`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .expect(200);
    expect(filtered.body.data.items).toHaveLength(1);
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
  it("exige nova revisão quando o catálogo ou ministério muda antes da confirmação", async () => {
    const tenant = await register("transfer-stale");
    const ministry = await createMinistry(tenant.token, "Destino original");
    const other = await createMinistry(tenant.token, "Outro destino");
    const document = { format: "lauda.music-catalog", version: 1, songs: [{ title: "Revisão", artist: "Louvor", originalKey: "C", content: "[C]Revisão" }] };
    const preview = await request(app).post("/api/songs/data-import/preview").set("Authorization", `Bearer ${tenant.token}`).send({ ministryId: ministry.id, document }).expect(200);
    await request(app).post("/api/songs/data-import/commit").set("Authorization", `Bearer ${tenant.token}`).send({ ministryId: other.id, document, documentHash: preview.body.data.documentHash }).expect(409);
    await request(app).post("/api/songs/data-import/commit").set("Authorization", `Bearer ${tenant.token}`).send({ ministryId: ministry.id, document, documentHash: preview.body.data.documentHash }).expect(201);
    const artist = await prisma.artist.findFirstOrThrow({ where: { tenantId: (await prisma.user.findUniqueOrThrow({ where: { id: tenant.user.id } })).tenantId!, name: "Louvor" } });
    const song = await prisma.song.findFirstOrThrow({ where: { artistId: artist.id } });
    const again = await request(app).post("/api/songs/data-import/preview").set("Authorization", `Bearer ${tenant.token}`).send({ ministryId: other.id, document }).expect(200);
    await request(app).patch(`/api/songs/${song.id}`).set("Authorization", `Bearer ${tenant.token}`).send({ content: "[G]Atualizada" }).expect(200);
    await request(app).post("/api/songs/data-import/commit").set("Authorization", `Bearer ${tenant.token}`).send({ ministryId: other.id, document, documentHash: again.body.data.documentHash }).expect(409);
    expect(await prisma.ministrySong.count({ where: { ministryId: other.id } })).toBe(0);
    expect((await prisma.song.findUniqueOrThrow({ where: { id: song.id } })).content).toBe("[G]Atualizada");
  });


  it("importa e reexporta catálogo maior que 4 MB sem recusar um arquivo válido", async () => {
    const tenant = await register("large-song-transfer");
    const ministry = await createMinistry(tenant.token, "Catálogo completo");
    const document = {
      format: "lauda.music-catalog", version: 1,
      songs: Array.from({ length: 72 }, (_, index) => ({
        title: `Canção ${String(index + 1).padStart(3, "0")}`, artist: "Louvor", originalKey: "Am",
        content: "Am Dm E\n".repeat(8_000), cifraUrl: null,
      })),
    };
    expect(Buffer.byteLength(JSON.stringify(document))).toBeGreaterThan(4 * 1024 * 1024);
    const preview = await request(app).post("/api/songs/data-import/preview")
      .set("Authorization", `Bearer ${tenant.token}`).send({ ministryId: ministry.id, document }).expect(200);
    expect(preview.body.data.counts.CREATE).toBe(72);
    const result = await request(app).post("/api/songs/data-import/commit")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document, documentHash: preview.body.data.documentHash }).expect(201);
    expect(result.body.data).toMatchObject({ created: 72, linked: 72, conflicts: 0, invalid: 0 });
    const exported = await request(app).post("/api/songs/data-export")
      .set("Authorization", `Bearer ${tenant.token}`).send({ ministryId: ministry.id }).expect(200);
    expect(exported.body).toEqual(document);
  });


  it("ignora duplicatas e conflitos, preserva a cifra existente e restaura músicas removidas", async () => {
    const tenant = await register("transfer-conflicts");
    const ministry = await createMinistry(tenant.token, "Louvor");
    const artist = await createArtist(tenant.token, "Voz da Verdade");
    const existing = await request(app).post("/api/songs").set("Authorization", `Bearer ${tenant.token}`)
      .send(songPayload(artist.id)).expect(201);
    const incoming = { title: "Canção nova", artist: artist.name, originalKey: "C", content: "C F G", cifraUrl: null };
    const document = {
      format: "lauda.music-catalog", version: 1,
      songs: [
        { ...incoming, title: existing.body.data.title, originalKey: "G", content: "cifra diferente" },
        incoming,
        { ...incoming, title: "  CANÇÃO NOVA  " },
      ],
    };
    const preview = await request(app).post("/api/songs/data-import/preview").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document }).expect(200);
    expect(preview.body.data.counts).toMatchObject({ CREATE: 1, CONFLICT: 1, INVALID: 1 });
    const imported = await request(app).post("/api/songs/data-import/commit").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document, documentHash: preview.body.data.documentHash }).expect(201);
    expect(imported.body.data).toMatchObject({ created: 1, linked: 1, conflicts: 1, invalid: 1 });
    const unchanged = await request(app).get(`/api/songs/${existing.body.data.id}`).set("Authorization", `Bearer ${tenant.token}`).expect(200);
    expect(unchanged.body.data.content).toBe(songPayload(artist.id).content);
    const exported = await request(app).post("/api/songs/data-export").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id }).expect(200);
    expect(exported.body.songs).toEqual([incoming]);

    await request(app).delete(`/api/songs/${existing.body.data.id}`).set("Authorization", `Bearer ${tenant.token}`).expect(200);
    const restoreDocument = { ...document, songs: [{
      title: existing.body.data.title, artist: artist.name, originalKey: "G", content: songPayload(artist.id).content,
    }] };
    const restorePreview = await request(app).post("/api/songs/data-import/preview").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document: restoreDocument }).expect(200);
    expect(restorePreview.body.data.counts.RESTORE).toBe(1);
    const restored = await request(app).post("/api/songs/data-import/commit").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document: restoreDocument, documentHash: restorePreview.body.data.documentHash }).expect(201);
    expect(restored.body.data).toMatchObject({ created: 0, restored: 1, linked: 1 });
    await request(app).get(`/api/songs/${existing.body.data.id}`).set("Authorization", `Bearer ${tenant.token}`).expect(200);
  });


  it("informa erros de formato, campo inválido e limite de tamanho da importação", async () => {
    const tenant = await register("transfer-invalid");
    const ministry = await createMinistry(tenant.token, "Louvor");
    const endpoint = "/api/songs/data-import/preview";
    const malformed = await request(app).post(endpoint).set("Authorization", `Bearer ${tenant.token}`)
      .set("Content-Type", "application/json").send("{invalid").expect(400);
    expect(malformed.body.code).toBe("INVALID_JSON");
    const invalidSong = await request(app).post(endpoint).set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document: {
        format: "lauda.music-catalog", version: 1,
        songs: [{ title: "Canção", artist: "Artista", content: "C F G", originalKey: "H" }],
      } }).expect(400);
    expect(invalidSong.body.code).toBe("VALIDATION_ERROR");
    expect(invalidSong.body.details[0]).toContain("document.songs.0.originalKey");
    const tooLarge = await request(app).post(endpoint).set("Authorization", `Bearer ${tenant.token}`)
      .send({ data: "x".repeat(32 * 1024 * 1024) }).expect(413);
    expect(tooLarge.body.code).toBe("PAYLOAD_TOO_LARGE");
    const normalRoute = await request(app).post("/api/songs").set("Authorization", `Bearer ${tenant.token}`)
      .send({ data: "x".repeat(4 * 1024 * 1024) }).expect(413);
    expect(normalRoute.body.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("cria, edita e filtra temas da música sem vazar entre igrejas", async () => {
    const tenant = await register("song-tags");
    const other = await register("song-tags-other");
    const memberToken = await member(tenant.token, "song-tags-member", "MEMBER");
    const artist = await createArtist(tenant.token);
    const otherArtist = await createArtist(other.token, "Outra voz");

    const created = await request(app).post("/api/songs").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ...songPayload(artist.id), tags: ["  Adoração  ", "adoração", "Natal"] }).expect(201);
    expect(created.body.data.tags).toEqual(["Adoração", "Natal"]);
    const id = created.body.data.id as string;

    const second = await request(app).post("/api/songs").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ...songPayload(artist.id), title: "Batismo nas águas", tags: [" natal ", "Batismo"] }).expect(201);
    expect(second.body.data.tags).toEqual(["Batismo", "Natal"]);
    expect(await prisma.songTag.count({ where: { tenantId: (await prisma.song.findUniqueOrThrow({ where: { id } })).tenantId, normalizedName: "natal" } })).toBe(1);

    await request(app).post("/api/songs").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ...songPayload(artist.id), title: "Sem tema" }).expect(201);
    await request(app).post("/api/songs").set("Authorization", `Bearer ${other.token}`)
      .send({ ...songPayload(otherArtist.id), title: "Natal de outra igreja", tags: ["Natal"] }).expect(201);

    await request(app).patch(`/api/songs/${id}`).send({ tags: ["Gratidão"] }).expect(401);
    await request(app).patch(`/api/songs/${id}`).set("Authorization", `Bearer ${memberToken}`).send({ tags: ["Gratidão"] }).expect(403);
    await request(app).patch(`/api/songs/${id}`).set("Authorization", `Bearer ${other.token}`).send({ tags: ["Gratidão"] }).expect(404);
    await request(app).get("/api/songs/tags").expect(401);
    await request(app).get("/api/songs?tags=Natal").expect(401);

    const kept = await request(app).patch(`/api/songs/${id}`).set("Authorization", `Bearer ${tenant.token}`)
      .send({ bpm: 110 }).expect(200);
    expect(kept.body.data).toMatchObject({ bpm: 110, tags: ["Adoração", "Natal"] });

    const replaced = await request(app).patch(`/api/songs/${id}`).set("Authorization", `Bearer ${tenant.token}`)
      .send({ tags: ["Gratidão"] }).expect(200);
    expect(replaced.body.data.tags).toEqual(["Gratidão"]);

    const anyTheme = await request(app).get("/api/songs").query({ tags: ["Gratidão", "Batismo"] })
      .set("Authorization", `Bearer ${memberToken}`).expect(200);
    expect(anyTheme.body.data.items.map((song: { title: string }) => song.title).sort()).toEqual(["Batismo nas águas", "Pra sempre"]);

    const comma = await request(app).get("/api/songs?tags=Batismo,Inexistente")
      .set("Authorization", `Bearer ${tenant.token}`).expect(200);
    expect(comma.body.data.items.map((song: { id: string }) => song.id)).toEqual([second.body.data.id]);

    const otherList = await request(app).get("/api/songs?tags=Natal").set("Authorization", `Bearer ${other.token}`).expect(200);
    expect(otherList.body.data.items.map((song: { title: string }) => song.title)).toEqual(["Natal de outra igreja"]);

    const catalog = await request(app).get("/api/songs/tags").set("Authorization", `Bearer ${memberToken}`).expect(200);
    expect(catalog.body.data.untaggedCount).toBe(1);
    expect(catalog.body.data.items).toEqual([
      { id: expect.any(String), name: "Adoração", count: 0 },
      { id: expect.any(String), name: "Batismo", count: 1 },
      { id: expect.any(String), name: "Gratidão", count: 1 },
      { id: expect.any(String), name: "Natal", count: 1 },
    ]);
    const otherCatalog = await request(app).get("/api/songs/tags").set("Authorization", `Bearer ${other.token}`).expect(200);
    expect(otherCatalog.body.data.items.map((tag: { name: string }) => tag.name)).toEqual(["Natal"]);
    expect(otherCatalog.body.data.items[0].id).not.toBe(catalog.body.data.items.find((tag: { name: string }) => tag.name === "Natal").id);

    const cleared = await request(app).patch(`/api/songs/${id}`).set("Authorization", `Bearer ${tenant.token}`)
      .send({ tags: [] }).expect(200);
    expect(cleared.body.data.tags).toEqual([]);
    const afterClear = await request(app).get("/api/songs/tags").set("Authorization", `Bearer ${tenant.token}`).expect(200);
    expect(afterClear.body.data.untaggedCount).toBe(2);
    expect(afterClear.body.data.items.find((tag: { name: string }) => tag.name === "Gratidão").count).toBe(0);

    await request(app).post("/api/songs").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ...songPayload(artist.id), title: "Tema inválido", tags: [" "] }).expect(400);
    await request(app).post("/api/songs").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ...songPayload(artist.id), title: "Tema longo", tags: ["a".repeat(41)] }).expect(400);
  });

  it("combina busca, temas e músicas sem tema, com contagens por artista e tom", async () => {
    const { token } = await register("song-theme-facets");
    const auth = `Bearer ${token}`;
    const artist = await createArtist(token);
    const otherArtist = await createArtist(token, "Outro artista");
    const create = (fields: Record<string, unknown>) => request(app).post("/api/songs").set("Authorization", auth)
      .send({ ...songPayload(artist.id), ...fields }).expect(201);
    await create({ title: "Em memória de ti", tags: ["Comunhão/Santa Ceia", "Adoração"] });
    await create({ title: "Eis os anjos", tags: ["Natal"] });
    await create({ title: "Ceia instrumental" });
    await create({ title: "Natal no título" });
    await create({ title: "Ceia em outro tom", originalKey: "A", tags: ["Comunhão/Santa Ceia"] });
    await create({ title: "Ceia de outro artista", artistId: otherArtist.id, tags: ["Comunhão/Santa Ceia"] });
    const inactive = await create({ title: "Ceia removida", tags: ["Comunhão/Santa Ceia"] });
    await request(app).delete(`/api/songs/${inactive.body.data.id}`).set("Authorization", auth).expect(200);
    const scope = { artistId: artist.id, originalKey: "G" };
    const titles = (body: { data: { items: { title: string }[] } }) => body.data.items.map((song) => song.title);
    const list = (query: Record<string, unknown>) => request(app).get("/api/songs").query(query).set("Authorization", auth).expect(200);

    const byTheme = await list({ ...scope, search: "#natal" });
    expect(titles(byTheme.body)).toEqual(["Eis os anjos"]);
    expect(byTheme.body.data.items[0].tags).toEqual(["Natal"]);
    expect(titles((await list({ ...scope, search: "#adoracao" })).body)).toEqual(["Em memória de ti"]);
    expect(titles((await list({ ...scope, search: "ceia" })).body)).toEqual(["Ceia instrumental", "Em memória de ti"]);
    expect(titles((await list({ ...scope, search: "ceia", tags: "Natal,Adoração", untagged: "true" })).body))
      .toEqual(["Ceia instrumental", "Em memória de ti"]);
    expect(titles((await list({ ...scope, search: "ceia", tags: "Natal" })).body)).toEqual([]);
    expect(titles((await list({ ...scope, untagged: "true" })).body)).toEqual(["Ceia instrumental", "Natal no título"]);
    const counts = await request(app).get("/api/songs/tags").set("Authorization", auth)
      .query({ ...scope, search: "ceia", tags: "Natal" }).expect(200);
    expect(counts.body.data).toEqual({
      items: [
        { id: expect.any(String), name: "Adoração", count: 1 },
        { id: expect.any(String), name: "Comunhão/Santa Ceia", count: 1 },
        { id: expect.any(String), name: "Natal", count: 0 },
      ],
      untaggedCount: 1,
    });
  });

  it("adiciona e remove temas individualmente com concorrência e isolamento por igreja", async () => {
    const tenant = await register("song-theme-edit");
    const other = await register("song-theme-edit-other");
    const viewer = await member(tenant.token, "song-theme-edit-viewer", "MEMBER");
    const artist = await createArtist(tenant.token);
    const auth = `Bearer ${tenant.token}`;
    const initialTags = Array.from({ length: 11 }, (_, index) => `Tema ${index + 1}`);
    const song = await request(app).post("/api/songs").set("Authorization", auth)
      .send({ ...songPayload(artist.id), tags: initialTags }).expect(201);
    const url = `/api/songs/${song.body.data.id}/tags`;
    const change = (operation: string, name: string, token = tenant.token) =>
      request(app).patch(url).set("Authorization", `Bearer ${token}`).send({ operation, name });

    await request(app).patch(url).send({ operation: "add", name: "Natal" }).expect(401);
    await change("add", "Natal", viewer).expect(403);
    await change("remove", initialTags[0], viewer).expect(403);
    await change("add", "Natal", other.token).expect(404);
    await change("add", " ").expect(400);
    const concurrent = await Promise.all([change("add", "Natal"), change("add", "Páscoa")]);
    expect(concurrent.map((response) => response.status).sort()).toEqual([200, 409]);
    const accepted = concurrent[0].status === 200 ? "Natal" : "Páscoa";
    const rejected = accepted === "Natal" ? "Páscoa" : "Natal";
    const applied = concurrent.find((response) => response.status === 200)!.body.data;
    expect(applied.id).toBe(song.body.data.id);
    expect(applied.tags).toHaveLength(12);
    expect(applied.tags).toEqual(expect.arrayContaining([...initialTags, accepted]));
    expect((await change("add", `  ${accepted.toUpperCase()}  `).expect(200)).body.data).toEqual(applied);

    const catalog = await request(app).get("/api/songs/tags").set("Authorization", auth).expect(200);
    expect(catalog.body.data.items).not.toEqual(expect.arrayContaining([expect.objectContaining({ name: rejected })]));
    const removed = await change("remove", accepted).expect(200);
    expect(removed.body.data.tags).toHaveLength(11);
    expect(removed.body.data.tags).not.toContain(accepted);
    expect((await change("remove", accepted).expect(200)).body.data).toEqual(removed.body.data);
    const restored = await change("add", "Culto de jovens").expect(200);
    expect(restored.body.data.tags).toContain("Culto de jovens");
    const detail = await request(app).get(`/api/songs/${applied.id}`).set("Authorization", auth).expect(200);
    expect(detail.body.data).toMatchObject({ title: songPayload(artist.id).title, tags: restored.body.data.tags });
  });

  it("aplica e remove temas em lote e exporta os temas alterados no catálogo JSON", async () => {
    const tenant = await register("song-theme-batch");
    const auth = `Bearer ${tenant.token}`;
    const artist = await createArtist(tenant.token);
    const ministry = await createMinistry(tenant.token, "Louvor");
    const document = {
      format: "lauda.music-catalog", version: 1,
      songs: [
        { title: "Primeira", artist: artist.name, originalKey: "G", content: "[G]Primeira", tags: ["Natal"] },
        { title: "Segunda", artist: artist.name, originalKey: "G", content: "[G]Segunda" },
      ],
    };
    const preview = await request(app).post("/api/songs/data-import/preview").set("Authorization", auth)
      .send({ ministryId: ministry.id, document }).expect(200);
    await request(app).post("/api/songs/data-import/commit").set("Authorization", auth)
      .send({ ministryId: ministry.id, document, documentHash: preview.body.data.documentHash }).expect(201);
    const list = await request(app).get("/api/songs").set("Authorization", auth).expect(200);
    const songIds = list.body.data.items.map(({ id }: { id: string }) => id);
    const catalog = await request(app).get("/api/songs/tags").set("Authorization", auth).expect(200);
    const tagIds = [catalog.body.data.items[0].id];
    const batch = (payload: object) => request(app).patch("/api/songs/tags/batch").set("Authorization", auth).send({ songIds, tagIds, ...payload });

    const added = await batch({ operation: "add", newTags: ["Gratidão"] }).expect(200);
    expect(added.body.data).toEqual({
      updated: 2, items: songIds.map((id: string) => ({ id, tags: ["Gratidão", "Natal"] })),
    });
    const exported = await request(app).post("/api/songs/data-export").set("Authorization", auth)
      .send({ ministryId: ministry.id }).expect(200);
    expect(exported.body).toMatchObject({
      format: "lauda.music-catalog", version: 1,
      songs: [{ title: "Primeira", tags: ["Gratidão", "Natal"] }, { title: "Segunda", tags: ["Gratidão", "Natal"] }],
    });

    expect((await batch({ operation: "remove" }).expect(200)).body.data).toEqual({
      updated: 2, items: songIds.map((id: string) => ({ id, tags: ["Gratidão"] })),
    });
    expect((await batch({ operation: "remove" }).expect(200)).body.data.updated).toBe(0);
  });

  it("rejeita lote inteiro para música ou tema de outra igreja, sem permissão ou acima do limite", async () => {
    const tenant = await register("song-theme-batch-guard");
    const other = await register("song-theme-batch-guard-other");
    const viewer = await member(tenant.token, "song-theme-batch-viewer", "MEMBER");
    const artist = await createArtist(tenant.token);
    const foreignArtist = await createArtist(other.token);
    const create = async (token: string, artistId: string, title: string, tags: string[]) => (
      await request(app).post("/api/songs").set("Authorization", `Bearer ${token}`)
        .send({ ...songPayload(artistId), title, tags }).expect(201)
    ).body.data.id as string;
    const first = await create(tenant.token, artist.id, "Livre", []);
    const full = await create(tenant.token, artist.id, "Limite", Array.from({ length: 12 }, (_, index) => `Tema ${index + 1}`));
    const foreign = await create(other.token, foreignArtist.id, "Outra igreja", ["Tema externo"]);
    const foreignTags = await request(app).get("/api/songs/tags").set("Authorization", `Bearer ${other.token}`).expect(200);
    const foreignTagId = foreignTags.body.data.items[0].id;
    const payload = { songIds: [first, full], tagIds: [], newTags: ["Natal"], operation: "add" };
    const batch = (fields: object, token = tenant.token) => request(app).patch("/api/songs/tags/batch")
      .set("Authorization", `Bearer ${token}`).send({ ...payload, ...fields });

    await request(app).patch("/api/songs/tags/batch").send(payload).expect(401);
    await batch({}, viewer).expect(403);
    await batch({ songIds: [first, foreign] }).expect(404);
    await batch({ songIds: [first], tagIds: [foreignTagId] }).expect(404);
    await batch({ songIds: [first, first] }).expect(400);
    await batch({}).expect(409);
    const result = await request(app).get(`/api/songs/${first}`).set("Authorization", `Bearer ${tenant.token}`).expect(200);
    expect(result.body.data.tags).toEqual([]);
    const catalog = await request(app).get("/api/songs/tags").set("Authorization", `Bearer ${tenant.token}`).expect(200);
    expect(catalog.body.data.items.map(({ name }: { name: string }) => name)).not.toContain("Natal");
  });

  it("importa e exporta temas opcionais e preserva catálogos sem o campo", async () => {
    const tenant = await register("song-tag-transfer");
    const ministry = await createMinistry(tenant.token, "Louvor");
    const legacy = {
      format: "lauda.music-catalog",
      version: 1,
      songs: [{ title: "Sem tema", artist: "JMM", originalKey: "G", content: "[G]Sem tema", cifraUrl: null }],
    };
    const legacyPreview = await request(app).post("/api/songs/data-import/preview").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document: legacy }).expect(200);
    await request(app).post("/api/songs/data-import/commit").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document: legacy, documentHash: legacyPreview.body.data.documentHash }).expect(201);
    const legacyExport = await request(app).post("/api/songs/data-export").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id }).expect(200);
    expect(legacyExport.body).toEqual(legacy);

    const tagged = {
      format: "lauda.music-catalog",
      version: 1,
      songs: [{ title: "Com tema", artist: "JMM", originalKey: "A", content: "[A]Com tema", cifraUrl: null, tags: ["  Natal  ", "Adoração", "adoração"] }],
    };
    const preview = await request(app).post("/api/songs/data-import/preview").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document: tagged }).expect(200);
    expect(preview.body.data.counts.CREATE).toBe(1);
    await request(app).post("/api/songs/data-import/commit").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document: tagged, documentHash: preview.body.data.documentHash }).expect(201);

    const listed = await request(app).get("/api/songs?tags=Natal").set("Authorization", `Bearer ${tenant.token}`).expect(200);
    expect(listed.body.data.items.map((song: { title: string; tags: string[] }) => ({ title: song.title, tags: song.tags })))
      .toEqual([{ title: "Com tema", tags: ["Adoração", "Natal"] }]);

    const exported = await request(app).post("/api/songs/data-export").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id }).expect(200);
    expect(exported.body.songs).toEqual([
      { title: "Com tema", artist: "JMM", originalKey: "A", content: "[A]Com tema", cifraUrl: null, tags: ["Adoração", "Natal"] },
      legacy.songs[0],
    ]);

    const withoutTags = {
      format: "lauda.music-catalog",
      version: 1,
      songs: [{ title: "Com tema", artist: "JMM", originalKey: "A", content: "[A]Com tema", cifraUrl: null }],
    };
    const again = await request(app).post("/api/songs/data-import/preview").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document: withoutTags }).expect(200);
    expect(again.body.data.counts.ALREADY_LINKED).toBe(1);
    await request(app).post("/api/songs/data-import/commit").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document: withoutTags, documentHash: again.body.data.documentHash }).expect(201);
    const still = await request(app).get("/api/songs?tags=Adoração").set("Authorization", `Bearer ${tenant.token}`).expect(200);
    expect(still.body.data.items[0].tags).toEqual(["Adoração", "Natal"]);

    await request(app).post("/api/songs/data-import/preview").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document: { ...legacy, songs: [{ ...legacy.songs[0], tags: [""] }] } }).expect(400);
  });

  it("escolhe os campos do catálogo e pula ou atualiza músicas que já existem", async () => {
    const tenant = await register("transfer-choice");
    const ministry = await createMinistry(tenant.token, "Louvor");
    const source = {
      format: "lauda.music-catalog",
      version: 1,
      songs: [{
        title: "Já existe", artist: "JMM", originalKey: "G", content: "[G]Original",
        bpm: 80, cifraUrl: null, comments: "Olá", tags: ["Adoração"],
      }],
    };
    const initialFields = ["originalKey", "content", "bpm", "cifraUrl", "comments", "tags"];
    const created = await request(app).post("/api/songs/data-import/preview").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document: source, fields: initialFields }).expect(200);
    await request(app).post("/api/songs/data-import/commit").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document: source, fields: initialFields, documentHash: created.body.data.documentHash }).expect(201);

    const tagsOnly = await request(app).post("/api/songs/data-export").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, fields: ["tags"] }).expect(200);
    expect(tagsOnly.body.songs).toEqual([{ title: "Já existe", artist: "JMM", tags: ["Adoração"] }]);

    const everything = await request(app).post("/api/songs/data-export").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, fields: ["originalKey", "content", "bpm", "cifraUrl", "letraUrl", "audioUrl", "videoUrl", "comments", "tags"] }).expect(200);
    expect(everything.body.songs[0]).toMatchObject({
      originalKey: "G", content: "[G]Original", bpm: 80, cifraUrl: null, comments: "Olá", tags: ["Adoração"],
    });

    const changed = {
      format: "lauda.music-catalog", version: 1,
      songs: [{ title: "Já existe", artist: "JMM", originalKey: "A", content: "[A]Outra cifra", tags: ["Natal"] }],
    };
    const withNewSong = {
      ...changed,
      songs: [...changed.songs, { title: "Canção nova", artist: "JMM", originalKey: "C", content: "[C]Nova", tags: ["Missões"] }],
    };
    const conflict = await request(app).post("/api/songs/data-import/preview").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document: changed }).expect(200);
    expect(conflict.body.data.counts).toMatchObject({ CONFLICT: 1, CREATE: 0 });
    await request(app).post("/api/songs/data-import/commit").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document: changed, documentHash: conflict.body.data.documentHash }).expect(201);
    const preserved = await request(app).get("/api/songs?search=Já existe").set("Authorization", `Bearer ${tenant.token}`).expect(200);
    expect(preserved.body.data.items[0]).toMatchObject({ content: "[G]Original", originalKey: "G", tags: ["Adoração"] });

    const tagsUpdate = await request(app).post("/api/songs/data-import/preview").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document: withNewSong, fields: ["tags"], existing: "update" }).expect(200);
    expect(tagsUpdate.body.data.counts).toMatchObject({ UPDATE: 1, INVALID: 1 });
    await request(app).post("/api/songs/data-import/commit").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document: withNewSong, fields: ["tags"], existing: "update", documentHash: tagsUpdate.body.data.documentHash }).expect(201);
    const retagged = await request(app).get("/api/songs?search=Já existe").set("Authorization", `Bearer ${tenant.token}`).expect(200);
    expect(retagged.body.data.items[0]).toMatchObject({ content: "[G]Original", originalKey: "G", tags: ["Natal"] });
    expect(await prisma.song.count({ where: { title: "Canção nova" } })).toBe(0);

    const skipped = await request(app).post("/api/songs/data-import/preview").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document: withNewSong, fields: ["originalKey", "content", "tags"], existing: "skip" }).expect(200);
    expect(skipped.body.data.counts).toMatchObject({ SKIPPED: 1, CREATE: 1 });
    const skipResult = await request(app).post("/api/songs/data-import/commit").set("Authorization", `Bearer ${tenant.token}`)
      .send({ ministryId: ministry.id, document: withNewSong, fields: ["originalKey", "content", "tags"], existing: "skip", documentHash: skipped.body.data.documentHash }).expect(201);
    expect(skipResult.body.data).toMatchObject({ created: 1, skipped: 1, updated: 0 });
    const untouched = await request(app).get("/api/songs?search=Já existe").set("Authorization", `Bearer ${tenant.token}`).expect(200);
    expect(untouched.body.data.items[0]).toMatchObject({ content: "[G]Original", tags: ["Natal"] });
    const fresh = await request(app).get("/api/songs?search=Canção nova").set("Authorization", `Bearer ${tenant.token}`).expect(200);
    expect(fresh.body.data.items[0]).toMatchObject({ content: "[C]Nova", tags: ["Missões"] });
  });

  it("preserva os temas existentes ao vincular e restaurar pelo catálogo JSON", async () => {
    const tenant = await register("song-transfer-link-tags");
    const auth = `Bearer ${tenant.token}`;
    const ministry = await createMinistry(tenant.token, "Louvor");
    const artist = await createArtist(tenant.token);
    const songIds: string[] = [];
    const songs = [];
    for (const [title, tags] of [["Vincular música", ["Natal"]], ["Restaurar música", []]] as const) {
      const existing = await request(app).post("/api/songs").set("Authorization", auth)
        .send({ ...songPayload(artist.id), title, tags: ["Adoração"] }).expect(201);
      songIds.push(existing.body.data.id);
      songs.push({ title, artist: artist.name, originalKey: "G", content: songPayload(artist.id).content, tags });
    }
    await request(app).delete(`/api/songs/${songIds[1]}`).set("Authorization", auth).expect(200);
    const input = { ministryId: ministry.id, document: { format: "lauda.music-catalog", version: 1, songs } };
    const preview = await request(app).post("/api/songs/data-import/preview").set("Authorization", auth).send(input).expect(200);
    expect(preview.body.data.counts).toMatchObject({ LINK: 1, RESTORE: 1 });
    await request(app).post("/api/songs/data-import/commit").set("Authorization", auth)
      .send({ ...input, documentHash: preview.body.data.documentHash }).expect(201);
    for (const id of songIds) {
      const song = await request(app).get(`/api/songs/${id}`).set("Authorization", auth).expect(200);
      expect(song.body.data.tags).toEqual(["Adoração"]);
    }
  });


});

