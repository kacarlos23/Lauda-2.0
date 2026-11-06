"use strict";

// Disposable visual fixtures, exclusively against the existing local test API.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { Client } = require("pg");
const dotenv = require("dotenv");
const root = path.resolve(__dirname, "..");
const settings = dotenv.parse(fs.readFileSync(path.join(root, ".env.worship-development")));
const database = new URL(settings.DATABASE_URL);
assert.equal(database.hostname, "127.0.0.1");
assert.equal(database.port, "5435");
assert.equal(database.pathname, "/lauda2_worship_development");
assert.equal(settings.EXPO_PUBLIC_API_URL, "http://127.0.0.1:3010/api");
const apiBase = settings.EXPO_PUBLIC_API_URL;
Object.assign(process.env, settings, { DOTENV_CONFIG_PATH: path.join(root, ".env.worship-development") });
require("ts-node/register/transpile-only");
const { AuthService } = require("../src/services/authService");
const credentials = { email: "visual@lauda.test", password: "LaudaVisual2026!" };
let token;
async function api(route, body, method = "GET") {
  const response = await fetch(apiBase + route, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${JSON.stringify(result)}`);
  return result.data;
}

async function main() {
  let auth;
  const authService = new AuthService();
  // Test setup uses the regular credential/session service once, then reuses the
  // authenticated browser state. Repeated visual tests must not hammer /auth/login.
  try { auth = await authService.login(credentials); }
  catch { auth = await authService.register({ ...credentials, churchName: "Igreja de demonstração", name: "Carlos (teste visual)" }); }
  token = auth.token || auth.accessToken;
  // Confirm the API writes to the isolated test database before creating fixtures.
  const db = new Client({ connectionString: settings.DATABASE_URL });
  await db.connect();
  try {
    const found = await db.query('SELECT id FROM "Tenant" WHERE id=$1', [auth.tenant.id]);
    assert.equal(found.rowCount, 1, "API e banco de testes devem corresponder");
  } finally { await db.end(); }

  const ministries = await api("/ministries");
  for (const [name, description] of [["Louvor", "Música e serviço nos cultos."], ["Recepção", "Acolhimento e cuidado com as pessoas."], ["Mídia", "Som, projeção e transmissão."]]) {
    if (!ministries.some((item) => item.name === name)) ministries.push(await api("/ministries", { name, description }, "POST"));
  }
  const ministry = ministries.find((item) => item.name === "Louvor");
  const document = { format: "lauda.music-catalog", version: 1, songs: [
    ["Ajuntamento", "Ipalpha", "G"], ["Santo pra Sempre", "Gabriel Guedes", "C"],
    ["Cantarei Teu Amor", "Paulo César Baruk", "D"], ["Grandioso és tu", "Cantor Cristão", "A"],
    ["Senhor Tu És Bom", "Comunidade Zona Sul", "E"], ["Eu Tenho um Chamado", "Quatro Por Um", "G"],
  ].map(([title, artist, originalKey]) => ({ title, artist, originalKey, content: "[Intro]\nG  D  Em  C\n\n[Verso]\n[G]Conteúdo de demonstração [D]para testar a leitura\n[Em]Texto fictício [C]para conferir o contraste\n\n[Refrão]\nG  D  Em  C", cifraUrl: null })) };
  const preview = await api("/songs/data-import/preview", { ministryId: ministry.id, document }, "POST");
  await api("/songs/data-import/commit", { ministryId: ministry.id, document, documentHash: preview.documentHash }, "POST");
  const songs = (await api("/songs?limit=100")).items;
  const instruments = await api("/instruments");
  for (const [name, colorHex, iconKey] of [["Baixo", "#1F6F55", "baixo"], ["Vocal", "#8B5CF6", "vocalista"], ["Teclado", "#2563EB", "teclado"], ["Bateria", "#C0582D", "bateria"]]) {
    if (!instruments.some((item) => item.name === name)) instruments.push(await api("/instruments", { name, colorHex, iconKey }, "POST"));
  }
  const bass = instruments.find((item) => item.name === "Baixo");
  await api("/members/me/instruments", { instrumentIds: [bass.id] }, "PATCH");
  const membersResult = await api("/members?limit=100");
  const members = membersResult.items ?? membersResult;
  for (const [name, email, instrument] of [["Ana Souza", "ana.visual@lauda.test", "Vocal"], ["João Santos", "joao.visual@lauda.test", "Bateria"], ["Marina Costa", "marina.visual@lauda.test", "Teclado"]]) {
    if (!members.some((item) => item.name === name)) members.push(await api("/members", { name, email, password: credentials.password, role: "MEMBER" }, "POST"));
    const member = members.find((item) => item.name === name);
    await api(`/members/${member.id}/instruments`, { instrumentIds: [instruments.find((item) => item.name === instrument).id] }, "PATCH");
  }
  const current = await api(`/ministries/${ministry.id}/members?limit=100`);
  const linked = new Set(current.items.map((item) => item.userId ?? item.user?.id ?? item.id));
  for (const member of members) if (!linked.has(member.id)) await api(`/ministries/${ministry.id}/members`, { userId: member.id, isLeader: member.id === auth.user.id }, "POST");

  const schedulesResult = await api("/schedules?limit=100");
  const schedules = schedulesResult.items ?? schedulesResult;
  const fixtures = [["Culto da manhã", "2026-10-25T12:00:00.000Z", "MORNING"], ["Culto da noite", "2026-10-25T22:00:00.000Z", "EVENING"], ["Culto de oração", "2026-10-28T22:30:00.000Z", null]];
  for (const [title, date, worshipPeriod] of fixtures) {
    if (!schedules.some((item) => item.title === title)) schedules.push(await api("/schedules", {
      title, date, ministryId: ministry.id, worshipPeriod, songIds: songs.slice(0, title.includes("manhã") ? 2 : 5).map((song) => song.id),
      assignments: members.map((member) => ({ userId: member.id, role: member.id === auth.user.id ? "Baixo" : member.name.startsWith("Ana") ? "Vocal" : member.name.startsWith("João") ? "Bateria" : "Teclado" })),
    }, "POST"));
  }
  const output = path.join(root, "test-results", "theme-preview");
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, "fixture.json"), JSON.stringify({ email: credentials.email, ministryId: ministry.id, songs: songs.map(({id,title})=>({id,title})), schedules: schedules.map(({id,title})=>({id,title})) }, null, 2));
  fs.writeFileSync(path.join(output, "session.local.json"), JSON.stringify({ cookies: [], origins: [{
    origin: "http://127.0.0.1:8094", localStorage: [
      { name: "auth_token", value: auth.token || auth.accessToken },
      { name: "refresh_token", value: auth.refreshToken },
      { name: "auth_user", value: JSON.stringify(auth.user) },
      { name: "auth_tenant", value: JSON.stringify(auth.tenant) },
    ],
  }] }));
  console.log("Dados visuais preparados no banco de testes local. Acesso: visual@lauda.test");
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => require("../src/config/prisma").prisma.$disconnect());
