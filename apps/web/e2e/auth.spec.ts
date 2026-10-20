import { test, expect, login, createStoreViaApi } from "./fixtures";
import { API_URL } from "../playwright.config";

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

test("a user without stores sees an empty state instead of being redirected", async ({ page }) => {
  // Logs in as the seeded admin to create a staff account with no store.
  await createStoreViaApi(page, "Onboarding");
  const staff = { name: "Carla", email: `carla-${Date.now()}@example.com`, password: "carla12345" };
  const created = await page.request.post(`${API_URL}/api/v1/users`, { data: staff });
  expect(created.ok()).toBeTruthy();
  await page.context().clearCookies();

  await page.goto("/app/login");
  await page.getByLabel("E-mail").fill(staff.email);
  await page.getByLabel("Senha", { exact: true }).fill(staff.password);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/app\/stores$/);
  await expect(page.getByText("Nenhuma loja por aqui")).toBeVisible();
  await expect(page.getByText(/Peça a um administrador/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar loja" })).toHaveCount(0);
});
