import { request as playwrightRequest } from "@playwright/test";
import { test, expect, login, DEMO_STAFF } from "./fixtures";
import { API_URL } from "../playwright.config";

test("staff signed in on the device get a shortcut from the menu to their panel", async ({ page }) => {
  const menu = (await (await page.request.get(`${API_URL}/api/v1/public/menu?preview=1`)).json()).data;

  // Customers never see it.
  await page.goto("/", { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: menu.store.name, level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir o painel" })).toHaveCount(0);

  // An attendant lands on the orders board of this store.
  await login(page, DEMO_STAFF.attendant);
  await page.goto("/");
  const shortcut = page.getByRole("link", { name: "Abrir o painel" });
  await expect(shortcut).toHaveAttribute("href", `/app/stores/${menu.store.id}/orders`);
  await shortcut.click();
  await expect(page).toHaveURL(new RegExp(`/app/stores/${menu.store.id}/orders$`));
});

test("the order tracking page wears the store's icon and title, and isn't indexed", async ({ page }) => {
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  const menu = (await (await api.get("/api/v1/public/menu?preview=1")).json()).data;
  const placed = await api.post(`/api/v1/public/menu/${menu.store.slug}/orders`, {
    data: {
      lines: [{ itemId: menu.categories[0].items[0].id, quantity: 1 }],
      customer: { name: "Ícone", phone: "11955554444" },
      paymentMethod: "counter",
    },
  });
  const order = (await placed.json()).data;
  await api.dispose();

  await page.goto(`/pedido/${order.publicToken}`, { timeout: 30_000 });
  await expect(page).toHaveTitle(new RegExp(`Pedido #${order.number} · ${menu.store.name}`));
  await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute(
    "href",
    new RegExp(`/icons/store/${menu.store.slug}/`)
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
