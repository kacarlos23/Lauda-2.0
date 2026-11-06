import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test.skip(process.env.LAUDA_THEME_PREVIEW_TEST !== "1", "Requires the isolated local preview");
if (process.env.LAUDA_THEME_PREVIEW_TEST === "1") {
  test.use({ storageState: path.resolve("../test-results/theme-preview/session.local.json") });
}
const output = path.resolve("../test-results/ui-standardization");

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mkdir(output, { recursive: true });
});

for (const mode of ["light", "dark"] as const) {
  test(`form fields share their appearance, accept editing and show keyboard focus in ${mode}`, async ({ page }) => {
    const forms = [
      ["/members/new", "Nome"],
      ["/songs/new", "Nome da música"],
      ["/instruments", "Nome do instrumento/cargo"],
      ["/profile", "Nome"],
      ["/schedules/new", "Nome da escala"],
    ];
    let reference: unknown;
    for (const [route, label] of forms) {
      await page.goto(`${route}?theme=${mode}`);
      await page.waitForLoadState("networkidle");
      const field = page.getByRole("textbox", { name: label, exact: true });
      await expect(field).toBeVisible();
      const appearance = await field.evaluate((element) => {
        const style = getComputedStyle(element);
        return { height: element.getBoundingClientRect().height, radius: style.borderRadius, border: style.borderColor, font: style.fontSize, weight: style.fontWeight, background: style.backgroundColor };
      });
      reference ??= appearance;
      expect(appearance).toEqual(reference);
      await field.fill("Conferência visual");
      await expect(field).toHaveValue("Conferência visual");
      await field.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(field).toBeFocused();
      const focus = await field.evaluate((element) => ({ border: getComputedStyle(element).borderColor, ring: getComputedStyle(element).boxShadow }));
      expect(focus.border).not.toBe(appearance.border);
      expect(focus.ring).not.toBe("none");
      await page.screenshot({ path: path.join(output, `${route.split("/").filter(Boolean).join("-")}-${mode}.png`) });
    }
  });
}

test("ministry forms and filters keep validation, enabled states and cancellation", async ({ page }) => {
  await page.goto("/ministries?theme=dark");
  await page.getByRole("button", { name: "Criar ministério", exact: true }).click();
  const name = page.getByRole("textbox", { name: "Nome", exact: true });
  await expect(name).toBeVisible();
  await page.getByText("Criar", { exact: true }).click();
  await expect(page.getByText("Informe um nome com ao menos 2 caracteres.", { exact: true })).toBeVisible();
  await name.fill("Ministério de teste");
  await page.getByRole("textbox", { name: "Descrição", exact: true }).fill("Descrição em várias linhas\ncom o mesmo padrão de campo.");
  const editor = page.getByRole("textbox", { name: "Comentários", exact: true });
  await editor.fill("Observações do formulário");
  await expect(editor).toContainText("Observações do formulário");
  await page.screenshot({ path: path.join(output, "ministerio-dialogo-dark.png") });
  await page.getByText("Cancelar", { exact: true }).click();
  await expect(name).not.toBeVisible();

  await page.getByRole("button", { name: "Abrir filtros de ministérios", exact: true }).click();
  const apply = page.getByRole("button", { name: "Aplicar filtros", exact: true });
  await expect(apply).toBeDisabled();
  await page.getByRole("textbox", { name: "Buscar ministérios", exact: true }).fill("Louvor");
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(page.getByText("Louvor", { exact: true })).toBeVisible();
  await expect(page.getByText("Recepção", { exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros de ministérios", exact: true }).click();
  await expect(page.getByText("Recepção", { exact: true })).toBeVisible();

  const fixture = JSON.parse(readFileSync(path.resolve("../test-results/theme-preview/fixture.json"), "utf8"));
  await page.goto(`/ministries/${fixture.ministryId}/members`);
  const search = page.getByRole("textbox", { name: "Buscar membros do ministério", exact: true });
  await search.fill("Ana Souza");
  await expect(page.getByText("Ana Souza", { exact: true })).toBeVisible();
  await expect(page.getByText("Marina Costa", { exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "Limpar busca", exact: true }).click();
  await expect(page.getByText("Marina Costa", { exact: true })).toBeVisible();
});

test("all main areas fit desktop and mobile in both themes without clipped fields", async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = JSON.parse(readFileSync(path.resolve("../test-results/theme-preview/fixture.json"), "utf8"));
  const routes = ["/", "/songs", "/ministries", "/members", "/church", "/profile", "/artists", "/instruments", "/members/new", "/songs/new", "/schedules", "/schedules/new", `/ministries/${fixture.ministryId}`, `/ministries/${fixture.ministryId}/members`, "/ministries/assign", `/schedules/${fixture.schedules[0].id}/edit`];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const mode of ["light", "dark"]) {
      for (const route of routes) {
        await page.goto(`${route}?theme=${mode}`);
        await page.waitForLoadState("networkidle");
        await expect(page.getByTestId("theme-toggle")).toBeVisible();
        const outside = await page.locator('input:not([type="hidden"]), textarea').evaluateAll((elements) => elements.filter((element) => {
          const box = element.getBoundingClientRect();
          return box.width > 0 && (box.x < 0 || box.right > window.innerWidth + 1);
        }).map((element) => element.getAttribute("aria-label") ?? element.getAttribute("placeholder")));
        expect(outside, `${width}px ${mode} ${route}`).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), route).toBe(false);
      }
    }
  }
});
