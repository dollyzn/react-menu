import type { Page } from "@playwright/test";
import { test, expect, login, signInCode } from "./fixtures";
import { API_URL, E2E_ADMIN } from "../playwright.config";

/** A panel link, as notification e-mails carry (the history with an order open). */
async function panelLink(page: Page) {
  const menu = (await (await page.request.get(`${API_URL}/api/v1/public/menu`)).json()).data;
  return `/app/stores/${menu.store.id}/orders?view=historico`;
}

/** Password and the e-mailed code, on the login page already open. */
async function signIn(page: Page) {
  await page.getByLabel("E-mail").fill(E2E_ADMIN.email);
  await page.getByLabel("Senha", { exact: true }).fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Confirme que é você" })).toBeVisible();
  await page.getByLabel("Código de 6 dígitos").fill(await signInCode(page.request, E2E_ADMIN.email));
}

test("signed out: a panel link goes to the login and then back to it", async ({ page }) => {
  const link = await panelLink(page);
  await page.goto(link);
  await expect(page).toHaveURL(/\/app\/login\?next=/);

  await signIn(page);
  await page.waitForURL(/\/orders\?view=historico$/);
});

test("signed in: a link from another site (an e-mail) opens the page, not the login", async ({ page }) => {
  await login(page);
  const target = new URL(await panelLink(page), page.url()).toString();
  // Another site linking to the panel: the SameSite=Strict cookie isn't sent on that navigation.
  await page.route("http://email.test/**", (route) =>
    route.fulfill({ contentType: "text/html", body: `<a href="${target}">Abrir no painel</a>` })
  );
  // With the SameSite=Lax cookie the link goes straight in: the login is never shown.
  const visited: string[] = [];
  page.on("framenavigated", (frame) => frame === page.mainFrame() && visited.push(frame.url()));
  await page.goto("http://email.test/inbox");
  await page.getByRole("link", { name: "Abrir no painel" }).click();

  await page.waitForURL(/\/orders\?view=historico$/);
  await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();
  expect(visited.some((url) => url.includes("/app/login"))).toBe(false);
});

test("a link from another site to the logout page asks instead of signing out", async ({ page }) => {
  await login(page);
  const logout = new URL("/app/logout", page.url()).toString();
  await page.route("http://email.test/**", (route) =>
    route.fulfill({ contentType: "text/html", body: `<a href="${logout}">Ver oferta</a>` })
  );
  await page.goto("http://email.test/inbox");
  await page.getByRole("link", { name: "Ver oferta" }).click();

  await expect(page.getByRole("heading", { name: "Sair da conta?" })).toBeVisible();
  await page.getByRole("link", { name: "Voltar ao painel" }).click();
  await page.waitForURL(/\/app\/stores\/[^/]+/);
});

test("the panel's own Sair signs out without asking", async ({ page }) => {
  await login(page);
  await page.goto("/app/settings");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page.getByText("Encerrando sessão")).toBeVisible();
  await page.waitForURL(/\/app\/login/, { timeout: 15_000 });
});

test("the login never leaves the panel through ?next", async ({ page }) => {
  await page.goto("/app/login?next=https://evil.test/");
  await signIn(page);
  await page.waitForURL(/\/app\/stores/);
  expect(new URL(page.url()).host).not.toBe("evil.test");
});

test("signing out and in again lands in the panel, not back on the logout", async ({ page }) => {
  await login(page);
  await page.goto("/app/logout");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await page.waitForURL(/\/app\/login/, { timeout: 15_000 });
  // Never the logout page as the destination (it would sign out again).
  expect(new URL(page.url()).searchParams.get("next") ?? "").not.toContain("/app/logout");

  await signIn(page);
  await page.waitForURL(/\/app\/stores\/[^/]+/);
  // Settled there: no second sign-out sending it back to the login.
  await page.waitForTimeout(3000);
  await expect(page).toHaveURL(/\/app\/stores\/[^/]+/);
});

test("signed out, a visit to the forgot-password page, then signing in goes straight into the panel", async ({ page }) => {
  await login(page);
  await page.goto("/app/settings");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await page.waitForURL(/\/app\/login/, { timeout: 15_000 });
  await page.getByRole("link", { name: "Esqueceu a senha?" }).click();
  await page.waitForURL(/\/app\/forgot-password$/);
  await page.getByRole("link", { name: /login/i }).last().click();
  await page.waitForURL(/\/app\/login$/);

  // The router used to reuse what it fetched signed out (a panel page sent
  // back to the login) and stay on the login until a reload.
  const visited: string[] = [];
  page.on("framenavigated", (frame) => frame === page.mainFrame() && visited.push(frame.url()));
  await signIn(page);
  await page.waitForURL(/\/app\/stores\/[^/]+/);
  expect(visited.filter((url) => url.includes("/app/login"))).toEqual([]);
});
