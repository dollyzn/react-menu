import { test, expect, login, createStoreViaApi } from "./fixtures";

test.describe("Authentication and session", () => {
  test("protected pages redirect to login when signed out", async ({ page }) => {
    await page.goto("/app/stores");
    await expect(page).toHaveURL(/\/app\/login$/);
  });

  test("invalid credentials show an error and keep the user signed out", async ({ page }) => {
    await page.goto("/app/login");
    await page.getByLabel("E-mail").fill("e2e-admin@example.com");
    await page.getByLabel("Senha", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByText("Email ou senha inválidos.")).toBeVisible();
    await expect(page).toHaveURL(/\/app\/login$/);
  });

  test("login, reload keeps the session, logout ends it", async ({ page }) => {
    const store = await createStoreViaApi(page, "Session");
    await page.context().clearCookies();

    await login(page);
    await page.goto(`/app/stores/${store.id}`);

    await page.reload();
    await expect(page.getByRole("combobox", { name: "Selecionar loja" })).toContainText("Session");

    await page.getByRole("button", { name: "Menu do usuário" }).click();
    await page.getByRole("menuitem", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/app\/login$/, { timeout: 15_000 });

    await page.goto(`/app/stores/${store.id}`);
    await expect(page).toHaveURL(/\/app\/login$/);
  });
});
