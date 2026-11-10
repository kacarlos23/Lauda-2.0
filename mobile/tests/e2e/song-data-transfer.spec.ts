import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { SONG_TRANSFER_FIELDS } from "../../../src/constants/songTransferFields";

const ministryId = "11111111-1111-4111-8111-111111111111";
const transferOptions = { fields: [...SONG_TRANSFER_FIELDS], existing: "create" };
const catalog = {
  format: "lauda.music-catalog", version: 1,
  songs: [{ title: "Canção de adoração", artist: "Louvor", originalKey: "Am", content: "Am Dm E\nAdoração e louvor", cifraUrl: null, tags: ["Adoração", "Natal"] }],
};

async function setup(page: Page) {
  const commits: unknown[] = [];
  await page.addInitScript(() => {
    localStorage.setItem("auth_token", "test.token");
    localStorage.setItem("refresh_token", "test.refresh");
    localStorage.setItem("auth_user", JSON.stringify({ id: "user-1", name: "Admin", role: "TENANT_ADMIN", tenantId: "tenant-1" }));
    localStorage.setItem("auth_tenant", JSON.stringify({ id: "tenant-1", name: "Igreja Teste" }));
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/ministries") {
      await route.fulfill({ json: { success: true, data: [{ id: ministryId, name: "Louvor da manhã" }] } });
    } else if (path === "/api/songs/data-export") {
      expect(route.request().postDataJSON()).toEqual({ ministryId, fields: transferOptions.fields });
      await route.fulfill({ contentType: "application/json; charset=utf-8", body: JSON.stringify(catalog, null, 2) });
    } else if (path === "/api/songs/data-import/preview") {
      expect(route.request().postDataJSON()).toEqual({ ministryId, document: catalog, ...transferOptions });
      await route.fulfill({ json: { success: true, data: {
        documentHash: "a".repeat(64), total: 1, unique: 1,
        counts: { CREATE: 1, LINK: 0, RESTORE: 0, ALREADY_LINKED: 0, CONFLICT: 0, INVALID: 0 },
        items: [{ index: 0, title: catalog.songs[0].title, artist: "Louvor", status: "CREATE" }],
      } } });
    } else if (path === "/api/songs/data-import/commit") {
      commits.push(route.request().postDataJSON());
      await route.fulfill({ status: 201, json: { success: true, data: {
        created: 1, updated: 0, skipped: 0, linked: 1, restored: 0, alreadyLinked: 0, conflicts: 0, invalid: 0, total: 1, documentHash: "a".repeat(64),
      } } });
    } else if (path === "/api/songs" || path === "/api/artists") {
      await route.fulfill({ json: { success: true, data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } } });
    } else {
      await route.fulfill({ json: { success: true, data: [] } });
    }
  });
  await page.goto("/songs");
  await page.getByRole("button", { name: "Importar ou exportar músicas" }).click();
  await expect(page.getByText("Louvor da manhã", { exact: true })).toBeVisible();
  return commits;
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`exporta e reimporta o JSON com confirmação em ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const commits = await setup(page);
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar músicas do ministério" }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/^lauda-musicas-louvor-da-manha-.*\.json$/);
    const exported = await readFile((await download.path())!, "utf8");
    expect(JSON.parse(exported)).toEqual(catalog);

    const choosing = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Selecionar arquivo para revisar" }).click();
    await (await choosing).setFiles({ name: download.suggestedFilename(), mimeType: "text/plain", buffer: Buffer.from(`\uFEFF${exported}`) });
    await expect(page.getByText("Revisão concluída", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog").getByText("Nova música", { exact: true })).toBeVisible();
    expect((await page.getByRole("button", { name: "Selecionar arquivo para revisar" }).boundingBox())!.width).toBeLessThan(250);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: path.resolve("..", "test-results", "transfer-release", `transfer-review-${viewport.width}.png`), fullPage: true });
    await page.getByRole("button", { name: "Importar 1 músicas", exact: true }).click();
    await expect(page.getByText("Confirmar importação", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    expect(commits).toHaveLength(0);
    await page.getByRole("button", { name: "Importar 1 músicas", exact: true }).click();
    await page.getByRole("button", { name: "Importar", exact: true }).click();
    await expect(page.getByText("1 músicas criadas; 0 atualizadas; 1 vínculos adicionados; 0 restauradas. 0 já vinculadas; 0 ignoradas.", { exact: true })).toBeVisible();
    expect(commits).toEqual([{ ministryId, document: catalog, documentHash: "a".repeat(64), ...transferOptions }]);
  });
}

test("explica a recusa de JSON de outro formato sem tentar importar", async ({ page }) => {
  const commits = await setup(page);
  const choosing = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Selecionar arquivo para revisar" }).click();
  await (await choosing).setFiles({ name: "outro.json", mimeType: "application/json", buffer: Buffer.from("{}") });
  await expect(page.getByText(/Selecione um arquivo JSON de músicas exportado pelo Lauda/)).toBeVisible();
  expect(commits).toHaveLength(0);
});
