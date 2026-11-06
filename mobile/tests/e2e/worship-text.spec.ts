import { expect, test } from "@playwright/test";

test.use({ channel: "chromium", permissions: ["clipboard-read", "clipboard-write"] });

for (const width of [390, 1440]) {
  test(`visualiza e copia músicas e leituras formatadas em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const permissions = ["schedule:view", "schedule:edit", "schedule:view_reports", "song:view", "song:attach_to_schedule"];
    const user = { id: "user", name: "Líder", role: "TENANT_ADMIN", tenantId: "tenant", permissions };
    const tenant = { id: "tenant", name: "Igreja de Teste" };
    await page.addInitScript(({ user, tenant }) => {
      localStorage.setItem("auth_token", "test-token");
      localStorage.setItem("refresh_token", "test-refresh");
      localStorage.setItem("auth_user", JSON.stringify(user));
      localStorage.setItem("auth_tenant", JSON.stringify(tenant));
    }, { user, tenant });
    const morning = {
      id: "123e4567-e89b-42d3-a456-426614174000", title: "Culto Manhã", date: "2026-11-08T12:00:00Z",
      ministryId: "ministry", tenantId: "tenant", readings: [{ id: "reading", position: 0, text: "João 3:16\nPorque Deus amou o mundo." }],
      songs: [{ songId: "song-a", order: 0, moment: "Comunhão", song: { id: "song-a", title: "Cantarei Teu amor", artist: { name: "Paulo César Baruk" } } }],
    };
    const evening = { ...morning, id: "123e4567-e89b-42d3-a456-426614174001", title: "Culto Noite", readings: [],
      songs: [{ songId: "song-b", order: 0, moment: "Outro", momentDescription: "Encerramento", song: { id: "song-b", title: "Porque Ele vive", artist: { name: "Coral" } } }],
    };
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/**", async route => {
      const pathname = new URL(route.request().url()).pathname;
      let data: unknown = [];
      if (pathname === "/api/auth/me") data = { user, tenant, permissions };
      if (pathname === "/api/schedules") data = [morning, evening];
      if (pathname.endsWith("/worship-order/2026-11-08")) data = { date: "2026-11-08", morning, evening };
      await route.fulfill({ json: { success: true, data } });
    });
    await page.goto("/schedules/worship-order?date=2026-11-08", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Visualizar texto", exact: true }).click();
    const expected = "=== Culto Manhã ===\n- Leitura bíblica:\n*João 3:16*\n*Porque Deus amou o mundo.*\n- Cantarei Teu amor (Paulo César Baruk) · Comunhão\n\n=== Culto Noite ===\n- Porque Ele vive (Coral) · Encerramento";
    expect(await page.getByTestId("worship-order-text").innerText()).toBe(expected);
    await page.getByRole("button", { name: "Copiar texto", exact: true }).click();
    await expect(page.getByText("Texto copiado.", { exact: true })).toBeVisible();
    expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe(expected);
    await page.getByRole("button", { name: "Fechar texto", exact: true }).click();
    expect(errors).toEqual([]);
  });
}
