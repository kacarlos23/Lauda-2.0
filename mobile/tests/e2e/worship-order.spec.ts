import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

test.use({ channel: "chromium" });

async function animatedDrag(page: import("@playwright/test").Page) {
  const handle = page.getByTestId("drag-526 - Grandioso És Tu");
  await handle.scrollIntoViewIfNeeded();
  const source = (await handle.boundingBox())!;
  const target = (await page.getByTestId("sortable-song-1").boundingBox())!;
  await page.mouse.move(source.x + 12, source.y + 12);
  await page.mouse.down();
  await page.mouse.move(source.x + 42, source.y + 112, { steps: 6 });
  await expect.poll(async () => Math.round((await handle.boundingBox())!.y - source.y)).toBe(100);
  expect(Math.round((await handle.boundingBox())!.x - source.x)).toBe(30);
  await page.mouse.move(target.x + 12, target.y + target.height / 2, { steps: 15 });
  // Observe real rendered frames, including the displaced card's return to zero.
  await page.evaluate(() => {
    const samples: number[] = [];
    (window as any).__sortableMotion = samples;
    const node = document.querySelector('[data-testid="sortable-motion-song-1"]')!;
    let remaining = 35;
    const frame = () => {
      samples.push(new DOMMatrixReadOnly(getComputedStyle(node).transform).m42);
      if (--remaining > 0) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => (window as any).__sortableMotion.length)).toBeGreaterThan(30);
  const samples: number[] = await page.evaluate(() => (window as any).__sortableMotion);
  expect(samples.some((y) => Math.abs(y) > 2)).toBe(true);
  expect(samples.filter((y) => Math.abs(y) > 2).length).toBeGreaterThan(2);
  expect(Math.abs(samples[samples.length - 1])).toBeLessThan(0.5);
}

for (const width of [390, 1440]) {
  test(`monta, reordena, salva, reabre e baixa a ordem em ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1800 });
    const permissions = ["schedule:create", "schedule:view", "schedule:edit", "schedule:view_reports", "song:view", "song:attach_to_schedule"];
    const user = { id: "user", name: "Líder", role: "TENANT_ADMIN", tenantId: "tenant", permissions };
    const tenant = { id: "tenant", name: "Igreja de Teste" };
    await page.addInitScript(({ user, tenant }) => {
      localStorage.setItem("auth_token", "test-token"); localStorage.setItem("refresh_token", "test-refresh");
      localStorage.setItem("auth_user", JSON.stringify(user)); localStorage.setItem("auth_tenant", JSON.stringify(tenant));
    }, { user, tenant });
    const songs = ["526 - Grandioso És Tu", "Cantarei Teu Amor"].map((title, order) => ({
      id: `entry-${order}`, songId: `song-${order}`, order, moment: "Louvor",
      song: { id: `song-${order}`, title, artist: { id: "artist", name: "Artista cadastrado" }, videoUrl: order ? null : "https://youtu.be/test" },
    }));
    const morning = { id: "123e4567-e89b-42d3-a456-426614174000", title: "Escala A", date: "2026-10-18T12:00:00Z", songs, ministryId: "ministry", tenantId: tenant.id };
    const evening = { ...morning, id: "123e4567-e89b-42d3-a456-426614174001", title: "Escala B", date: "2026-10-18T22:00:00Z", songs: [] };
    // Test HTTP transport independently; backend tests verify PDF rendering and links.
    const pdfBytes = await fs.readFile(path.join(__dirname, "fixtures/worship-order.pdf"));
    let saved: any = null, submitted: any = null;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let data: unknown = [];
      if (path === "/api/auth/me") data = { user, tenant, permissions };
      if (path === "/api/schedules") data = [morning, evening];
      if (path === "/api/ministries") data = [{ id: "ministry", name: "Louvor" }];
      if (path === "/api/songs") data = { items: songs.map((entry) => entry.song), pagination: { page: 1, totalPages: 1 } };
      if (path.endsWith("/worship-order/2026-10-18")) {
        if (route.request().method() === "PUT") {
          submitted = route.request().postDataJSON();
          saved = { date: "2026-10-18", churchName: tenant.name, morning: { ...morning, songs: submitted.morning.songs.map((entry: any, order: number) => ({ ...songs.find((song) => song.songId === entry.songId), ...entry, order })) }, evening: null };
        }
        data = saved;
      }
      if (path.endsWith("/pdf")) {
        await route.fulfill({ contentType: "application/pdf", body: pdfBytes }); return;
      }
      await route.fulfill({ json: { success: true, data } });
    });
    await page.goto("/schedules/worship-order?date=2026-10-18", { waitUntil: "networkidle" });
    await expect(page).toHaveTitle("Ordem de Culto | Lauda");
    await page.getByRole("button", { name: "Selecionar escala", exact: true }).first().click();
    await page.getByRole("button", { name: /Escala A/ }).click();
    await expect(page.getByRole("button", { name: /^Atualizar data/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Carregar data", exact: true })).toHaveCount(0);
    await expect(page.getByText("YouTube específico (opcional)", { exact: true })).toHaveCount(0);
    await animatedDrag(page);
    await expect(page.locator('[data-testid^="sortable-"]').first()).toContainText("Cantarei Teu Amor");
    await page.getByLabel("Mover 526 - Grandioso És Tu para cima", { exact: true }).click();
    await expect(page.locator('[data-testid^="sortable-"]').first()).toContainText("526 - Grandioso És Tu");
    await page.getByLabel("Mover 526 - Grandioso És Tu para baixo", { exact: true }).click();
    await expect(page.locator('[data-testid^="sortable-"]').first().getByText("Cantarei Teu Amor", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Momento: Comunhão", exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Exportar PDF", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
    await expect(page.getByText("Ordem de culto salva.")).toBeVisible();
    expect(submitted.morning.songs.map((entry: any) => [entry.songId, entry.moment])).toEqual([["song-1", "Comunhão"], ["song-0", "Louvor"]]);
    expect(submitted.evening).toBeNull();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator('[data-testid^="sortable-"]').first().getByText("Cantarei Teu Amor", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`worship-order-${width}.png`), fullPage: true });
    const preview = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Prévia do PDF", exact: true }).click();
    const popup = await preview;
    await popup.waitForURL(/^blob:/);
    await popup.close();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar PDF", exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("Ordem_de_Culto_18-10-2026.pdf");
    expect((await fs.readFile((await file.path())!)).equals(pdfBytes)).toBe(true);
    // The same drag interaction is available directly in both schedule forms.
    for (const route of ["/schedules/new?date=2026-10-18", `/schedules/${morning.id}/edit`]) {
      await page.goto(route, { waitUntil: "networkidle" });
      if (route.includes("/new")) {
        await page.getByRole("button", { name: "Adicionar músicas à escala", exact: true }).click();
        for (const entry of songs) await page.getByRole("button", { name: `Selecionar música ${entry.song.title}`, exact: true }).click();
        await page.getByText("Concluir", { exact: true }).click();
      }
      await expect(page.getByLabel("YouTube desta participação", { exact: true })).toHaveCount(0);
      await animatedDrag(page);
      await expect(page.locator('[data-testid^="sortable-"]').first()).toContainText("Cantarei Teu Amor");
      await page.getByLabel("Mover 526 - Grandioso És Tu para cima", { exact: true }).click();
      await expect(page.locator('[data-testid^="sortable-"]').first()).toContainText("526 - Grandioso És Tu");
    }
    expect(errors).toEqual([]);
  });
}
