import { expect, test } from "@playwright/test";

async function openLogin(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByTestId("login-email")).toBeVisible();
}

test.describe("login", () => {
  test("validates login when submitting by button click", async ({ page }) => {
    await openLogin(page);

    await page.getByTestId("login-email").fill("email-invalido");
    await page.getByTestId("login-password").fill("123456");
    await page.getByTestId("login-submit").click();

    await expect(page.getByTestId("login-error")).toContainText("Informe um e-mail válido.");
  });

  test("validates login when submitting with Enter on the password field", async ({ page }) => {
    await openLogin(page);

    await page.getByTestId("login-email").fill("email-invalido");
    await page.getByTestId("login-password").fill("123456");
    await page.getByTestId("login-password").press("Enter");

    await expect(page.getByTestId("login-error")).toContainText("Informe um e-mail válido.");
  });

  test("moves focus from email to password with Enter", async ({ page }) => {
    await openLogin(page);

    await page.getByTestId("login-email").fill("usuario@lauda.app");
    await page.getByTestId("login-email").press("Enter");

    await expect(page.getByTestId("login-password")).toBeFocused();
  });

  test("does not use browser default input outline on web", async ({ page }) => {
    await openLogin(page);

    const emailInput = page.getByTestId("login-email");
    await emailInput.focus();

    await expect(emailInput).toHaveCSS("outline-style", "none");
    await expect(emailInput).toHaveCSS("outline-width", "0px");
    await expect(emailInput).toHaveCSS("box-shadow", "none");
  });
});
