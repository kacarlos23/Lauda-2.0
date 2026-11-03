import { expect, test, type Page } from "@playwright/test";

const songId = "33333333-3333-4333-8333-333333333333";
const artist = { id: "11111111-1111-4111-8111-111111111111", name: "Músico de teste" };
const initialContent = "{comment: Refrão}\n[C]Vou te cantar\nCom todo o meu coração\n\n[G] [Am]";
const corruption = /\uFFFD|[\u0080-\u009f]|\u00c3[\u0080-\u00bf]|\u00c2[\u0080-\u00bf]|\u00e2\u20ac/;

async function setup(page: Page, content = initialContent) {
  const user = { id: "visual-user", name: "Usuário de teste", email: "visual@example.invalid", tenantId: "visual-tenant", role: "TENANT_ADMIN" };
  const tenant = { id: user.tenantId, name: "Igreja de teste" };
  let song = { id: songId, title: "Canção de comunhão", artist, artistId: artist.id, originalKey: "C", content, comments: null, bpm: null, composer: null, videoUrl: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
  const saves: Array<{ content: string }> = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(({ user, tenant }) => {
    localStorage.setItem("auth_token", "visual-test-token");
    localStorage.setItem("refresh_token", "visual-refresh-token");
    localStorage.setItem("auth_user", JSON.stringify(user));
    localStorage.setItem("auth_tenant", JSON.stringify(tenant));
  }, { user, tenant });
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let data: unknown = [];
    if (path === `/api/songs/${songId}`) {
      if (request.method() === "PATCH") { const payload = request.postDataJSON(); saves.push(payload); song = { ...song, ...payload }; }
      data = song;
    } else if (path === "/api/auth/me") data = { user, tenant };
    else if (path === "/api/songs" || path === "/api/artists") data = { items: path.endsWith("songs") ? [song] : [artist], pagination: { page: 1, total: 1, totalPages: 1 } };
    else if (path === "/api/notifications/realtime-ticket") { await route.fulfill({ status: 503, json: { success: false, error: "Realtime indisponível no teste" } }); return; }
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto(`/songs/${songId}/edit`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("visual-chord-editor")).toBeVisible();
  return { saves, saved: () => song, errors };
}

for (const width of [390, 1440]) {
  test(`editor visual salva acordes e remove linhas sem caracteres quebrados em ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const api = await setup(page);
    await page.getByRole("button", { name: "Selecionar acorde G", exact: true }).click();
    await page.getByTestId("visual-letter-1-10").click();
    const inserted = initialContent.replace("cantar", "can[G]tar");
    expect(api.saves).toHaveLength(0);
    await page.getByTestId("visual-remove-line-1").click();
    await expect(page.getByRole("dialog", { name: "Remover linha 2?", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await page.getByTestId("visual-remove-line-1").click();
    await page.getByRole("button", { name: "Remover linha", exact: true }).click();
    await page.getByRole("button", { name: "Desfazer alteração da cifra", exact: true }).click();
    await page.getByTestId("visual-remove-line-3").click();
    const expected = inserted.replace("\n\n", "\n");
    await page.getByRole("tab", { name: "Texto ChordPro", exact: true }).click();
    await expect(page.getByTestId("song-chord-input")).toHaveValue(expected);
    await page.getByRole("tab", { name: "Prévia", exact: true }).click();
    await expect(page.getByLabel("Cifra da música", { exact: true })).toContainText("coração");
    await page.getByRole("tab", { name: "Visual", exact: true }).click();
    expect(await page.locator("body").innerText()).not.toMatch(corruption);
    const labels = await page.locator("[aria-label]").evaluateAll(elements => elements.map(element => element.getAttribute("aria-label")).join("\n"));
    expect(labels).not.toMatch(corruption);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`visual-editor-${width}.png`) });
    await page.getByTestId("song-save-button").click();
    await expect(page).toHaveURL(new RegExp(`/songs/${songId}$`));
    expect(api.saves).toHaveLength(1);
    expect(api.saved().content).toBe(expected);
    await page.goto(`/songs/${songId}/edit`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "Texto ChordPro", exact: true }).click();
    await expect(page.getByTestId("song-chord-input")).toHaveValue(expected);
    expect(api.errors).toEqual([]);
  });

  test(`conversão tradicional preserva acentos e exige aplicação explícita em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const original = "Intro\nC  G/B (2x)\n\nC      G\nVou te cantar\n";
    const api = await setup(page, original);
    await page.getByRole("button", { name: "Conferir conversão", exact: true }).click();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    expect(api.saved().content).toBe(original);
    await page.getByRole("button", { name: "Conferir conversão", exact: true }).click();
    await page.getByRole("button", { name: "Aplicar conversão", exact: true }).click();
    await page.getByRole("tab", { name: "Texto ChordPro", exact: true }).click();
    await expect(page.getByTestId("song-chord-input")).toHaveValue("Intro\n[C]  [G/B] (2x)\n\n[C]Vou te [G]cantar\n");
    expect(api.saves).toHaveLength(0);
    expect(await page.locator("body").innerText()).not.toMatch(corruption);
    expect(api.errors).toEqual([]);
  });
}
