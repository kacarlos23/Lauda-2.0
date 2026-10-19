"use strict";

// Acceptance against the isolated local environment. Never use .env or production URLs.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { Client } = require("pg");
const { chromium } = require("playwright");
const dotenv = require("dotenv");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "test-results", "worship-acceptance");
const credentialsPath = path.join(output, "accounts.local.json");
const settings = dotenv.parse(fs.readFileSync(path.join(root, ".env.worship-development")));
const dbUrl = new URL(settings.DATABASE_URL);
assert.equal(dbUrl.hostname, "127.0.0.1");
assert.equal(dbUrl.port, "5435");
assert.equal(dbUrl.pathname, "/lauda2_worship_development");
assert.equal(settings.EXPO_PUBLIC_API_URL, "http://127.0.0.1:3010/api");
const apiBase = settings.EXPO_PUBLIC_API_URL;
const webBase = process.env.LAUDA_TEST_WEB_URL || "http://127.0.0.1:8090";
assert.ok(["http://127.0.0.1:8090", "http://127.0.0.1:8093"].includes(webBase));
const report = { startedAt: new Date().toISOString(), webBase, apiBase, database: "127.0.0.1:5435/lauda2_worship_development", checks: [] };
fs.mkdirSync(output, { recursive: true });
function phase(name) { report.phase = name; console.log(`[acceptance] ${name}`); }

async function api(route, body, token, method = "GET", expected = 200) {
  const response = await fetch(apiBase + route, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal(response.status, expected, `${method} ${route}: ${response.status} != ${expected}`);
  const payload = await response.json();
  return payload.data;
}
async function account(label) {
  const accounts = fs.existsSync(credentialsPath) ? JSON.parse(fs.readFileSync(credentialsPath, "utf8")) : {};
  if (accounts[label]) {
    const credentials = accounts[label];
    const auth = await api("/auth/login", credentials, undefined, "POST");
    return { ...auth, password: credentials.password, token: auth.token || auth.accessToken };
  }
  const password = `Test-${crypto.randomUUID()}!`;
  const email = `worship-${crypto.randomUUID()}@lauda.test`;
  const auth = await api("/auth/register", {
    churchName: `[TESTE] Homologação ${label}`, name: "Administrador de homologação",
    email, password,
  }, undefined, "POST", 201);
  accounts[label] = { email, password };
  fs.writeFileSync(credentialsPath, JSON.stringify(accounts, null, 2));
  return { ...auth, password, token: auth.token || auth.accessToken };
}
async function pdf(date, token, filename) {
  const response = await fetch(`${apiBase}/schedules/worship-order/${date}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/pdf/);
  assert.ok(response.headers.get("content-disposition").includes(`Ordem_de_Culto_${date.split("-").reverse().join("-")}.pdf`));
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
  fs.writeFileSync(path.join(output, filename), bytes);
}
async function dragSong(page, title, targetId) {
  const handle = page.getByTestId(`drag-${title}`);
  await handle.scrollIntoViewIfNeeded();
  const from = await handle.boundingBox();
  const to = await page.getByTestId(`sortable-${targetId}`).boundingBox();
  await page.mouse.move(from.x + 12, from.y + 12);
  await page.mouse.down();
  await page.mouse.move(to.x + 12, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
}
async function main() {
  let healthy = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { healthy = (await fetch("http://127.0.0.1:3010/health")).ok; } catch { /* The isolated server may still be starting. */ }
    if (healthy) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.ok(healthy, "API de testes não iniciou na porta 3010");
  const db = new Client({ connectionString: settings.DATABASE_URL });
  await db.connect();
  let browser;
  let page;
  try {
    phase("database-and-api");
    const migration = await db.query('SELECT finished_at FROM "_prisma_migrations" WHERE migration_name=$1 AND rolled_back_at IS NULL', ["20261018120000_worship_orders"]);
    assert.ok(migration.rows[0]?.finished_at);
    report.checks.push("migration aplicada no banco isolado");
    const owner = await account("Ordem de Culto");
    // Confirm that the API actually writes to the guarded database before further mutations.
    const tenant = await db.query('SELECT id FROM "Tenant" WHERE id=$1', [owner.tenant.id]);
    assert.equal(tenant.rowCount, 1);
    report.tenantId = owner.tenant.id;
    report.checks.push("API conectada ao banco isolado confirmado por tenant criado");
    const ministry = await api("/ministries", { name: "[TESTE] Louvor de homologação" }, owner.token, "POST", 201);
    const artist = await api("/artists", { name: "[TESTE] Artista composto para homologação, integrante um e integrante dois " + crypto.randomBytes(3).toString("hex") }, owner.token, "POST", 201);
    const titles = [
      "[TESTE] 526 - Grandioso És Tu", "[TESTE] Música sem vídeo", "[TESTE] Comunhão",
      "[TESTE] Louvor", "[TESTE] Ofertório", "[TESTE] Pós-lúdio", "[TESTE] " + "Título longo com acentuação e espaçamento ".repeat(4),
    ];
    const songs = [];
    for (const [i, title] of titles.entries()) songs.push(await api("/songs", {
      title, artistId: artist.id, originalKey: "C", content: "[C] Conteúdo fictício de homologação.",
      ...(i === 1 ? {} : { videoUrl: "https://youtu.be/LaudaTest01" }),
    }, owner.token, "POST", 201));
    const makeSchedule = (title, date, ids) => api("/schedules", {
      title, date, ministryId: ministry.id, songIds: ids, assignments: [],
    }, owner.token, "POST", 201);
    const date = "2026-10-20";
    const morning = await makeSchedule("[TESTE] Manhã — homologação", `${date}T12:00:00Z`, songs.slice(0, 2).map((song) => song.id));
    const evening = await makeSchedule("[TESTE] Noite — homologação", `${date}T22:00:00Z`, songs.slice(2).map((song) => song.id));
    const payload = {
      morning: { scheduleId: morning.id, songs: songs.slice(0, 2).map((song, i) => ({ songId: song.id, moment: i ? "Ofertório" : "Comunhão" })) },
      evening: { scheduleId: evening.id, songs: songs.slice(2).map((song, i) => ({ songId: song.id, moment: ["Comunhão", "Louvor", "Louvor", "Ofertório", "Outro"][i], ...(i === 4 ? { momentDescription: "Encerramento de homologação", videoUrlOverride: "https://youtu.be/LaudaTest02" } : {}) })) },
    };
    const route = `/schedules/worship-order/${date}`;
    await api(route, { morning: payload.morning, evening: null }, owner.token, "PUT");
    await pdf(date, owner.token, "morning.pdf");
    await api(route, { morning: null, evening: payload.evening }, owner.token, "PUT");
    await pdf(date, owner.token, "evening.pdf");
    await api(route, payload, owner.token, "PUT");
    await pdf(date, owner.token, "both.pdf");
    const persisted = await api(route, undefined, owner.token);
    assert.deepEqual(persisted.morning.songs.map((entry) => entry.songId), payload.morning.songs.map((entry) => entry.songId));
    assert.equal(persisted.evening.songs[4].momentDescription, "Encerramento de homologação");
    assert.equal(persisted.evening.songs[4].videoUrlOverride, "https://youtu.be/LaudaTest02");
    report.checks.push("manhã, noite e ambos: persistência e exportação reais", "música sem vídeo, título longo, artista composto, Outro e override de vídeo");

    const outsider = await account("Igreja externa");
    assert.equal(await api(route, undefined, outsider.token), null);
    await api(route, payload, outsider.token, "PUT", 404);
    await api(route, undefined, undefined, "GET", 401);
    const unsafe = structuredClone(payload);
    unsafe.morning.songs[0].videoUrlOverride = "javascript:alert(1)";
    await api(route, unsafe, owner.token, "PUT", 400);
    report.checks.push("isolamento entre igrejas, autenticação obrigatória e protocolo inseguro bloqueados");

    const manySongs = [...songs];
    for (let i = manySongs.length; i < 32; i++) manySongs.push(await api("/songs", {
      title: `[TESTE] ${i + 1} - ` + "Título longo para conferir paginação com conteúdo completo ".repeat(3),
      artistId: artist.id, originalKey: "C", content: "[C] Conteúdo fictício.", videoUrl: "https://youtu.be/LaudaTest01",
    }, owner.token, "POST", 201));
    const longDate = "2026-10-21";
    const longSchedule = await makeSchedule("[TESTE] Relatório multipágina", `${longDate}T12:00:00Z`, manySongs.map((song) => song.id));
    await api(`/schedules/worship-order/${longDate}`, {
      morning: { scheduleId: longSchedule.id, songs: manySongs.map((song) => ({ songId: song.id, moment: "Louvor" })) }, evening: null,
    }, owner.token, "PUT");
    await pdf(longDate, owner.token, "long.pdf");
    report.checks.push("PDF multipágina com 32 músicas reais do banco de testes");

    browser = await chromium.launch({ channel: "chromium", headless: true });
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(30000);
    const errors = [], apiHosts = new Set();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => { if (request.url().includes("/api/")) apiHosts.add(new URL(request.url()).host); });
    // Fail closed for accidental remote API usage; no API responses are mocked.
    await page.route("**://api.laudaapp.com/**", (remote) => remote.abort());
    phase("browser-login");
    await page.goto(`${webBase}/login`, { waitUntil: "networkidle", timeout: 120000 });
    await page.getByLabel("E-mail", { exact: true }).fill(owner.user.email);
    await page.getByLabel("Senha", { exact: true }).fill(owner.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.includes("login"), { timeout: 30000 });
    phase("browser-reorder-and-save");
    await page.goto(`${webBase}/schedules/worship-order?date=${date}`, { waitUntil: "domcontentloaded" });
    const title = songs[0].title;
    await page.setViewportSize({ width: 1440, height: 1800 });
    await dragSong(page, title, songs[1].id);
    await page.getByRole("button", { name: "Momento: Prelúdio", exact: true }).first().click();
    const saved = page.waitForResponse((response) => response.url().endsWith(route) && response.request().method() === "PUT");
    await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
    assert.equal((await saved).status(), 200);
    await page.getByText("Ordem de culto salva.", { exact: true }).waitFor();
    const changed = await api(route, undefined, owner.token);
    assert.equal(changed.morning.songs[0].songId, songs[1].id);
    assert.equal(changed.morning.songs[0].moment, "Prelúdio");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('[data-testid^="sortable-"]').first().getByText(songs[1].title, { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, "desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, "mobile-web.png"), fullPage: true });
    phase("browser-preview-and-download");
    const popupEvent = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Prévia do PDF", exact: true }).click();
    const popup = await popupEvent;
    await popup.waitForURL(/^blob:/);
    await popup.close();
    const downloaded = page.waitForEvent("download");
    const responseEvent = page.waitForResponse((response) => response.url().endsWith(`${route}/pdf`));
    await page.getByRole("button", { name: "Exportar PDF", exact: true }).click();
    const download = await downloaded;
    assert.equal(download.suggestedFilename(), "Ordem_de_Culto_20-10-2026.pdf");
    const downloadedBytes = fs.readFileSync(await download.path());
    assert.deepEqual(downloadedBytes, await (await responseEvent).body());
    fs.writeFileSync(path.join(output, "download.pdf"), downloadedBytes);
    assert.deepEqual(errors, []);
    assert.deepEqual([...apiHosts], ["127.0.0.1:3010"]);
    report.checks.push("login pela interface, reordenação, momento, salvamento e recarga sem mocks", "prévia e download com bytes idênticos aos recebidos da API", "interface desktop e mobile web, sem erros JavaScript ou chamadas à API de produção");
    phase("new-schedule-form-and-pdf");
    // Start from the same form reported by the user, rather than only testing the separate order editor.
    const formDate = "2026-10-22";
    // Detach prior runs' QA fixture only; no changes to the demonstration tenant or other schedules.
    const previousFormOrder = await api(`/schedules/worship-order/${formDate}`, undefined, owner.token);
    if (previousFormOrder?.morning) await api(`/schedules/${previousFormOrder.morning.id}`, {
      title: previousFormOrder.morning.title, date: previousFormOrder.morning.date, ministryId: ministry.id,
      songIds: previousFormOrder.morning.songs.map((entry) => entry.songId), assignments: [], worshipPeriod: null,
    }, owner.token, "PATCH");
    await page.setViewportSize({ width: 1440, height: 1800 });
    await page.goto(`${webBase}/schedules/new?date=${formDate}`, { waitUntil: "networkidle" });
    await page.getByTestId("schedule-title").fill("[TESTE] Culto criado pelo formulário integrado");
    await page.getByRole("button", { name: "Período: Culto da manhã", exact: true }).click();
    await page.getByRole("button", { name: "Adicionar músicas à escala", exact: true }).click();
    await page.getByLabel("Buscar músicas da escala", { exact: true }).fill(songs[0].title);
    await page.getByRole("button", { name: `Selecionar música ${songs[0].title}`, exact: true }).filter({ hasText: artist.name }).click();
    await page.getByLabel("Buscar músicas da escala", { exact: true }).fill(songs[1].title);
    await page.getByRole("button", { name: `Selecionar música ${songs[1].title}`, exact: true }).filter({ hasText: artist.name }).click();
    await page.getByText("Concluir", { exact: true }).click();
    await page.getByLabel("Buscar músicas da escala", { exact: true }).waitFor({ state: "hidden" });
    await dragSong(page, songs[0].title, songs[1].id);
    await page.getByRole("button", { name: "Momento: Ofertório", exact: true }).first().click();
    assert.equal(await page.getByLabel("YouTube desta participação", { exact: true }).count(), 0);
    await page.screenshot({ path: path.join(output, "new-schedule-form.png"), fullPage: true });
    const createdEvent = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/schedules" && response.request().method() === "POST");
    await page.getByRole("button", { name: "Criar escala e abrir Ordem de Culto", exact: true }).click();
    const createResponse = await createdEvent;
    assert.equal(createResponse.status(), 201);
    const createdForm = (await createResponse.json()).data;
    assert.equal(createdForm.songs[0].moment, "Ofertório");
    assert.deepEqual(createdForm.songs.map((entry) => entry.songId), [songs[1].id, songs[0].id]);
    assert.equal(createdForm.songs[0].videoUrlOverride, null);
    assert.deepEqual(createdForm.morningOrders, [{ date: formDate }]);
    await page.waitForURL((url) => url.pathname === "/schedules/worship-order" && url.searchParams.get("date") === formDate);
    const formDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar PDF", exact: true }).click();
    await (await formDownload).saveAs(path.join(output, "created-from-form.pdf"));
    await page.goto(`${webBase}/schedules/${createdForm.id}/edit`, { waitUntil: "networkidle" });
    await dragSong(page, songs[1].title, songs[0].id);
    await page.getByRole("button", { name: "Momento: Outro", exact: true }).first().click();
    await page.getByLabel("Descrição do momento", { exact: true }).fill("Encerramento cadastrado na edição da escala");
    await page.screenshot({ path: path.join(output, "edit-schedule-form.png"), fullPage: true });
    await page.getByRole("button", { name: "Salvar e abrir Ordem de Culto em PDF", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/schedules/worship-order" && url.searchParams.get("date") === formDate);
    const editedOrder = await api(`/schedules/worship-order/${formDate}`, undefined, owner.token);
    assert.deepEqual(editedOrder.morning.songs.map((entry) => entry.songId), [songs[0].id, songs[1].id]);
    assert.equal(editedOrder.morning.songs[0].moment, "Outro");
    assert.equal(editedOrder.morning.songs[0].momentDescription, "Encerramento cadastrado na edição da escala");
    await pdf(formDate, owner.token, "edited-from-form.pdf");
    assert.deepEqual(errors, []);
    report.checks.push("drag-and-drop real na ordem, no cadastro e na edição: sequência persistida", "cadastro real da escala: período e momento persistidos, vídeo do repertório e PDF exportado", "edição real da escala: descrição de Outro preservada e acesso direto ao PDF");
    report.status = "passed";
  } catch (error) {
    if (page) {
      report.failedPage = { url: page.url(), text: (await page.locator("body").innerText()).slice(0, 1800) };
      await page.screenshot({ path: path.join(output, "failed.png"), fullPage: true }).catch(() => {});
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    await db.end();
  }
}
main().catch((error) => { report.status = "failed"; report.error = error.message; process.exitCode = 1; })
  .finally(() => { report.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(output, "acceptance.json"), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); });
