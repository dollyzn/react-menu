import { request as playwrightRequest } from "@playwright/test";
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
    await page.getByRole("button", { name: "Entrar", exact: true }).click();

    await expect(page.getByText("Email ou senha inválidos.")).toBeVisible();
    await expect(page).toHaveURL(/\/app\/login$/);
  });

  test("login, reload keeps the session, logout ends it", async ({ page }) => {
    const store = await createStoreViaApi(page, "Session");
    await page.context().clearCookies();

    await login(page);
    await page.goto(`/app/stores/${store.id}`);

    await page.reload();
    await expect(page.getByRole("button", { name: "Selecionar loja" })).toContainText("Session");

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
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  await expect(page).toHaveURL(/\/app\/stores$/);
  await expect(page.getByText("Nenhuma loja por aqui")).toBeVisible();
  await expect(page.getByText(/Peça a um administrador/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar loja" })).toHaveCount(0);
});

test("Google sign-in: the button shows and a refused login comes back as a message", async ({ page }) => {
  await page.goto("/app/login");
  await expect(page.getByRole("button", { name: "Entrar com Google" })).toBeVisible();

  // The API's callback lands on /app/social?error=… (full-page flow, no popup).
  await page.goto(`/app/social?error=${encodeURIComponent("Você cancelou o login.")}`);
  await expect(page).toHaveURL(/\/app\/login\?erro=/);
  await expect(page.getByRole("alert").filter({ hasText: "Google" })).toContainText("Você cancelou o login.");
});

test("privacy policy and terms are linked from the login and the menu", async ({ page }) => {
  await page.goto("/app/login");
  await page.getByRole("link", { name: "Política de Privacidade" }).click();
  await expect(page.getByRole("heading", { name: "Política de Privacidade", level: 1 })).toBeVisible();
  await page.getByRole("navigation", { name: "Documentos" }).getByRole("link", { name: "Termos de Uso" }).click();
  await expect(page.getByRole("heading", { name: "Termos de Uso", level: 1 })).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Privacidade" })).toHaveAttribute("href", "/privacy");
});

test("logging out after the session already ended on the server is quiet and clears the cookie", async ({ page }) => {
  await login(page);
  // The token dies on the server (expired, signed out elsewhere, APP_KEY
  // changed…) while this browser keeps the cookie: another context sends it.
  const cookie = (await page.context().cookies(API_URL)).map((c) => `${c.name}=${c.value}`).join("; ");
  const elsewhere = await playwrightRequest.newContext();
  expect((await elsewhere.delete(`${API_URL}/api/v1/auth/logout`, { headers: { cookie } })).ok()).toBeTruthy();
  await elsewhere.dispose();

  await page.goto("/app/logout");
  await expect(page).toHaveURL(/\/app\/login/, { timeout: 15_000 });
  // The dead cookie is gone, so the guard doesn't send us back into the panel.
  await page.goto("/app/stores");
  await expect(page).toHaveURL(/\/app\/login$/);
});

test("a session cookie the API refuses (another project on localhost) leads to the login page", async ({ page }) => {
  await page.context().addCookies([
    { name: "session-token", value: "cookie-de-outro-projeto", domain: "localhost", path: "/" },
  ]);

  await page.goto("/app/stores");
  await expect(page).toHaveURL(/\/app\/login$/, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
});
