"use strict";

// Real acceptance on the existing public staging environment; never initializes it.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Pool } = require("pg");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
const stage = process.env.LAUDA_STAGING_ROOT || "C:\\Users\\092687\\.codex\\worktrees\\public-test-environment\\Lauda 2.0";
const { readConfig } = require(path.join(stage, "scripts/public-test-config.cjs"));
const url = "https://testes.laudaapp.com";
const output = path.join(root, "test-results/worship-readings");
fs.mkdirSync(output, { recursive: true });
const date = "2026-11-08";
const readingA = "João 3:16\nPorque Deus amou o mundo.\n\nLeitura de validação com acentuação.";
const readingB = "Salmo 23:1\nO Senhor é meu pastor; nada me faltará.";
const checks = [];
const report = { url, date, checks };
function productionFingerprint() {
  const tables = ["Song", "Schedule", "ScheduleSong", "WorshipOrder"];
  const sql = tables.map(table => `SELECT '${table}', md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY id), '')) FROM "${table}" t`).join(";");
  const result = spawnSync("docker", ["exec", "lauda20-postgres-1", "psql", "-U", "postgres", "-d", "lauda2", "-Atc", sql], { encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
async function api(route, token, body, method = "GET", expected = 200) {
  const response = await fetch(`${url}/api${route}`, {
    method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  assert.equal(response.status, expected, `${method} ${route}: ${text.slice(0, 500)}`);
  return JSON.parse(text).data;
}
async function savePdf(token, name) {
  const response = await fetch(`${url}/api/schedules/worship-order/${date}/pdf`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200, await response.clone().text());
  assert.match(response.headers.get("content-type"), /application\/pdf/);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
  fs.writeFileSync(path.join(output, name), bytes);
}
async function drag(page, handleId, targetId) {
  const handle = page.getByTestId(handleId), target = page.getByTestId(targetId);
  await handle.scrollIntoViewIfNeeded();
  const from = await handle.boundingBox(), to = await target.boundingBox();
  assert(from && to);
  await page.mouse.move(from.x + 14, from.y + 14);
  await page.mouse.down();
  await page.mouse.move(to.x + 20, to.y + to.height / 2, { steps: 20 });
  await page.mouse.up();
}
async function main() {
  const pool = new Pool({ connectionString: readConfig().DATABASE_URL });
  const before = productionFingerprint();
  const productionRelease = await fetch("https://laudaapp.com/release.json").then(r => r.text());
  let tenantId, browser;
  try {
    const email = `worship-readings-${crypto.randomUUID()}@example.invalid`, password = `Test-${crypto.randomUUID()}!`;
    const owner = await api("/auth/register", undefined, { churchName: "[TESTE] Leituras e texto", name: "Validação de leituras", email, password }, "POST", 201);
    tenantId = owner.tenant.id;
    assert.equal((await pool.query('SELECT id FROM "Tenant" WHERE id=$1', [tenantId])).rowCount, 1);
    const token = owner.token || owner.accessToken;
    const wrongEnvironment = await fetch("https://api.laudaapp.com/api/auth/me", { headers: { authorization: `Bearer ${token}` } });
    assert.equal(wrongEnvironment.status, 401);
    const ministry = await api("/ministries", token, { name: "[TESTE] Ministério de validação" }, "POST", 201);
    const artist = await api("/artists", token, { name: "[TESTE] Artista de validação de leituras" }, "POST", 201);
    const songs = [];
    for (const title of ["[TESTE] Primeira canção", "[TESTE] Última canção", "[TESTE] Canção da noite"]) songs.push(await api("/songs", token, { title, artistId: artist.id, originalKey: "C", content: "[C]Canção para validação.", videoUrl: "https://youtu.be/LaudaTest01" }, "POST", 201));
    const morning = await api("/schedules", token, { title: "[TESTE] Celebração da esperança", date: `${date}T12:00:00Z`, ministryId: ministry.id, songIds: songs.slice(0, 2).map(s => s.id), assignments: [] }, "POST", 201);
    const evening = await api("/schedules", token, { title: "[TESTE] Encontro de gratidão", date: `${date}T22:00:00Z`, ministryId: ministry.id, songIds: [songs[2].id], assignments: [] }, "POST", 201);
    const payload = { morning: { scheduleId: morning.id, songs: songs.slice(0, 2).map((s, i) => ({ songId: s.id, moment: i ? "Louvor" : "Prelúdio" })) }, evening: { scheduleId: evening.id, songs: [{ songId: songs[2].id, moment: "Ofertório" }] } };
    const endpoint = `/schedules/worship-order/${date}`;
    await api(endpoint, token, payload, "PUT");
    await savePdf(token, "legacy.pdf");
    checks.push("Existing order without readings saved and exported; staging session rejected in production");
    // Full Chromium supports the PDF viewer; headless-shell does not.
    browser = await chromium.launch({ channel: "chromium", headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1800 }, permissions: ["clipboard-read", "clipboard-write"] });
    const page = await context.newPage();
    const errors = [], badRequests = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (new URL(request.url()).hostname === "api.laudaapp.com") badRequests.push(request.url()); });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.getByTestId("login-email").fill(email);
    await page.getByTestId("login-password").fill(password);
    await page.getByTestId("login-submit").click();
    await page.waitForURL(current => !current.pathname.includes("login"));
    await page.goto(`${url}/schedules/worship-order?date=${date}`, { waitUntil: "networkidle" });
    await page.getByText(morning.title, { exact: false }).waitFor();
    assert.equal(Math.round((await page.getByTestId("test-environment-banner").boundingBox()).height), 22);
    for (const text of [readingA, readingB]) {
      await page.getByRole("button", { name: "Adicionar leitura bíblica", exact: true }).first().click();
      assert.equal(await page.getByRole("textbox", { name: "Leitura bíblica", exact: true }).count(), 1);
      await page.getByRole("textbox", { name: "Leitura bíblica", exact: true }).fill(text);
      await page.getByRole("button", { name: "Concluir leitura", exact: true }).click();
    }
    await page.getByRole("button", { name: "Mover leitura 3 para cima", exact: true }).click();
    await drag(page, "drag-leitura 4", `sortable-${songs[0].id}`);
    await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
    await page.getByText("Ordem de culto salva.", { exact: true }).waitFor();
    const saved = await api(endpoint, token);
    assert.deepEqual(saved.morning.readings.map(r => [r.text, r.position]), [[readingB, 0], [readingA, 2]]);
    assert.deepEqual(saved.morning.songs.map(s => s.songId), songs.slice(0, 2).map(s => s.id));
    const databaseReadings = (await pool.query('SELECT readings FROM "Schedule" WHERE id=$1 AND "tenantId"=$2', [morning.id, tenantId])).rows[0].readings;
    assert.deepEqual(databaseReadings, saved.morning.readings);
    checks.push("Single text field; readings moved with arrow and real drag among songs; exact text/newlines/order persisted in isolated PostgreSQL");
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.getByText(readingA, { exact: true }).count(), 1);
    assert.equal(await page.getByText(readingB, { exact: true }).count(), 1);
    await page.screenshot({ path: path.join(output, "public-desktop.png"), fullPage: true });
    const expectedText = `ORDEM DE CULTO · 08/11/2026\n\nCULTO DA MANHÃ\n${morning.title}\nLeitura bíblica:\n${readingB}\nPrelúdio · ${songs[0].title}\nLeitura bíblica:\n${readingA}\nLouvor · ${songs[1].title}\n\nCULTO DA NOITE\n${evening.title}\nOfertório · ${songs[2].title}`;
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.getByRole("button", { name: "Visualizar texto", exact: true }).click();
      assert.equal(await page.getByTestId("worship-order-text").innerText(), expectedText);
      await page.getByRole("button", { name: "Copiar texto", exact: true }).click();
      await page.getByText("Texto copiado.", { exact: true }).waitFor();
      // Windows normalizes clipboard line endings to CRLF; stored text stays exact.
      const clipboard = await page.evaluate(() => navigator.clipboard.readText());
      assert.equal(clipboard.replace(/\r\n/g, "\n"), expectedText);
      await page.waitForTimeout(350); // Let React Native's modal fade finish for visual inspection.
      await page.screenshot({ path: path.join(output, `public-text-${width}.png`), fullPage: true });
      await page.getByRole("button", { name: "Fechar texto", exact: true }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(Math.round((await page.getByTestId("test-environment-banner").boundingBox()).height), 22);
    }
    fs.writeFileSync(path.join(output, "shared-text.txt"), expectedText);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar PDF", exact: true }).click();
    const download = await downloadPromise;
    await download.saveAs(path.join(output, "public-download.pdf"));
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Prévia do PDF", exact: true }).click();
    const popup = await popupPromise;
    // PDF viewers can abort an HTML load after committing the blob navigation.
    await popup.waitForURL(/^blob:/, { waitUntil: "commit" }); await popup.close();
    checks.push("Public desktop/mobile reload, both explicit periods, exact clipboard contents, PDF download and preview, 22px banner and no horizontal overflow");
    await api(endpoint, token, { morning: null, evening: { ...payload.evening, readings: [{ id: "evening-reading", text: readingB, position: 0 }] } }, "PUT");
    await savePdf(token, "evening.pdf");
    await api(endpoint, token, { morning: { ...payload.morning, songs: [], readings: [{ id: "only", text: readingA, position: 0 }] }, evening: null }, "PUT");
    await savePdf(token, "reading-only.pdf");
    const longText = "Salmo de validação\n" + Array.from({ length: 180 }, (_, i) => `Linha ${String(i + 1).padStart(3, "0")} da leitura extensa com acentuação.`).join("\n");
    await api(endpoint, token, { morning: { ...payload.morning, readings: [{ id: "long", text: longText, position: 1 }] }, evening: null }, "PUT");
    await savePdf(token, "long-reading.pdf");
    checks.push("Public PDF generation for evening only, reading only and long multipage reading between songs");
    assert.deepEqual(errors, []); assert.deepEqual(badRequests, []);
    assert.equal(productionFingerprint(), before);
    assert.equal(await fetch("https://laudaapp.com/release.json").then(r => r.text()), productionRelease);
    report.productionCatalogAndOrdersUnchanged = true;
    report.productionReleaseUnchanged = true;
    report.release = await fetch(`${url}/release.json`).then(r => r.json());
    checks.push("Production catalog, schedules, order sequences and release unchanged; no browser request to production API");
    report.verifiedAt = new Date().toISOString();
    report.status = "passed";
  } catch (error) {
    report.status = "failed"; report.error = error.message;
    const page = browser?.contexts()[0]?.pages()[0];
    if (page) await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await browser?.close();
    if (tenantId) {
      assert.equal((await pool.query('SELECT name FROM "Tenant" WHERE id=$1', [tenantId])).rows[0]?.name, "[TESTE] Leituras e texto");
      await pool.query('DELETE FROM "Tenant" WHERE id=$1', [tenantId]);
      assert.equal((await pool.query('SELECT id FROM "Tenant" WHERE id=$1', [tenantId])).rowCount, 0);
      report.temporaryTenantRemoved = true;
    }
    await pool.end();
    fs.writeFileSync(path.join(output, "public-verification.json"), JSON.stringify(report, null, 2));
  }
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
