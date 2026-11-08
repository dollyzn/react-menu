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
  await page.goto("http://email.test/inbox");
  await page.getByRole("link", { name: "Abrir no painel" }).click();

  await page.waitForURL(/\/orders\?view=historico$/);
  await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();
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
  await page.waitForURL(/\/app\/login/, { timeout: 15_000 });
  // Never the logout page as the destination (it would sign out again).
  expect(new URL(page.url()).searchParams.get("next") ?? "").not.toContain("/app/logout");

  await signIn(page);
  await page.waitForURL(/\/app\/stores\/[^/]+/);
  // Settled there: no second sign-out sending it back to the login.
  await page.waitForTimeout(3000);
  await expect(page).toHaveURL(/\/app\/stores\/[^/]+/);
});
