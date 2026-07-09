import { expect, test, type Page } from "@playwright/test";

const artist = { id: "11111111-1111-4111-8111-111111111111", name: "Oficina G3", imageUrl: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
const song = { id: "22222222-2222-4222-8222-222222222222", title: "Depois da Guerra", composer: null, originalKey: "G", content: "[G]Depois da [D]guerra", bpm: 92, artistId: artist.id, artist, createdAt: "2026-01-01", updatedAt: "2026-01-01" };

async function authenticated(page: Page, role: "TENANT_ADMIN" | "MEMBER") {
  await page.addInitScript(({ role }) => {
    localStorage.setItem("auth_token", "test.jwt.token");
    localStorage.setItem("refresh_token", "refresh.token");
    localStorage.setItem("auth_user", JSON.stringify({ id: "user-1", name: "Usuário", email: "user@example.com", tenantId: "tenant-1", role }));
    localStorage.setItem("auth_tenant", JSON.stringify({ id: "tenant-1", name: "Igreja Teste" }));
  }, { role });
}

async function mockMusicApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === "/api/songs/export") {
      await route.fulfill({ status: 200, contentType: "application/pdf", body: Buffer.from("%PDF-test") }); return;
    }
    if (path === "/api/songs" && request.method() === "GET") {
      await route.fulfill({ json: { success: true, data: { items: [song], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } } } }); return;
    }
    if (path === `/api/songs/${song.id}` && request.method() === "GET") {
      await route.fulfill({ json: { success: true, data: song } }); return;
    }
    if (path === "/api/songs" && request.method() === "POST") {
      await route.fulfill({ status: 201, json: { success: true, data: { ...song, ...request.postDataJSON() } } }); return;
    }
    if (path === "/api/artists" && request.method() === "GET") {
      await route.fulfill({ json: { success: true, data: { items: [artist], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } } } }); return;
    }
    if (path === `/api/artists/${artist.id}` && request.method() === "PATCH") {
      Object.assign(artist, request.postDataJSON());
      await route.fulfill({ json: { success: true, data: artist } }); return;
    }
    await route.fulfill({ json: { success: true, data: [] } });
  });
}

async function openSongs(page: Page) {
  await page.getByRole("link", { name: /M.*sicas/ }).click();
}

test("admin cria cifra, edita artista e baixa PDF", async ({ page }) => {
  await authenticated(page, "TENANT_ADMIN");
  await mockMusicApi(page);
  await page.goto("/");
  await openSongs(page);
  await expect(page.getByText("Depois da Guerra", { exact: true })).toBeVisible();

  await page.getByLabel("Nova música").click();
  await page.getByTestId("artist-search-input").fill("Oficina");
  await page.getByText("Oficina G3", { exact: true }).click();
  await page.getByTestId("song-title-input").fill("Nova canção");
  await page.getByTestId("song-next-button").click();
  await page.getByTestId("song-chord-input").fill("C\nNova cifra");
  await page.getByTestId("song-save-button").click();
  await expect(page).toHaveURL(new RegExp(`/songs/${song.id}$`));
  await expect(page.getByTestId("current-key")).toContainText("G");
  await page.getByTestId("transpose-up").click();
  await expect(page.getByTestId("current-key")).toContainText("G#");
  await page.getByTestId("font-up").click();
  await expect(page.getByText("18px", { exact: true })).toBeVisible();
  await expect(page.getByTestId("auto-scroll")).toBeVisible();

  await page.getByTestId("app-back-button-compact").click();
  await expect(page).toHaveURL(/\/songs$/);
  await page.getByLabel("Nova música").click();
  await expect(page.getByText("Etapa 1 de 2", { exact: true })).toBeVisible();
  await expect(page.getByTestId("artist-search-input")).toHaveValue("");
  await expect(page.getByTestId("song-title-input")).toHaveValue("");

  await page.goto("/");
  await openSongs(page);
  await page.getByText("Selecionar para PDF").click();
  await page.getByText("Depois da Guerra", { exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByText(/Exportar 1 cifra/).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/Cifras.*\.pdf/);

  await page.getByText("Cancelar seleção").click();
  await page.getByLabel("Gerenciar artistas").click();
  await page.getByLabel("Editar Oficina G3").click();
  await page.locator('input[value="Oficina G3"]').fill("Oficina G3 Atualizada");
  await page.getByText("Salvar", { exact: true }).click();
  await expect(page.getByText("Oficina G3 Atualizada", { exact: true })).toBeVisible();
});

test("membro consulta e exporta, mas não acessa criação ou edição", async ({ page }) => {
  await authenticated(page, "MEMBER");
  await mockMusicApi(page);
  await page.goto("/");
  await openSongs(page);
  await expect(page.getByText("Depois da Guerra", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Nova música")).toHaveCount(0);
  await page.goto("/songs/new");
  await expect(page).not.toHaveURL(/\/songs\/new$/);
  await expect(page.getByTestId("song-title-input")).toHaveCount(0);
  await page.goto(`/songs/${song.id}/edit`);
  await expect(page).not.toHaveURL(new RegExp(`/songs/${song.id}/edit$`));
  await expect(page.getByTestId("song-chord-input")).toHaveCount(0);
});
