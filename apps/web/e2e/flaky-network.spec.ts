import { request as playwrightRequest } from "@playwright/test";
import { test, expect } from "./fixtures";
import { API_URL, E2E_ADMIN } from "../playwright.config";

/**
 * At the beach the order often reaches the server but the answer never comes
 * back. The app must retry on its own with the same Idempotency-Key, and the
 * shop must end up with exactly one order.
 */
test("a lost response while ordering never duplicates the order", async ({ page }) => {
  const customerName = `Praia ${Date.now()}`;
  const keys: string[] = [];
  let dropped = false;

  await page.route("**/api/v1/public/menu/*/orders", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    if (!dropped) {
      dropped = true;
      await route.fetch(); // the server creates the order...
      return route.abort("connectionreset"); // ...but the response is lost
    }
    return route.continue();
  });

  await page.goto("/");
  await page.getByRole("button", { name: /^Pastel de Carne, R\$/ }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: /Adicionar/ }).click();
  await page.getByRole("button", { name: /Ver sacola/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Seu nome").fill(customerName);
  await page.getByLabel("Celular (WhatsApp)").fill("11987654321");
  await page.getByRole("button", { name: "Fazer pedido" }).click();

  await expect(page).toHaveURL(/\/pedido\/[0-9a-f-]{36}$/);
  expect(keys.length).toBeGreaterThanOrEqual(2);
  expect(new Set(keys).size).toBe(1);

  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  await api.post("/api/v1/auth/login", { data: E2E_ADMIN });
  const menu = (await (await api.get("/api/v1/public/menu?preview=1")).json()).data;
  const orders = (await (await api.get(`/api/v1/stores/${menu.store.id}/orders`)).json()).data as {
    customerName: string;
  }[];
  expect(orders.filter((order) => order.customerName === customerName)).toHaveLength(1);
  await api.dispose();
});
