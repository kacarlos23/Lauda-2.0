import { expect, test, type Page } from "@playwright/test";

const song = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "Depois da Guerra",
  composer: null,
  originalKey: "G",
  content: "[G]Depois da [D]guerra",
  bpm: 92,
  videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  artistId: "11111111-1111-4111-8111-111111111111",
  artist: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Oficina G3",
    imageUrl: null,
  },
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

async function prepareSong(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("auth_token", "test.jwt.token");
    localStorage.setItem("refresh_token", "refresh.token");
    localStorage.setItem("auth_user", JSON.stringify({
      id: "user-1",
      name: "Usuario",
      email: "user@example.com",
      tenantId: "tenant-1",
      role: "TENANT_ADMIN",
    }));
    localStorage.setItem("auth_tenant", JSON.stringify({ id: "tenant-1", name: "Igreja Teste" }));
  });

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === `/api/songs/${song.id}`) {
      await route.fulfill({ json: { success: true, data: song } });
      return;
    }
    await route.fulfill({ json: { success: true, data: [] } });
  });

  await page.route("https://www.youtube.com/**", (route) => route.fulfill({
    contentType: "text/html",
    body: "<!doctype html><title>Player mockado</title>",
  }));
}

test("carrega o player somente após o clique e preserva a cifra em desktop e mobile", async ({ page }) => {
  await prepareSong(page);
  await page.goto(`/songs/${song.id}`);

  const playerCard = page.getByTestId("youtube-player-card");
  const iframe = page.getByTestId("youtube-player-iframe");
  await expect(playerCard).toBeVisible();
  await expect(page.getByTestId("youtube-player-placeholder")).toBeVisible();
  await expect(iframe).toHaveCount(0);
  await expect(page.getByTestId("auto-scroll")).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir Depois da Guerra no YouTube" })).toBeVisible();

  await page.getByRole("button", { name: "Reproduzir vídeo de Depois da Guerra" }).click();
  await expect(iframe).toHaveAttribute(
    "src",
    "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1"
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(playerCard).toBeVisible();
  await expect(page.getByTestId("auto-scroll")).toBeVisible();

  const box = await playerCard.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(390);
  expect(box!.height).toBeGreaterThanOrEqual(200);
});
