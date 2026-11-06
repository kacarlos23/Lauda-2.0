import { expect, test, type Page } from "@playwright/test";

const songId = "ac510000-0000-4000-8000-000000000001";
const content = [
  "\u200B[Intro] G  D/F#",
  "",
  "\u200BG7/B       C7M(9)",
  "A letra editada permanece inteira e com seus espaços.",
  "[Final]",
  `G${" ".repeat(75)}D`,
  `Uma linha longa ${"preserva as colunas ".repeat(12)}`,
  "\u200BG\tD",
  "Texto com tabulação na linha de acordes.",
  "e|------0-----|",
  "B|----1-------|",
  "G|--0---------|",
].join("\n");

async function setup(page: Page) {
  let song = { id: songId, title: "Cifra tradicional de teste", originalKey: "G", content,
    artistId: "artist", artist: { id: "artist", name: "Artista de teste" }, createdAt: "", updatedAt: "" };
  await page.addInitScript(() => {
    localStorage.setItem("auth_token", "test.jwt.token");
    localStorage.setItem("refresh_token", "test.refresh.token");
    localStorage.setItem("auth_user", JSON.stringify({ id: "user", tenantId: "tenant", name: "Teste", role: "TENANT_ADMIN" }));
    localStorage.setItem("auth_tenant", JSON.stringify({ id: "tenant", name: "Teste de cifras" }));
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let data: unknown = [];
    if (path === `/api/songs/${songId}`) {
      if (request.method() === "PATCH") song = { ...song, ...request.postDataJSON() };
      data = song;
    }
    if (path === "/api/songs") data = { items: [song], pagination: { page: 1, totalPages: 1, total: 1, limit: 20 } };
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto(`/songs/${songId}`);
  await expect(page.getByTestId("traditional-sheet-scroll")).toBeVisible();
  return { saved: () => song };
}

for (const width of [390, 1440]) {
  test(`preserva linhas e colunas, transpõe e salva cifra tradicional em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const api = await setup(page);
    await expect(page.getByTestId(/^traditional-row-/)).toHaveCount(12);
    await expect(page.getByTestId("traditional-row-0")).toHaveText("[Intro] G  D/F#");
    await expect(page.getByTestId("traditional-row-7")).toHaveText("G       D");
    const row = page.getByTestId("traditional-row-6");
    const rowBox = await row.boundingBox();
    const shortBox = await page.getByTestId("traditional-row-3").boundingBox();
    expect(rowBox!.height).toBeCloseTo(shortBox!.height, 0);
    const scroller = page.getByTestId("traditional-sheet-scroll");
    expect(rowBox!.width).toBeGreaterThan((await scroller.boundingBox())!.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.getByTestId("traditional-scroll-hint")).toBeVisible();
    expect(await scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    await scroller.evaluate((element) => { element.scrollLeft = 200; });
    expect(await scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await scroller.evaluate((element) => { element.scrollLeft = 0; });

    await page.getByTestId("font-up").click();
    await expect(row).toHaveCSS("font-size", "18px");
    await page.getByTestId("transpose-up").click();
    await expect(page.getByTestId("traditional-row-0")).toHaveText("[Intro] G# D#/G");
    await expect(page.getByTestId("traditional-row-2")).toHaveText("G#7/C      C#7M(9)");
    await expect(page.getByTestId("traditional-row-4")).toHaveText("[Final]");
    await expect(page.getByTestId("traditional-row-11")).toHaveText("G|--0---------|");
    const displayed = await page.getByTestId(/^traditional-row-/).allTextContents();
    await page.getByTestId("save-default-key").click();
    await expect(page.getByTestId("default-key-success")).toHaveText("Tom G# salvo como padrão.");
    expect(api.saved().content).not.toContain("\u200B");
    expect(api.saved().content).toContain("[Final]");
    expect(api.saved().content).toContain("A letra editada permanece inteira e com seus espaços.");
    expect(api.saved().content).toContain("G|--0---------|");
    expect(await page.getByTestId(/^traditional-row-/).allTextContents()).toEqual(displayed);
    await page.screenshot({ path: `test-results/traditional-chords/synthetic-${width}.png`, fullPage: true });

    await page.reload();
    await expect(page.getByTestId("current-key")).toContainText("G#");
    expect(await page.getByTestId(/^traditional-row-/).allTextContents()).toEqual(displayed);
    await page.getByLabel("Editar música", { exact: true }).click();
    await page.getByRole("tab", { name: "Texto ChordPro", exact: true }).click();
    const editor = page.getByTestId("song-chord-input");
    await expect(editor).toHaveValue(api.saved().content);
    await expect(editor).toHaveCSS("white-space", "pre");
    expect(await editor.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  });
}

