import { expect, test, type Page } from "@playwright/test";

const artist = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Oficina G3",
  imageUrl: null,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};
const song = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "Depois da Guerra",
  composer: null,
  originalKey: "G",
  content: "[G]Depois da [D]guerra",
  bpm: 92,
  artistId: artist.id,
  artist,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};
const createdSongId = "33333333-3333-4333-8333-333333333333";
const cifraClubResult = {
  title: "Autor da Vida",
  artist: "Oficina G3",
  url: "https://www.cifraclub.com.br/oficina-g3/autor-da-vida/",
  originalKey: "G",
};

async function authenticated(page: Page, role: "TENANT_ADMIN" | "MEMBER") {
  await page.addInitScript(({ role }) => {
    localStorage.setItem("auth_token", "test.jwt.token");
    localStorage.setItem("refresh_token", "refresh.token");
    localStorage.setItem("auth_user", JSON.stringify({ id: "user-1", name: "Usuario", email: "user@example.com", tenantId: "tenant-1", role }));
    localStorage.setItem("auth_tenant", JSON.stringify({ id: "tenant-1", name: "Igreja Teste" }));
  }, { role });
}

async function mockMusicApi(page: Page) {
  const songs = [song];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const songMatch = path.match(/^\/api\/songs\/([^/]+)$/);

    if (path === "/api/songs/export") {
      await route.fulfill({ status: 200, contentType: "application/pdf", body: Buffer.from("%PDF-test") });
      return;
    }
    if (path === "/api/songs/cifra-club/search" && request.method() === "GET") {
      await route.fulfill({ json: { success: true, data: { items: [cifraClubResult] } } });
      return;
    }
    if (path === "/api/songs" && request.method() === "GET") {
      await route.fulfill({
        json: {
          success: true,
          data: { items: songs, pagination: { page: 1, limit: 20, total: songs.length, totalPages: 1 } },
        },
      });
      return;
    }
    if (songMatch && request.method() === "GET") {
      const found = songs.find((item) => item.id === songMatch[1]);
      await route.fulfill({
        status: found ? 200 : 404,
        json: found ? { success: true, data: found } : { success: false, error: "Música não encontrada" },
      });
      return;
    }
    if (path === "/api/songs" && request.method() === "POST") {
      const payload = request.postDataJSON();
      const created = { ...song, ...payload, id: createdSongId, artist, artistId: artist.id, createdAt: "2026-01-02", updatedAt: "2026-01-02" };
      songs.push(created);
      await route.fulfill({ status: 201, json: { success: true, data: created } });
      return;
    }
    if (songMatch && request.method() === "PATCH") {
      const payload = request.postDataJSON();
      const index = songs.findIndex((item) => item.id === songMatch[1]);
      if (index >= 0) songs[index] = { ...songs[index], ...payload, updatedAt: "2026-01-03" };
      await route.fulfill({
        status: index >= 0 ? 200 : 404,
        json: index >= 0 ? { success: true, data: songs[index] } : { success: false, error: "Música não encontrada" },
      });
      return;
    }
    if (path === "/api/artists" && request.method() === "GET") {
      await route.fulfill({ json: { success: true, data: { items: [artist], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } } } });
      return;
    }
    if (path === `/api/artists/${artist.id}` && request.method() === "PATCH") {
      Object.assign(artist, request.postDataJSON());
      await route.fulfill({ json: { success: true, data: artist } });
      return;
    }
    await route.fulfill({ json: { success: true, data: [] } });
  });
}

async function openSongs(page: Page) {
  await page.getByRole("link", { name: /M.*sicas/ }).click();
}

test("admin cria e edita cifra sem recarregar lista, edita artista e baixa PDF", async ({ page }) => {
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
  await page.getByTestId("song-save-button").last().click();
  await expect(page).toHaveURL(new RegExp(`/songs/${createdSongId}$`));
  await expect(page.getByTestId("current-key")).toContainText("C");
  await expect(page.getByTestId("transpose-down")).toHaveText("−1 Tom");
  await expect(page.getByTestId("font-down")).toHaveText("A−");
  await expect(page.getByTestId("scroll-speed")).toHaveText("1.00×");
  await page.getByTestId("transpose-up").click();
  await expect(page.getByTestId("current-key")).toContainText("C#");
  await page.getByTestId("font-up").click();
  await expect(page.getByText("18px", { exact: true })).toBeVisible();
  await expect(page.getByTestId("auto-scroll")).toBeVisible();

  await page.getByTestId("app-back-button-compact").click();
  await expect(page).toHaveURL(/\/songs$/);
  await page.getByTestId(`song-row-${song.id}`).click();
  await expect(page.getByTestId("current-key")).toContainText("G");
  await page.getByTestId("app-back-button-compact").click();
  await page.getByTestId(`song-row-${createdSongId}`).click();
  await expect(page.getByTestId("current-key")).toContainText("C");

  await page.getByLabel("Editar música").click();
  await page.getByTestId("song-edit-metadata-button").last().click();
  await page.getByTestId("song-title-input").fill("Nova canção editada");
  await page.getByTestId("song-next-button").click();
  await page.getByTestId("song-save-button").last().click();
  await expect(page).toHaveURL(new RegExp(`/songs/${createdSongId}$`));
  await expect(page.getByText("Nova canção editada", { exact: true }).last()).toBeVisible();

  await page.getByTestId("app-back-button-compact").click();
  await expect(page).toHaveURL(/\/songs$/);
  await expect(page.getByText("Depois da Guerra", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("Nova canção editada", { exact: true }).last()).toBeVisible();

  await page.getByTestId(`song-row-${song.id}`).click();
  await expect(page).toHaveURL(new RegExp(`/songs/${song.id}$`));
  await expect(page.getByText("Depois da Guerra", { exact: true }).last()).toBeVisible();
  await expect(page.getByTestId("current-key")).toContainText("G");
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
  await page.getByLabel("Gerenciar artistas").last().click();
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

test("busca cifras com somente artista, somente música e com ambos", async ({ page }) => {
  await authenticated(page, "TENANT_ADMIN");
  await mockMusicApi(page);
  await page.goto("/");
  await openSongs(page);
  await page.getByLabel("Nova música").click();
  await expect(page.getByText("Etapa 1 de 2", { exact: true })).toBeVisible();

  await page.getByTestId("song-title-input").fill("Autor da Vida");
  const titleRequest = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/songs/cifra-club/search");
  await page.getByTestId("song-cifra-club-search-button").click();
  const titleUrl = new URL((await titleRequest).url());
  expect(titleUrl.searchParams.get("title")).toBe("Autor da Vida");
  expect(titleUrl.searchParams.has("artist")).toBe(false);
  await expect(page.getByLabel("Importar Autor da Vida de Oficina G3")).toBeVisible();
  await page.getByLabel("Fechar importação do Cifra Club").click();

  await page.getByTestId("song-title-input").fill("");
  await page.getByTestId("artist-search-input").fill("Oficina G3");
  const artistRequest = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/songs/cifra-club/search");
  await page.getByTestId("song-cifra-club-search-button").click();
  const artistUrl = new URL((await artistRequest).url());
  expect(artistUrl.searchParams.get("artist")).toBe("Oficina G3");
  expect(artistUrl.searchParams.has("title")).toBe(false);
  await expect(page.getByLabel("Importar Autor da Vida de Oficina G3")).toBeVisible();
  await page.getByLabel("Fechar importação do Cifra Club").click();

  await page.getByTestId("song-title-input").fill("Autor da Vida");
  const combinedRequest = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/songs/cifra-club/search");
  await page.getByTestId("song-cifra-club-search-button").click();
  const combinedUrl = new URL((await combinedRequest).url());
  expect(combinedUrl.searchParams.get("artist")).toBe("Oficina G3");
  expect(combinedUrl.searchParams.get("title")).toBe("Autor da Vida");
  await expect(page.getByLabel("Importar Autor da Vida de Oficina G3")).toBeVisible();
});
