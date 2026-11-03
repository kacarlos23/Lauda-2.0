import { expect, test, type Page } from "@playwright/test";

const artist = { id: "11111111-1111-4111-8111-111111111111", name: "João & Maria", imageUrl: null };
const songId = "22222222-2222-4222-8222-222222222222";
const content = "Capotraste: 4ª casa\n\n[Intro] D9  F#m\n\nD9          G/B\n  Canção de comunhão\n";
const imported = { title: "Canção de comunhão", artist: artist.name, originalKey: "F#", cifraUrl: "https://www.cifraclub.com.br/joao-e-maria/cancao/", content: "\uFEFF" + content.replace("[Intro]", "\u200B[Intro]"), source: "page-fallback" };

async function setup(page: Page, failFirstSearch = false) {
  let saved: any = null;
  let writes = 0;
  let searches = 0;
  await page.addInitScript(() => {
    localStorage.setItem("auth_token", "test.jwt.token");
    localStorage.setItem("refresh_token", "refresh.token");
    localStorage.setItem("auth_user", JSON.stringify({ id: "user-1", name: "Administrador", email: "user@example.com", tenantId: "tenant-1", role: "TENANT_ADMIN" }));
    localStorage.setItem("auth_tenant", JSON.stringify({ id: "tenant-1", name: "Igreja de teste" }));
  });
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/songs/cifra-club/search") {
      searches++;
      if (failFirstSearch && searches === 1) {
        await route.fulfill({ status: 503, json: { success: false, error: "Não foi possível concluir a busca no Cifra Club. Tente novamente." } });
      } else await route.fulfill({ json: { success: true, data: { items: [{ title: imported.title, artist: artist.name, url: imported.cifraUrl }] } } });
      return;
    }
    if (path === "/api/songs/cifra-club/import") {
      expect(request.postDataJSON()).toEqual({ url: imported.cifraUrl });
      await route.fulfill({ json: { success: true, data: imported } });
      return;
    }
    if (path === "/api/artists") {
      expect(request.method()).toBe("GET");
      await route.fulfill({ json: { success: true, data: { items: [artist], pagination: { total: 1, page: 1, limit: 100, totalPages: 1 } } } });
      return;
    }
    if (path === "/api/songs" && request.method() === "POST") {
      writes++;
      saved = { ...request.postDataJSON(), id: songId, artist, artistId: artist.id };
      await route.fulfill({ status: 201, json: { success: true, data: saved } });
      return;
    }
    if (path === `/api/songs/${songId}`) {
      await route.fulfill({ json: { success: true, data: saved } });
      return;
    }
    await route.fulfill({ json: { success: true, data: { items: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } } } });
  });
  return { saved: () => saved, writes: () => writes };
}

for (const width of [390, 1440]) {
  test(`busca, prévia, aplicação e salvamento da cifra preservam acentos, espaços e capotraste em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await setup(page);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/songs/new");
    await page.getByTestId("song-title-input").fill("Canção de comunhão");
    await page.getByTestId("song-cifra-club-search-button").click();
    await page.getByRole("button", { name: "Importar Canção de comunhão de João & Maria" }).click();
    await expect(page.getByText("Prévia da cifra", { exact: true })).toBeVisible();
    await expect(page.getByText(/Capotraste: 4ª casa/)).toBeVisible();
    expect(state.writes()).toBe(0);
    await page.getByRole("button", { name: "Usar esta cifra", exact: true }).click();
    await page.getByRole("tab", { name: "Texto ChordPro", exact: true }).click();
    await expect(page.getByTestId("song-chord-input")).toHaveValue(content);
    expect(state.writes()).toBe(0);
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/\uFFFD|\u00C3[\u00A3\u00A7\u00A9]|\u00C2\u00AA/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`cifra-club-${width}.png`), fullPage: true });
    await page.getByTestId("song-save-button").click();
    await expect(page).toHaveURL(new RegExp(`/songs/${songId}$`));
    expect(state.saved()).toMatchObject({ title: imported.title, originalKey: "F#", content, cifraUrl: imported.cifraUrl, artistId: artist.id });
    expect(state.writes()).toBe(1);
    await page.reload();
    await expect(page.getByTestId("current-key")).toContainText("F#");
    expect(errors).toEqual([]);
  });
}

test("falha externa permite fechar, preservar os dados e buscar novamente", async ({ page }) => {
  await setup(page, true);
  await page.goto("/songs/new");
  await page.getByTestId("song-title-input").fill("Canção de comunhão");
  await page.getByTestId("song-cifra-club-search-button").click();
  await expect(page.getByText("Não foi possível concluir a busca no Cifra Club. Tente novamente.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fechar importação do Cifra Club" }).click();
  await expect(page.getByTestId("song-title-input")).toHaveValue("Canção de comunhão");
  await page.getByTestId("song-cifra-club-search-button").click();
  await expect(page.getByRole("button", { name: "Importar Canção de comunhão de João & Maria" })).toBeVisible();
});
