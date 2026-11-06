import { expect, test, Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

async function setup(page: Page, options: { songPermission?: boolean; empty?: boolean; tooMany?: boolean } = {}) {
  const permissions = ["schedule:view", "schedule:edit", "schedule:view_reports", ...(options.songPermission === false ? [] : ["song:view"])];
  const user = { id: "user", name: "Líder", role: "MEMBER", tenantId: "tenant", permissions };
  const tenant = { id: "tenant", name: "Igreja" };
  await page.addInitScript(({ user, tenant }) => {
    localStorage.setItem("auth_token", "test-token");
    localStorage.setItem("auth_user", JSON.stringify(user));
    localStorage.setItem("auth_tenant", JSON.stringify(tenant));
  }, { user, tenant });
  const song = (id: string, order: number) => ({ songId: id, order, moment: "Louvor", song: { id, title: `Música ${id}`, originalKey: "C", artist: { name: "Artista" } } });
  const morning = { id: "morning", title: "Título da escala", date: "2026-11-08T12:00:00Z", songs: options.empty ? [] : options.tooMany ? Array.from({ length: 51 }, (_, i) => song(`song-${i}`, i)) : [song("b", 1), song("a", 0)] };
  const evening = { ...morning, id: "evening", songs: options.empty || options.tooMany ? [] : [song("b", 0), song("c", 1)] };
  const pdf = await fs.readFile(path.join(__dirname, "fixtures/worship-order.pdf"));
  const requests: unknown[] = [];
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/songs/export")) {
      requests.push(route.request().postDataJSON());
      await route.fulfill({ contentType: "application/pdf", body: pdf }); return;
    }
    let data: unknown = [];
    if (pathname.endsWith("/auth/me")) data = { user, tenant, permissions };
    if (pathname.endsWith("/schedules")) data = [morning, evening];
    if (pathname.endsWith("/worship-order/2026-11-08")) data = { date: "2026-11-08", morning, evening };
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto("/schedules/worship-order?date=2026-11-08", { waitUntil: "networkidle" });
  return { requests, pdf };
}

for (const width of [320, 390, 768, 1440]) {
  test(`ações cabem na tela e cifras dos dois períodos viram um PDF em ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 850 });
    const { requests, pdf } = await setup(page);
    const back = page.getByRole("button", { name: "Voltar às escalas", exact: true });
    await expect(back).toBeVisible();
    expect((await back.boundingBox())!.width).toBeLessThan(250);
    await expect(back).toHaveCSS("border-top-width", "1px");
    await expect(back).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    const actions = page.getByTestId("worship-document-actions");
    await actions.scrollIntoViewIfNeeded();
    for (const button of await actions.getByRole("button").all()) {
      const box = (await button.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`worship-actions-${width}.png`) });
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Gerar PDF das cifras", exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("Cifras_08-11-2026.pdf");
    expect((await fs.readFile((await file.path())!)).equals(pdf)).toBe(true);
    expect(requests).toEqual([{ songIds: ["a", "b", "c"] }]);
    // Changes to the order must be saved before exporting the booklet.
    await page.getByRole("button", { name: "Não incluir período", exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Gerar PDF das cifras", exact: true })).toBeDisabled();
  });
}

test("não exporta cifras sem músicas ou sem permissão", async ({ page }) => {
  await setup(page, { empty: true });
  await expect(page.getByRole("button", { name: "Gerar PDF das cifras", exact: true })).toBeDisabled();
  await page.unrouteAll({ behavior: "wait" });
  await setup(page, { songPermission: false });
  await expect(page.getByRole("button", { name: "Gerar PDF das cifras", exact: true })).toHaveCount(0);
});

test("informa o limite de 50 cifras sem enviar uma exportação inválida", async ({ page }) => {
  const { requests } = await setup(page, { tooMany: true });
  await page.getByRole("button", { name: "Gerar PDF das cifras", exact: true }).click();
  await expect(page.getByText("É possível exportar até 50 músicas por PDF.", { exact: true })).toBeVisible();
  expect(requests).toEqual([]);
});
